from fastapi.testclient import TestClient


def _clean_db_file():
    import os

    for name in ("test_apollo.db", "test_apollo.db-shm", "test_apollo.db-wal"):
        try:
            os.remove(name)
        except OSError:
            pass


_clean_db_file()


def get_client() -> TestClient:
    from app.main import app

    return TestClient(app)


def test_health():
    with get_client() as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


def test_register_login_logout_flow():
    with get_client() as client:
        r = client.post(
            "/api/v1/auth/register",
            json={"email": "user@example.com", "password": "correct-horse-battery", "name": "Test User"},
        )
        assert r.status_code == 201, r.text
        assert "apollo_access" in client.cookies

        r = client.get("/api/v1/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "user@example.com"

        r = client.get("/api/v1/me/profiles")
        assert r.status_code == 200
        assert len(r.json()) == 1  # default profile auto-created

        r = client.post("/api/v1/auth/logout")
        assert r.status_code == 204

        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401


def test_login_wrong_password():
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "alice@example.com", "password": "password123", "name": "Alice"},
        )
        r = client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "wrongpass"})
        assert r.status_code == 401


def test_delete_account():
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "dave@example.com", "password": "password123", "name": "Dave"},
        )
        r = client.delete("/api/v1/auth/account")
        assert r.status_code == 204, r.text
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401


def test_history_delete_entry():
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "frank@example.com", "password": "password123", "name": "Frank"},
        )
        client.put("/api/v1/me/history", json={"tmdb_id": 550, "media_type": "movie", "progress_seconds": 600})
        r = client.get("/api/v1/me/history")
        assert len(r.json()) == 1

        r = client.delete("/api/v1/me/history/movie/550")
        assert r.status_code == 204, r.text
        r = client.get("/api/v1/me/history")
        assert r.json() == []


def test_watchlist_requires_auth():
    with get_client() as client:
        r = client.get("/api/v1/me/watchlist")
        assert r.status_code == 401


def test_recommend_requires_auth():
    with get_client() as client:
        r = client.get("/api/v1/content/recommend")
        assert r.status_code == 401


def test_recommend_empty_without_signals():
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "gina@example.com", "password": "password123", "name": "Gina"},
        )
        r = client.get("/api/v1/content/recommend")
        assert r.status_code == 200, r.text
        assert r.json()["results"] == []


def test_playback_resolve_vidsrc():
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "bob@example.com", "password": "password123", "name": "Bob"},
        )
        r = client.post(
            "/api/v1/playback/resolve",
            json={"tmdb_id": 550, "media_type": "movie"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["provider"] == "vidsrc"
        assert data["content_type"] == "text/html"
        assert data["stream_url"] == "https://vidsrc-embed.ru/embed/movie/550"


async def test_playback_resolve_vidsrc_tv():
    from app.services.playback.base import get_provider

    result = await get_provider("vidsrc").resolve(1399, "tv", season=1, episode=1)
    assert result.stream_url == "https://vidsrc-embed.ru/embed/tv/1399/1-1"
    assert result.content_type == "text/html"


def test_chatbot_returns_suggestions_without_tmdb():
    # Without a TMDB key the chatbot degrades gracefully: returns 200 with
    # an empty suggestion list rather than crashing.
    with get_client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "carol@example.com", "password": "password123", "name": "Carol"},
        )
        r = client.post("/api/v1/chat", json={"message": "pick something for tonight"})
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data
        assert "suggested_titles" in data
