#!/usr/bin/env python3

import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
SOURCE_DIR = os.path.join(ROOT, "animation cycles copy")
OUTPUT_DIR = os.path.join(ROOT, "public", "frames-alpha")
TARGET_WIDTH = 1600
TARGET_HEIGHT = 900
WEBP_QUALITY = 85
SCALE_FILTER = (
    f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=decrease"
)


def frame_key(path: str) -> int:
    match = re.search(r"(\d+)", os.path.basename(path))
    if not match:
        raise ValueError(f"Could not extract frame number from {path}")
    return int(match.group(1))


def main() -> int:
    frames = [
        path
        for path in glob.glob(os.path.join(SOURCE_DIR, "*.png"))
        if os.path.isfile(path)
    ]
    frames.sort(key=frame_key)

    if not frames:
        print(f"No PNG frames found in {SOURCE_DIR}", file=sys.stderr)
        return 1

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for index, frame in enumerate(frames, start=1):
        output = os.path.join(OUTPUT_DIR, f"f{index:04d}.webp")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                frame,
                "-vf",
                SCALE_FILTER,
                "-c:v",
                "libwebp",
                "-quality",
                str(WEBP_QUALITY),
                "-compression_level",
                "6",
                "-preset",
                "picture",
                "-pix_fmt",
                "yuva420p",
                output,
            ],
            check=True,
        )
        if index % 10 == 0 or index == len(frames):
            print(f"Built {index}/{len(frames)}")

    print(f"Wrote {len(frames)} optimized frames to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
