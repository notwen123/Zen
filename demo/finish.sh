#!/usr/bin/env bash
# Frames + mix -> final MP4 (1080p30 H.264, AAC 320k, -14 LUFS) and SRT captions.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
J=$(ffmpeg -hide_banner -i audio/mix_raw.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -y -hide_banner -loglevel error -i audio/mix_raw.wav \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):linear=true,aresample=48000" \
  -c:a pcm_s24le audio/mix.wav
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i frames/%05d.jpg -i audio/mix.wav \
  -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -tune film \
  -c:a aac -b:a 320k -shortest -movflags +faststart \
  -metadata title="Zen: every stock-back reward, settled on Monad (demo)" out/Zen-demo.mp4
node -e '
const tl=require("./timeline.json"), sc=require("./script.json"), d=require("./audio/vo/durations.json").durations;
const txt=Object.fromEntries(sc.lines.map(l=>[l.id,l.text]));
const ts=s=>{const ms=Math.round(s*1000),h=Math.floor(ms/36e5),m=Math.floor(ms/6e4)%60,sec=Math.floor(ms/1e3)%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`};
console.log(tl.vo.map(([id,t],i)=>`${i+1}\n${ts(t)} --> ${ts(t+d[id])}\n${txt[id]}\n`).join("\n"));' > out/Zen-demo.srt
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height -of compact out/Zen-demo.mp4
