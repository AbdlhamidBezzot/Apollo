import os
import sys

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_apollo.db")

# Pin test-only values so the suite is deterministic regardless of backend/.env.
os.environ.setdefault("PLAYBACK_PROVIDER", "vidsrc")
os.environ.setdefault("TMDB_API_KEY", "")
os.environ.setdefault("TMDB_API_READ_ACCESS_TOKEN", "")
os.environ.setdefault("REDIS_URL", "redis://localhost:6399/0")
os.environ.setdefault("LLM_API_KEY", "")
os.environ.setdefault("LLM_MODEL", "")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
