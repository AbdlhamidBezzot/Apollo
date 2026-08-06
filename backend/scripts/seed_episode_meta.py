"""Seed per-episode anime metadata (canon/filler, story arc, audio tracks).

Usage:
    python -m scripts.seed_episode_meta path/to/episodes.json

JSON format:
    {
      "tmdb_id": 1429,
      "audio_languages": ["ja", "en"],
      "episodes": [
        {"season": 1, "episode": 1, "is_filler": false, "is_canon": true,
         "arc_name": "Battle Tendency", "audio_languages": ["ja", "en"]}
      ]
    }

Top-level "audio_languages" acts as the default for episodes that omit it.
Upserts rows; running again with corrected data updates existing entries.
"""

import json
import sys

from app.db import SessionLocal, init_db
from app.models import EpisodeMetadata


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        data = json.load(fh)

    tmdb_id = int(data["tmdb_id"])
    default_audio = data.get("audio_languages", [])

    init_db()
    db = SessionLocal()
    try:
        for ep in data["episodes"]:
            season = int(ep["season"])
            episode = int(ep["episode"])
            row = (
                db.query(EpisodeMetadata)
                .filter(
                    EpisodeMetadata.tmdb_id == tmdb_id,
                    EpisodeMetadata.season_number == season,
                    EpisodeMetadata.episode_number == episode,
                )
                .one_or_none()
            )
            if row is None:
                row = EpisodeMetadata(tmdb_id=tmdb_id, season_number=season, episode_number=episode)
                db.add(row)
            row.is_filler = bool(ep.get("is_filler", False))
            row.is_canon = bool(ep.get("is_canon", not row.is_filler))
            row.arc_name = ep.get("arc_name")
            row.audio_languages = ep.get("audio_languages", default_audio)
        db.commit()
    finally:
        db.close()

    print(f"Seeded {len(data['episodes'])} episode metadata rows for tmdb_id={tmdb_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
