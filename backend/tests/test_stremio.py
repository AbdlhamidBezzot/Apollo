from fastapi.testclient import TestClient


def get_client() -> TestClient:
    from app.main import app

    return TestClient(app)


def test_subtitles_endpoint_smoke():
    with get_client() as client:
        r = client.get("/api/v1/subtitles?tmdb_id=550&media_type=movie")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "subtitles" in data
        assert "imdb_id" in data


def test_watchhub_playback_provider():
    with get_client() as client:
        r = client.get("/api/v1/playback/providers")
        assert r.status_code == 200
        providers = r.json()
        assert "watchhub" in providers


def test_playback_resolve_watchhub():
    with get_client() as client:
        r = client.post(
            "/api/v1/playback/resolve",
            json={"tmdb_id": 550, "media_type": "movie", "provider": "watchhub"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["provider"] == "watchhub"
        assert "stream_url" in data
