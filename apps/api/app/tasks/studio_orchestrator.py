"""Tâches Celery — Studio de Modules · orchestrateur de génération de code (Phase 3A, HAUT RISQUE).

Queue : **studio** (worker DÉDIÉ `worker-studio`, profil compose éteint par défaut — seul
service autorisé à exécuter git/gh). L'API publique n'exécute JAMAIS : elle crée un
`studio_orchestrator_jobs` (status='requested') et enqueue `run_codegen_job`.

Doctrine *fail-secure* (clone de `infra_control`) :
- **Whitelist d'argv EN DUR** (`_ALLOWED`), `shell=False`, argv figés, cwd épinglé, timeouts.
  JAMAIS `merge`, `push --force`, `reset --hard`, `rm`, shell libre. Allow-list stricte →
  toute commande non énumérée est refusée (`CommandNotAllowedError`).
- **Désactivé par défaut** : `STUDIO_CODEGEN_ENABLED` faux → l'API ne délègue pas (501) ; même
  enqueuée, la tâche refuse si le flag est faux ou si `STUDIO_GH_TOKEN` manque (fail-secure).
- **Token rédigé** de toute sortie capturée/loggée (`_redact`).
- **Clone isolé** : le worker maintient son PROPRE clone (volume), jamais le checkout hôte ;
  worktree jeté par job. **JAMAIS d'auto-merge** : au mieux une PR ouverte → gate « GO #PR ».
- Idempotent : ne traite que les jobs encore en 'requested'.

Découpe RADAR/CHASSEUR (surface minimale) : le worker fait le RADAR **statique** (ruff
format+check sur le code généré) et ouvre la PR ; le **pytest du module généré (frontière
401/200 = CHASSEUR) s'exécute dans la CI de la PR** (suite backend complète) avant tout
merge humain. Le worker n'a donc besoin ni de base de données ni de sync par worktree.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess  # noqa: S404 — exécution maîtrisée par allow-list (jamais shell=True)
import uuid
from pathlib import Path

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import sync_session_maker
from app.models.studio import StudioModule, StudioOrchestratorJob
from app.routers.admin.studio import can_transition
from app.routers.admin.studio_templates import (
    column_specs,
    compute_revision,
    generated_files,
    main_import_line,
    main_include_line,
    module_slug,
    render_migration,
)

logger = logging.getLogger(__name__)

ANCHOR_IMPORT = "# >>> STUDIO_GENERATED_IMPORTS"
ANCHOR_INCLUDE = "# >>> STUDIO_GENERATED_INCLUDES"

# Allow-list (programme, sous-commande). Tout le reste est refusé.
_ALLOWED: frozenset[tuple[str, str]] = frozenset(
    {
        ("git", "clone"),
        ("git", "fetch"),
        ("git", "worktree"),
        ("git", "checkout"),
        ("git", "add"),
        ("git", "commit"),
        ("git", "push"),
        ("gh", "pr"),
        ("uv", "run"),
    }
)
# Arguments interdits, quelle que soit la commande (destructifs / dangereux).
_FORBIDDEN_ARGS: frozenset[str] = frozenset({"--force", "-f", "--hard", "--mirror", "--delete"})


class CommandNotAllowedError(Exception):
    """Argv hors whitelist ou contenant un argument interdit."""


# ── Config (env, fail-safe) ────────────────────────────────────────────────────


def codegen_enabled() -> bool:
    return os.getenv("STUDIO_CODEGEN_ENABLED", "false").strip().lower() == "true"


def gh_token() -> str:
    return os.getenv("STUDIO_GH_TOKEN", "").strip()


def repo_url() -> str:
    """URL HTTPS du dépôt (sans token), ex. https://github.com/Org/repo.git."""
    return os.getenv("STUDIO_REPO_URL", "").strip()


def worktree_base() -> Path:
    return Path(os.getenv("STUDIO_WORKTREE_BASE", "/worktrees").strip() or "/worktrees")


def repo_dir() -> Path:
    return Path(os.getenv("STUDIO_REPO_DIR", "").strip() or str(worktree_base() / "repo"))


def worker_app_dir() -> Path:
    """Répertoire de l'env uv SYNCHRONISÉ du worker (avec ruff) — pour linter le code
    généré sans re-synchroniser par worktree. Défaut /app (WORKDIR de l'image)."""
    return Path(os.getenv("STUDIO_WORKER_APP_DIR", "/app").strip() or "/app")


def _git_identity() -> tuple[str, str]:
    return (
        os.getenv("STUDIO_GIT_NAME", "SGI Studio Bot").strip() or "SGI Studio Bot",
        os.getenv("STUDIO_GIT_EMAIL", "studio-bot@sgi.local").strip() or "studio-bot@sgi.local",
    )


def _lintable_paths(paths: list[str]) -> list[str]:
    """Chemins à passer à ruff : Python uniquement. PUR (testable).

    Un fichier non-`.py` (ex. le `CLAUDE.md` généré) déclenche « Markdown formatting is
    experimental » → `ruff format` rc≠0 → ferait échouer tout le RADAR.
    """
    return [p for p in paths if p.endswith(".py")]


# ── Exécution maîtrisée ─────────────────────────────────────────────────────────


def _redact(text: str) -> str:
    """Masque le token GitHub dans toute sortie."""
    tok = gh_token()
    return text.replace(tok, "***") if tok else text


def _check_allowed(argv: list[str]) -> None:
    """Refuse tout argv hors allow-list ou contenant un argument interdit. PUR (testable)."""
    if len(argv) < 2:
        raise CommandNotAllowedError(f"argv_too_short:{argv}")
    pair = (argv[0], argv[1])
    if pair not in _ALLOWED:
        raise CommandNotAllowedError(f"not_allowed:{pair}")
    if any(a in _FORBIDDEN_ARGS for a in argv):
        raise CommandNotAllowedError(f"forbidden_arg:{argv}")
    # Sous-commandes secondaires bornées.
    if pair == ("gh", "pr") and (len(argv) < 3 or argv[2] != "create"):
        raise CommandNotAllowedError("gh_pr_create_only")
    if pair == ("uv", "run") and (len(argv) < 3 or argv[2] != "ruff"):
        raise CommandNotAllowedError("uv_run_ruff_only")


def _run(
    argv: list[str], cwd: str | Path, *, timeout: int = 180, env: dict[str, str] | None = None
) -> tuple[int, str]:
    """Exécute une commande de l'allow-list (jamais shell). Renvoie (rc, sortie rédigée)."""
    _check_allowed(argv)
    proc = subprocess.run(  # noqa: S603 — argv figés, validés par _check_allowed, shell=False
        argv,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
        check=False,
    )
    out = _redact((proc.stdout or "") + (proc.stderr or ""))[:3500]
    return proc.returncode, out


def _authed_remote() -> str:
    """URL distante avec token injecté (jamais loggée — rédigée par _redact)."""
    url, tok = repo_url(), gh_token()
    if url.startswith("https://"):
        return url.replace("https://", f"https://x-access-token:{tok}@", 1)
    return url


def _gh_env() -> dict[str, str]:
    """Env pour gh (token via GH_TOKEN)."""
    return {**os.environ, "GH_TOKEN": gh_token()}


# ── Étapes de génération (fichiers — pures côté contenu) ────────────────────────


def _mount_main(main_path: Path, slug: str) -> None:
    """Insère l'import + le montage du module généré aux ancres de main.py (idempotent).

    Lève si une ancre manque (échec propre — pas d'écriture partielle).
    """
    text = main_path.read_text(encoding="utf-8")
    if ANCHOR_IMPORT not in text or ANCHOR_INCLUDE not in text:
        raise RuntimeError("main_anchor_missing")
    import_line = main_import_line(slug)
    include_line = main_include_line(slug)
    if import_line in text and include_line in text:
        return  # déjà monté (idempotent)
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    for line in lines:
        out.append(line)
        if line.startswith(ANCHOR_IMPORT) and import_line not in text:
            out.append(import_line + "\n")
        if line.startswith(ANCHOR_INCLUDE) and include_line not in text:
            out.append(include_line + "\n")
    main_path.write_text("".join(out), encoding="utf-8")


def _existing_revisions(wt: Path) -> list[str]:
    """Stems des migrations existantes du worktree (pour calculer le prochain numéro)."""
    versions = wt / "apps/api/migrations/versions"
    if not versions.exists():
        return []
    return [p.stem for p in versions.glob("[0-9][0-9][0-9][0-9]_*.py")]


def _write_generated(wt: Path, slug: str, schema: dict | None) -> list[str]:
    """Écrit les fichiers du module généré dans le worktree + monte dans main.py.

    Avec `schema` → module CRUD complet + **migration** (numéro calculé depuis le worktree).
    Sans → squelette (Phase 3A). Renvoie les chemins (relatifs au worktree) à `git add`
    — explicites, jamais `-A`.
    """
    written: list[str] = []
    for rel, content in generated_files(slug, schema).items():
        dest = wt / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        written.append(rel)
    if schema is not None:
        cols = column_specs(schema)
        new_rev, down_rev = compute_revision(_existing_revisions(wt), slug)
        mig_rel = f"apps/api/migrations/versions/{new_rev}.py"
        (wt / mig_rel).write_text(render_migration(slug, cols, new_rev, down_rev), encoding="utf-8")
        written.append(mig_rel)
    main_rel = "apps/api/app/main.py"
    _mount_main(wt / main_rel, slug)
    written.append(main_rel)
    return written


# ── Pipeline worker ─────────────────────────────────────────────────────────────


def _finish(
    db: Session,
    job: StudioOrchestratorJob,
    module: StudioModule,
    status: str,
    phase: str,
    detail: str,
) -> dict[str, object]:
    job.status = status
    job.phase = phase
    job.detail = detail[:4000]
    if status == "failed" and can_transition(module.state, "failed"):
        module.state = "failed"
    db.commit()
    return {"status": status, "job_id": str(job.id), "phase": phase}


def _advance(module: StudioModule, dst: str) -> None:
    if not can_transition(module.state, dst):
        raise RuntimeError(f"invalid_transition:{module.state}->{dst}")
    module.state = dst


def _ensure_repo() -> None:
    """Clone le dépôt (token) s'il n'existe pas, sinon `git fetch origin`."""
    rd = repo_dir()
    if (rd / ".git").exists():
        rc, out = _run(["git", "fetch", "origin", "--prune"], cwd=rd, timeout=300)
        if rc != 0:
            raise RuntimeError(f"git_fetch_failed:{out}")
        return
    rd.parent.mkdir(parents=True, exist_ok=True)
    rc, out = _run(["git", "clone", _authed_remote(), str(rd)], cwd=rd.parent, timeout=600)
    if rc != 0:
        raise RuntimeError(f"git_clone_failed:{out}")


def _cleanup_worktree(wt: Path) -> None:
    try:
        _run(["git", "worktree", "remove", str(wt), "--force"], cwd=repo_dir(), timeout=60)
    except Exception:  # noqa: BLE001, S110 — best-effort
        pass
    if wt.exists():
        shutil.rmtree(wt, ignore_errors=True)


@shared_task(bind=True, max_retries=0)
def run_codegen_job(self, job_id: str) -> dict[str, object]:  # noqa: ANN001
    """Exécute un job de génération de code (squelette réel → branche → RADAR → PR)."""
    with sync_session_maker() as db:
        job = db.execute(
            select(StudioOrchestratorJob).where(StudioOrchestratorJob.id == uuid.UUID(job_id))
        ).scalar_one_or_none()
        if job is None or job.status != "requested":
            return {"status": "skipped", "job_id": job_id}
        module = db.execute(
            select(StudioModule).where(StudioModule.id == job.module_id)
        ).scalar_one_or_none()
        if module is None:
            return _finish(db, job, job, "failed", "failed", "module_not_found")  # type: ignore[arg-type]

        # Garde-fous fail-secure.
        if not codegen_enabled():
            return _finish(db, job, module, "failed", "failed", "codegen_disabled")
        if not gh_token() or not repo_url():
            return _finish(db, job, module, "failed", "failed", "gh_config_missing")
        try:
            slug = module_slug(module.key)
        except ValueError as exc:
            return _finish(db, job, module, "failed", "failed", f"invalid_key:{exc}")

        job.status = "running"
        branch = f"studio/gen-{slug}"
        wt = worktree_base() / f"wt-{slug}-{str(job.id)[:8]}"
        job.worktree_path = str(wt)
        job.branch_name = branch
        db.commit()

        try:
            # 1) SCAFFOLD — clone/fetch, worktree, branche, écriture, montage.
            job.phase = "scaffold"
            db.commit()
            _ensure_repo()
            _cleanup_worktree(wt)
            rc, out = _run(
                ["git", "worktree", "add", str(wt), "origin/main"], cwd=repo_dir(), timeout=180
            )
            if rc != 0:
                return _finish(db, job, module, "failed", "scaffold", f"worktree_add:{out}")
            rc, out = _run(["git", "checkout", "-B", branch], cwd=wt, timeout=60)
            if rc != 0:
                return _finish(db, job, module, "failed", "scaffold", f"checkout:{out}")
            # Pré-check collision : un module (router) du même slug existe déjà → échec clair
            # en amont (plutôt qu'un échec opaque en CI de la PR sur create_table/duplicate dir).
            if (wt / f"apps/api/app/routers/{slug}").exists():
                _cleanup_worktree(wt)
                return _finish(db, job, module, "failed", "scaffold", f"module_slug_exists:{slug}")
            paths = _write_generated(wt, slug, module.schema_json)
            _advance(module, "built")
            db.commit()

            # 2) RADAR statique — ruff format (write) + format --check + check sur le généré.
            # Lancé depuis l'env uv SYNCHRONISÉ du worker (worker_app_dir, avec ruff) sur
            # les fichiers du worktree en chemins ABSOLUS → pas de re-sync par worktree.
            job.phase = "radar"
            db.commit()
            gen_paths = [p for p in paths if p != "apps/api/app/main.py"]
            # Ruff ne lint/formate QUE le Python (un .md généré casserait le RADAR).
            gen_abs = [str(wt / p) for p in _lintable_paths(gen_paths)]
            app_dir = worker_app_dir()
            # `--fix` : trie les imports + retire les inutiles du code généré (I/F401),
            # puis `format` (mise en forme). Les vérifications ci-dessous restent strictes.
            _run(["uv", "run", "ruff", "check", "--fix", *gen_abs], cwd=app_dir, timeout=180)
            _run(["uv", "run", "ruff", "format", *gen_abs], cwd=app_dir, timeout=180)
            rc_fmt, out_fmt = _run(
                ["uv", "run", "ruff", "format", "--check", *gen_abs], cwd=app_dir, timeout=180
            )
            rc_chk, out_chk = _run(
                ["uv", "run", "ruff", "check", *gen_abs], cwd=app_dir, timeout=180
            )
            job.radar_report = {
                "ruff_format_ok": rc_fmt == 0,
                "ruff_check_ok": rc_chk == 0,
                "output": (out_fmt + "\n" + out_chk)[:2000],
            }
            if rc_fmt != 0 or rc_chk != 0:
                _cleanup_worktree(wt)
                return _finish(db, job, module, "failed", "radar", "ruff_failed")
            _advance(module, "tested")
            db.commit()

            # 3) CHASSEUR — l'invariant de sécurité est porté par le test co-localisé généré,
            #    exécuté par la CI de la PR (suite backend + migration appliquée) : squelette →
            #    401 sans JWT ; CRUD → **Red-Team cross-tenant Loi 1** (404 anti-BOLA). Le worker
            #    vérifie la présence du test (pas de DB côté worker).
            job.phase = "chasseur"
            test_content = generated_files(slug, module.schema_json)[
                f"apps/api/app/routers/{slug}/test_{slug}.py"
            ]
            marker = (
                f"test_{slug}_tenant_isolation"
                if module.schema_json is not None
                else f"test_{slug}_status_requires_auth"
            )
            test_present = marker in test_content
            job.chasseur_report = {
                "security_test_present": test_present,
                "kind": "tenant_isolation" if module.schema_json is not None else "auth_boundary",
                "executed_by": "pr_ci",
                "note": "Vérifié par la CI de la PR (DB + migration) avant tout merge.",
            }
            if not test_present:  # garde-fou (ne devrait jamais arriver)
                _cleanup_worktree(wt)
                return _finish(db, job, module, "failed", "chasseur", "security_test_missing")
            _advance(module, "audited")
            db.commit()

            # 4) PUSH + PR — commit, push (token), gh pr create. JAMAIS de merge.
            job.phase = "push"
            db.commit()
            name, email = _git_identity()
            _run(["git", "add", *paths], cwd=wt, timeout=60)
            # Identité via env (pas `git -c …` : garderait la whitelist d'argv hors allow-list).
            rc, out = _run(
                ["git", "commit", "-m", f"feat(studio): module généré {slug} (squelette)"],
                cwd=wt,
                timeout=60,
                env={
                    **os.environ,
                    "GIT_AUTHOR_NAME": name,
                    "GIT_AUTHOR_EMAIL": email,
                    "GIT_COMMITTER_NAME": name,
                    "GIT_COMMITTER_EMAIL": email,
                },
            )
            if rc != 0:
                _cleanup_worktree(wt)
                return _finish(db, job, module, "failed", "push", f"commit:{out}")
            rc, out = _run(["git", "push", "origin", branch], cwd=wt, timeout=180)
            if rc != 0:
                _cleanup_worktree(wt)
                return _finish(db, job, module, "failed", "push", f"push:{out}")

            job.phase = "pr"
            db.commit()
            rc, out = _run(
                [
                    "gh",
                    "pr",
                    "create",
                    "--base",
                    "main",
                    "--head",
                    branch,
                    "--title",
                    f"feat(studio): module généré {slug}",
                    "--body",
                    f"Module **{slug}** généré par le Studio de Modules (squelette Phase 3A).\n\n"
                    "RADAR statique (ruff) vert. La frontière d'auth (401/200) est vérifiée par "
                    "la CI de cette PR. **Aucun auto-merge** — merge humain après revue.",
                ],
                cwd=wt,
                timeout=120,
                env=_gh_env(),
            )
            pr_url = out.strip().splitlines()[-1] if rc == 0 and out.strip() else None
            if pr_url:
                job.pr_url = pr_url[:500]
                module.pr_url = pr_url[:500]
            _advance(module, "pr_open")
            _cleanup_worktree(wt)
            return _finish(db, job, module, "done", "done", f"pr_open:{pr_url or 'pushed'}")
        except CommandNotAllowedError as exc:
            _cleanup_worktree(wt)
            return _finish(db, job, module, "failed", job.phase, f"command_not_allowed:{exc}")
        except Exception as exc:  # noqa: BLE001 — fail-secure : tout échec → failed propre
            logger.exception("run_codegen_job: échec")
            _cleanup_worktree(wt)
            return _finish(db, job, module, "failed", job.phase, _redact(str(exc))[:500])


@shared_task(bind=True, max_retries=0)
def reap_worktrees(self) -> dict[str, object]:  # noqa: ANN001
    """Nettoie les worktrees orphelins du volume (prune + suppression best-effort)."""
    base = worktree_base()
    removed = 0
    if (repo_dir() / ".git").exists():
        try:
            _run(["git", "worktree", "prune"], cwd=repo_dir(), timeout=60)
        except Exception:  # noqa: BLE001, S110
            pass
    if base.exists():
        for child in base.iterdir():
            if child.is_dir() and child.name.startswith("wt-"):
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
    return {"status": "ok", "removed": removed}
