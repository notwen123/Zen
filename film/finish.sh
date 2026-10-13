#!/usr/bin/env bash
# Frames + mix -> final MP4 (1080p30 H.264, AAC 320k, -14 LUFS) and captions.
set -euo pipefail
cd "$(dirname "$0")"
OUT=out/STOCKBACK-demo.mp4

# two-pass loudness normalization of the mix to -14 LUFS / -1 dBTP
J=$(ffmpeg -hide_banner -i audio/mix_raw.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$J" | sed -n 's/.*"input_i" : "\(.*\)".*/\1/p'); mtp=$(echo "$J" | sed -n 's/.*"input_tp" : "\(.*\)".*/\1/p')
ml=$(echo "$J" | sed -n 's/.*"input_lra" : "\(.*\)".*/\1/p'); mt=$(echo "$J" | sed -n 's/.*"input_thresh" : "\(.*\)".*/\1/p')
ffmpeg -y -hide_banner -loglevel error -i audio/mix_raw.wav \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$ml:measured_thresh=$mt:linear=true,aresample=48000" \
  -c:a pcm_s24le audio/mix.wav

ffmpeg -y -hide_banner -loglevel error -framerate 30 -i frames/%05d.jpg -i audio/mix.wav \
  -c:v libx264 -preset slow -crf 15 -profile:v high -pix_fmt yuv420p -tune film \
  -c:a aac -b:a 320k -shortest -movflags +faststart \
  -metadata title="STOCKBACK: Every receipt, sealed." "$OUT"

# captions from the voiceover timeline
node -e '
const tl=require("./timeline.json"), sc=require("./script.json"), d=require("./audio/vo/durations.json").durations;
const txt=Object.fromEntries(sc.lines.map(l=>[l.id,l.text]));
const ts=s=>{const ms=Math.round(s*1000),h=Math.floor(ms/36e5),m=Math.floor(ms/6e4)%60,sec=Math.floor(ms/1e3)%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`};
console.log(tl.vo.map(([id,t],i)=>`${i+1}\n${ts(t)} --> ${ts(t+d[id])}\n${txt[id]}\n`).join("\n"));' > out/STOCKBACK-demo.srt

ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
