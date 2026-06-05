"""Tests purs de l'exécuteur de contrôle serveurs (`app.tasks.infra_control`).

Sécurité-critique : on vérifie que la **whitelist d'actions** rejette tout ce qui n'est
pas `restart/stop/start/pause` (jamais `kill`/`remove`), le mapping `suspend→pause`, le
filtre de résolution par label compose, et la lecture du proxy. L'exécution réelle
(appels Docker) n'est pas testée ici (mockée-impossible en CI ; gardée par flag + profil).
"""

import json

import pytest

from app.tasks.infra_control import _compose_filter, docker_proxy_url, op_for_action


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        ("restart", "restart"),
        ("stop", "stop"),
        ("start", "start"),
        ("suspend", "pause"),  # Docker n'a pas 'suspend'
        ("pause", "pause"),
        # Hors whitelist → None (jamais exécuté) : c'est LE garde-fou de sécurité.
        ("kill", None),
        ("remove", None),
        ("rm", None),
        ("exec", None),
        ("", None),
    ],
)
def test_op_for_action_whitelist(action: str, expected: str | None) -> None:
    assert op_for_action(action) == expected


def test_compose_filter_targets_service_by_label() -> None:
    raw = _compose_filter("nginx")
    parsed = json.loads(raw)
    assert parsed == {"label": ["com.docker.compose.service=nginx"]}


def test_docker_proxy_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DOCKER_PROXY_URL", raising=False)
    assert docker_proxy_url() is None
    monkeypatch.setenv("DOCKER_PROXY_URL", "http://docker-socket-proxy:2375")
    assert docker_proxy_url() == "http://docker-socket-proxy:2375"
    monkeypatch.setenv("DOCKER_PROXY_URL", "  ")
    assert docker_proxy_url() is None
