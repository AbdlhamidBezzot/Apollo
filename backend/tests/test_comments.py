from fastapi.testclient import TestClient


def get_client() -> TestClient:
    from app.main import app

    return TestClient(app)


def test_comments_and_reactions_flow():
    with get_client() as client:
        # 1. Register a user
        reg = client.post(
            "/api/v1/auth/register",
            json={"email": "commenter@example.com", "password": "password123", "name": "Commenter"},
        )
        assert reg.status_code == 201

        # 2. Get comments (initially empty)
        r = client.get("/api/v1/comments/movie/550")
        assert r.status_code == 200
        assert r.json() == []

        # 3. Post a comment
        comment_res = client.post(
            "/api/v1/comments",
            json={"tmdb_id": 550, "media_type": "movie", "text": "Great movie!"},
        )
        assert comment_res.status_code == 201
        data = comment_res.json()
        assert data["text"] == "Great movie!"
        assert data["author_name"] == "Commenter"

        # 4. Get comments now
        r = client.get("/api/v1/comments/movie/550")
        assert r.status_code == 200
        assert len(r.json()) == 1

        # 5. Like the comment
        comment_id = data["id"]
        like_res = client.post(f"/api/v1/comments/{comment_id}/like")
        assert like_res.status_code == 200
        assert like_res.json()["liked"] is True

        # 6. React to title (Like)
        rx_res = client.post(
            "/api/v1/reactions",
            json={"tmdb_id": 550, "media_type": "movie", "reaction": "like"},
        )
        assert rx_res.status_code == 200
        assert rx_res.json()["likes_count"] == 1
        assert rx_res.json()["user_reaction"] == "like"

        # 7. Update Avatar
        avatar_res = client.put(
            "/api/v1/me/avatar",
            json={"avatar": "https://example.com/avatar.png"},
        )
        assert avatar_res.status_code == 200
        assert avatar_res.json()["avatar"] == "https://example.com/avatar.png"
