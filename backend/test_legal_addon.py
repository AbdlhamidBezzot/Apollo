"""Legal test Stremio-compatible add-on server for Apollo integration testing.

Serves public domain video content (Big Buck Bunny) and sample WebVTT subtitles.
Run with: python test_legal_addon.py (starts on http://127.0.0.1:8005)
"""

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Legal Test Addon", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MANIFEST = {
    "id": "org.apollo.legaltestaddon",
    "version": "1.0.0",
    "name": "Legal Public Domain Test Addon",
    "description": "Provides legal public domain streams (Big Buck Bunny) for Apollo testing.",
    "resources": ["stream", "subtitles"],
    "types": ["movie", "series"],
    "idPrefixes": ["tt"],
}

# Big Buck Bunny open media links
BIG_BUCK_BUNNY_STREAM = {
    "name": "Apollo Test",
    "title": "Big Buck Bunny (Public Domain) - 1080p Direct MP4",
    "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "behaviorHints": {
        "notSupported": False,
    },
}

ELEPHANTS_DREAM_STREAM = {
    "name": "Apollo Test 2",
    "title": "Elephants Dream (Public Domain) - 720p Direct MP4",
    "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "behaviorHints": {
        "notSupported": False,
    },
}

SAMPLE_SUBTITLES = [
    {
        "id": "bbb_sub_en",
        "url": "https://raw.githubusercontent.com/videojs/video.js/main/docs/examples/elephantsdream/captions.en.vtt",
        "lang": "en",
    },
    {
        "id": "bbb_sub_fr",
        "url": "https://raw.githubusercontent.com/videojs/video.js/main/docs/examples/elephantsdream/captions.sv.vtt",
        "lang": "fr",
    },
]


@app.get("/manifest.json")
async def get_manifest():
    return MANIFEST


@app.get("/stream/{type}/{id}.json")
async def get_streams(type: str, id: str):
    if type not in ("movie", "series"):
        return {"streams": []}

    # Clean extension if provided
    clean_id = id.replace(".json", "")

    # Always return test public domain streams for testing
    return {
        "streams": [
            BIG_BUCK_BUNNY_STREAM,
            ELEPHANTS_DREAM_STREAM,
        ]
    }


@app.get("/subtitles/{type}/{id}.json")
async def get_subtitles(type: str, id: str):
    if type not in ("movie", "series"):
        return {"subtitles": []}

    return {"subtitles": SAMPLE_SUBTITLES}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)
