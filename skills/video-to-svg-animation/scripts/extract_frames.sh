#!/usr/bin/env bash
# Usage: extract_frames.sh <video> <outdir> [fps_for_sheet=3]
# Prints stream info, writes <outdir>/contact.png (tile sheet) and full-res stills
# at ~25/50/75/90% of the duration (<outdir>/full_*.png).
set -euo pipefail
video="$1"; out="$2"; fps="${3:-3}"
mkdir -p "$out/frames"

ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,duration \
  -of default=nw=1 "$video"

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")

ffmpeg -v error -y -i "$video" -vf "fps=$fps,scale=640:-1" "$out/frames/f_%03d.png"
n=$(ls "$out/frames" | wc -l)
cols=4; rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -pattern_type glob -i "$out/frames/f_*.png" \
  -filter_complex "tile=${cols}x${rows}" -frames:v 1 "$out/contact.png"

for p in 0.25 0.50 0.75 0.90; do
  t=$(python3 -c "print(round($dur*$p,2))")
  ffmpeg -v error -y -ss "$t" -i "$video" -frames:v 1 "$out/full_${t}.png"
done
echo "contact sheet: $out/contact.png  ($n frames @ ${fps}fps)"
