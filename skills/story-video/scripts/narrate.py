"""Narrate storyboard scenes to MP3 with Microsoft's neural voices through edge-tts.

Usage: narrate.py <storyboard.json> <audio_dir> --only 01,03 [--dry-run]

This sends the narration text to Microsoft's speech service through an unofficial
route. The skill asks for consent before it runs this script. Run it with the
Python from the story-video tools venv.
"""
import argparse
import asyncio
import json
import os
import sys

DEFAULT_VOICE = "en-IN-NeerjaExpressiveNeural"
DEFAULT_RATE = "+6%"
MAX_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2


def clean_text(text):
    return text.replace("A.I.", "AI")


async def narrate_scene(edge_tts, scene, voice, rate, out_path):
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            await edge_tts.Communicate(clean_text(scene["narration"]), voice, rate=rate).save(out_path)
            if os.path.getsize(out_path) > 0:
                return
            last_error = "empty audio file"
        except Exception as error:  # edge-tts raises several unrelated types on network failure
            last_error = error
        print(f"retry scene {scene['id']} ({attempt}/{MAX_ATTEMPTS}): {last_error}", file=sys.stderr)
        await asyncio.sleep(RETRY_DELAY_SECONDS)
    raise SystemExit(f"error: scene {scene['id']}: narration failed after {MAX_ATTEMPTS} attempts: {last_error}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("storyboard")
    parser.add_argument("audio_dir")
    parser.add_argument("--only", required=True, help="comma-separated scene ids")
    parser.add_argument("--dry-run", action="store_true")
    options = parser.parse_args()

    with open(options.storyboard, encoding="utf-8") as handle:
        board = json.load(handle)
    voice = board.get("voice") or DEFAULT_VOICE
    rate = board.get("rate") or DEFAULT_RATE
    by_id = {scene["id"]: scene for scene in board["scenes"]}
    wanted = [item.strip() for item in options.only.split(",") if item.strip()]
    for scene_id in wanted:
        if scene_id not in by_id:
            raise SystemExit(f"error: unknown scene id: {scene_id}")

    if options.dry_run:
        for scene_id in wanted:
            print(f"would narrate {scene_id} voice={voice} rate={rate}")
        return

    import edge_tts  # imported late so --dry-run works without the package

    os.makedirs(options.audio_dir, exist_ok=True)
    for scene_id in wanted:
        out_path = os.path.join(options.audio_dir, f"scene-{scene_id}.mp3")
        await narrate_scene(edge_tts, by_id[scene_id], voice, rate, out_path)
        print(f"narrated {scene_id}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
