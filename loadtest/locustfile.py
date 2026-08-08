"""Basic Locust workload for Apollo's public content API.

Run with: locust -f locustfile.py --host http://localhost:8000
"""

from locust import HttpUser, between, task


class ApolloUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def browse_movies(self):
        self.client.get("/api/v1/content/popular?media_type=movie&page=1", name="/content/popular")

    @task(2)
    def search(self):
        self.client.get("/api/v1/content/search?q=batman&media_type=movie&page=1", name="/content/search")

    @task(1)
    def movie_detail(self):
        self.client.get("/api/v1/content/movie/550", name="/content/movie/:id")
