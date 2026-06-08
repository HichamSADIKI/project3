"""Tests de l'orchestrateur codegen (Phase 3A) — SANS worker réel, git ni réseau.

Couvre : gabarits purs (le code généré **compile**), whitelist d'argv (`_check_allowed`
refuse merge/force/rm/…), rédaction du token, montage ancré idempotent dans main.py, et
le pipeline `run_codegen_job` avec `_run`/git/gh monkeypatchés (succès → `pr_open`/`done`,
échec RADAR → `failed`). Le worker n'est jamais lancé ; on teste sa logique en process.
"""

import ast
import asyncio
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.studio import StudioModule, StudioOrchestratorJob
from app.routers.admin.studio_templates import (
    generated_files,
    main_import_line,
    main_include_line,
    module_slug,
    render_router,
)
from app.tasks import studio_orchestrator as orch
from app.tasks.studio_orchestrator import (
    CommandNotAllowedError,
    _check_allowed,
    _mount_main,
    _redact,
)

# ── Gabarits purs ──────────────────────────────────────────────────────────────


def test_module_slug() -> None:
    assert module_slug("studio.inventory") == "studio_inventory"
    assert module_slug("abc_1") == "abc_1"
    for bad in ("Bad Key", "a/b", "a;b", "../x"):
        with pytest.raises(ValueError):
            module_slug(bad)


def test_generated_python_compiles() -> None:
    """Tout fichier .py généré doit être syntaxiquement valide (ast.parse)."""
    for path, content in generated_files("studio_demo").items():
        if path.endswith(".py"):
            ast.parse(content)


def test_router_has_prefix_and_auth() -> None:
    r = render_router("studio_demo")
    assert "/studio_demo" in r
    assert "get_company_id" in r  # frontière d'auth (401 sans JWT)


# ── Whitelist d'argv ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "argv",
    [
        ["git", "clone", "url", "dir"],
        ["git", "worktree", "add", "x", "origin/main"],
        ["git", "checkout", "-B", "b"],
        ["git", "add", "a", "b"],
        ["git", "push", "origin", "b"],
        ["gh", "pr", "create", "--base", "main"],
        ["uv", "run", "ruff", "check", "x"],
    ],
)
def test_check_allowed_accepts(argv: list[str]) -> None:
    _check_allowed(argv)  # ne lève pas


@pytest.mark.parametrize(
    "argv",
    [
        ["git", "merge", "main"],
        ["git", "push", "--force", "origin", "b"],
        ["git", "reset", "--hard"],
        ["rm", "-rf", "/"],
        ["gh", "pr", "merge", "1"],
        ["uv", "run", "pytest"],
        ["bash", "-c", "evil"],
        ["git", "worktree", "--delete"],
    ],
)
def test_check_allowed_rejects(argv: list[str]) -> None:
    with pytest.raises(CommandNotAllowedError):
        _check_allowed(argv)


def test_redact_masks_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STUDIO_GH_TOKEN", "SECRET123")
    out = _redact("clone https://x-access-token:SECRET123@github.com ok")
    assert "SECRET123" not in out
    assert "***" in out


# ── Montage ancré dans main.py ──────────────────────────────────────────────────


def test_mount_main_inserts_idempotent(tmp_path) -> None:
    main = tmp_path / "main.py"
    main.write_text(
        f"import x\n{orch.ANCHOR_IMPORT} ancre <<<\napp = 1\n{orch.ANCHOR_INCLUDE} ancre <<<\n",
        encoding="utf-8",
    )
    _mount_main(main, "studio_demo")
    text = main.read_text(encoding="utf-8")
    assert main_import_line("studio_demo") in text
    assert main_include_line("studio_demo") in text
    # Idempotent : un 2ᵉ montage n'ajoute pas de doublon.
    _mount_main(main, "studio_demo")
    text2 = main.read_text(encoding="utf-8")
    assert text2.count(main_import_line("studio_demo")) == 1
    assert text2.count(main_include_line("studio_demo")) == 1


def test_mount_main_missing_anchor_raises(tmp_path) -> None:
    main = tmp_path / "main.py"
    main.write_text("aucune ancre ici\n", encoding="utf-8")
    with pytest.raises(RuntimeError):
        _mount_main(main, "studio_demo")


# ── Pipeline run_codegen_job (monkeypatché) ─────────────────────────────────────


def _make_fake_run(ruff_check_rc: int = 0):
    calls: list[list[str]] = []

    def fake(argv, cwd, *, timeout=180, env=None):  # noqa: ANN001, ANN003
        calls.append(argv)
        if argv[:3] == ["uv", "run", "ruff"] and "check" in argv:
            return (ruff_check_rc, "ruff check output")
        if argv[:3] == ["gh", "pr", "create"]:
            return (0, "https://github.com/Org/repo/pull/7")
        return (0, "")

    fake.calls = calls  # type: ignore[attr-defined]
    return fake


def _patch_pipeline(monkeypatch: pytest.MonkeyPatch, *, ruff_check_rc: int = 0) -> None:
    monkeypatch.setenv("STUDIO_CODEGEN_ENABLED", "true")
    monkeypatch.setenv("STUDIO_GH_TOKEN", "tok")
    monkeypatch.setenv("STUDIO_REPO_URL", "https://github.com/Org/repo.git")
    monkeypatch.setattr(orch, "_ensure_repo", lambda: None)
    monkeypatch.setattr(orch, "_cleanup_worktree", lambda wt: None)
    monkeypatch.setattr(
        orch,
        "_write_generated",
        lambda wt, slug, schema: [
            f"apps/api/app/routers/{slug}/router.py",
            f"apps/api/app/routers/{slug}/test_{slug}.py",
            "apps/api/app/main.py",
        ],
    )
    monkeypatch.setattr(orch, "_run", _make_fake_run(ruff_check_rc=ruff_check_rc))


async def _run_job(job_id: str) -> dict:
    """Exécute la tâche dans un thread (loop dédié). `sync_session_maker` ouvre son propre
    event loop via run_until_complete → l'exécuter hors du loop pytest-asyncio évite le conflit."""
    return await asyncio.to_thread(lambda: orch.run_codegen_job.apply(args=[job_id]).get())


async def _seed_code_module_and_job(db: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    module = StudioModule(
        key=f"studio.gen_{uuid.uuid4().hex[:8]}",
        title_ar="و",
        title_en="Gen",
        title_fr="Gen",
        flavor="code",
        mode="manual",
        state="draft",
    )
    db.add(module)
    await db.commit()
    await db.refresh(module)
    job = StudioOrchestratorJob(module_id=module.id, status="requested", phase="queued")
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return module.id, job.id


@pytest.mark.asyncio
async def test_run_codegen_job_happy_path(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Pipeline complet vert → module `pr_open`, job `done`, pr_url renseignée."""
    module_id, job_id = await _seed_code_module_and_job(db_session)
    _patch_pipeline(monkeypatch, ruff_check_rc=0)

    await _run_job(str(job_id))

    db_session.expire_all()
    job = (
        await db_session.execute(
            select(StudioOrchestratorJob).where(StudioOrchestratorJob.id == job_id)
        )
    ).scalar_one()
    module = (
        await db_session.execute(select(StudioModule).where(StudioModule.id == module_id))
    ).scalar_one()
    assert job.status == "done"
    assert job.phase == "done"
    assert module.state == "pr_open"
    assert (job.pr_url or "").endswith("/pull/7")


@pytest.mark.asyncio
async def test_run_codegen_job_radar_failure(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """RADAR (ruff check) rouge → job `failed` en phase radar, module `failed`, pas de PR."""
    module_id, job_id = await _seed_code_module_and_job(db_session)
    _patch_pipeline(monkeypatch, ruff_check_rc=1)

    await _run_job(str(job_id))

    db_session.expire_all()
    job = (
        await db_session.execute(
            select(StudioOrchestratorJob).where(StudioOrchestratorJob.id == job_id)
        )
    ).scalar_one()
    module = (
        await db_session.execute(select(StudioModule).where(StudioModule.id == module_id))
    ).scalar_one()
    assert job.status == "failed"
    assert job.phase == "radar"
    assert module.state == "failed"
    assert job.pr_url is None


@pytest.mark.asyncio
async def test_run_codegen_job_disabled_fail_secure(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Flag off → la tâche refuse (fail-secure), job `failed` 'codegen_disabled'."""
    module_id, job_id = await _seed_code_module_and_job(db_session)
    monkeypatch.setenv("STUDIO_CODEGEN_ENABLED", "false")

    await _run_job(str(job_id))

    db_session.expire_all()
    job = (
        await db_session.execute(
            select(StudioOrchestratorJob).where(StudioOrchestratorJob.id == job_id)
        )
    ).scalar_one()
    assert job.status == "failed"
    assert "codegen_disabled" in (job.detail or "")


@pytest.mark.asyncio
async def test_run_codegen_job_idempotent(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Un job déjà terminé n'est pas re-traité (idempotence)."""
    _module_id, job_id = await _seed_code_module_and_job(db_session)
    job = (
        await db_session.execute(
            select(StudioOrchestratorJob).where(StudioOrchestratorJob.id == job_id)
        )
    ).scalar_one()
    job.status = "done"
    await db_session.commit()

    result = await _run_job(str(job_id))
    assert result["status"] == "skipped"
