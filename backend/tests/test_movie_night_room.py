from fastapi.testclient import TestClient


def _client() -> TestClient:
    from app.main import app

    return TestClient(app)


def test_movie_night_room_create_join_prefs():
    with _client() as client:
        client.post(
            "/api/v1/auth/register",
            json={"email": "roomhost@example.com", "password": "password123", "name": "Host"},
        )

        r = client.post("/api/v1/movie-night-room")
        assert r.status_code == 201, r.text
        room = r.json()
        assert room["code"].startswith("APLO-")
        assert room["is_host"] is True
        host_token = room["token"]
        code = room["code"]

        # Status shows the host with no prefs yet.
        r = client.get(f"/api/v1/movie-night-room/{code}")
        assert r.status_code == 200
        assert r.json()["status"] == "collecting"
        assert len(r.json()["participants"]) == 1

        # Host sets preferences.
        r = client.put(
            f"/api/v1/movie-night-room/{code}/preferences",
            params={"token": host_token},
            json={"favorite_genres": [35, 10749], "excluded_genres": [27], "max_runtime_minutes": 120},
        )
        assert r.status_code == 200, r.text
        assert r.json()["participants"][0]["has_preferences"] is True

        # A guest joins and answers preferences.
        r = client.post(
            f"/api/v1/movie-night-room/{code}/join",
            json={"guest_name": "Sam"},
        )
        assert r.status_code == 200, r.text
        guest_data = r.json()
        assert guest_data["is_host"] is False
        assert guest_data["room"]["status"] == "collecting"
        guest_token = guest_data["token"]

        r = client.put(
            f"/api/v1/movie-night-room/{code}/preferences",
            params={"token": guest_token},
            json={"favorite_genres": [35], "excluded_genres": [53], "max_runtime_minutes": 100},
        )
        assert r.status_code == 200, r.text
        assert len(r.json()["participants"]) == 2

        # Guest cannot decide; expects host-only error surfaced as 400.
        r = client.post(
            f"/api/v1/movie-night-room/{code}/decide",
            params={"token": guest_token},
            json={"tmdb_id": 550, "media_type": "movie"},
        )
        assert r.status_code == 400


def test_movie_night_room_bad_code():
    with _client() as client:
        r = client.get("/api/v1/movie-night-room/NOPE-X")
        assert r.status_code == 404
