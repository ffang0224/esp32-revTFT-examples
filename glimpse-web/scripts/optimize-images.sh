#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "Converting usecase images..."
for i in 1 2 3 4 5; do
  ffmpeg -y -i "$ROOT/usecases/case$i.png" \
    -vf "scale='min(1400,iw)':-2" \
    -c:v libwebp -quality 82 -lossless 0 \
    "$ROOT/usecases/case$i.webp"
  echo "  case$i.webp: $(du -sh "$ROOT/usecases/case$i.webp" | cut -f1)"
done

echo "Converting hardware diagram..."
ffmpeg -y -i "$ROOT/public/glimpse-hardware-list.png" \
  -vf "scale='min(2400,iw)':-2" \
  -c:v libwebp -quality 82 -lossless 0 \
  "$ROOT/public/glimpse-hardware-list.webp"
echo "  glimpse-hardware-list.webp: $(du -sh "$ROOT/public/glimpse-hardware-list.webp" | cut -f1)"

echo "All done."
