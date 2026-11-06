import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import settings
from app.hosting import mount_frontend
from app.main import app


def test_frontend_routes_and_assets(tmp_path):
    (tmp_path / "index.html").write_text("<html>VerdePerto</html>")
    (tmp_path / "main.js").write_text("console.log('frontend')")
    frontend = FastAPI()

    @frontend.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_frontend(frontend, str(tmp_path))
    client = TestClient(frontend)
    for path in ("/", "/explorar", "/ofertas/1", "/conversas/2"):
        response = client.get(path)
        assert response.status_code == 200
        assert "VerdePerto" in response.text
    assert client.get("/main.js").status_code == 200
    assert client.get("/api/health").json() == {"status": "ok"}
    for path in ("/api/unknown", "/missing.js", "/.env", "/.git/config"):
        assert client.get(path).status_code == 404


def test_frontend_requires_build(tmp_path):
    with pytest.raises(RuntimeError, match="não compilado"):
        mount_frontend(FastAPI(), str(tmp_path))


def test_https_session_and_origin_validation(monkeypatch):
    # Não acessa o banco real: um login inválido é validado em fixture isolada
    # pelo teste em test_api.py; aqui cobrimos a barreira de origem antes da API.
    monkeypatch.setattr(settings, "environment", "local-hosting")
    client = TestClient(app, base_url="https://verdeperto.example")
    blocked = client.post(
        "/api/auth/logout", headers={"Origin": "https://other.example"}
    )
    assert blocked.status_code == 403


def test_local_hosting_sets_secure_cookie(monkeypatch):
    from types import SimpleNamespace
    from fastapi import Response
    from app.main import new_session

    monkeypatch.setattr(settings, "environment", "local-hosting")

    class Session:
        def add(self, _):
            pass

        def commit(self):
            pass

    response = Response()
    new_session(response, Session(), SimpleNamespace(id=1))
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
