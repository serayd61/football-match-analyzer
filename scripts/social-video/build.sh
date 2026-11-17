#!/bin/bash
# usage: build.sh voice.(mp3|wav) out.mp4
set -e
VO="$1"; OUT="${2:-weekly.mp4}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO")
T1=3.2; T5=4.0
MID=$(python3 -c "print(max(12.0, $DUR + 1.0 - $T1 - $T5))")
T2=$(python3 -c "print(round($MID*0.42,2))"); T3=$(python3 -c "print(round($MID*0.30,2))"); T4=$(python3 -c "print(round($MID-$T2-$T3,2))")
TOT=$(python3 -c "print($T1+$T2+$T3+$T4+$T5)")
FPS=30
# Ken Burns via time-based scale+crop (fast). card 1080x1350 on 1080x1920 canvas
kb(){ # $1=zoom rate per sec, $2=crop y expr
  echo "scale=w='trunc(1080*(1+$1*t)/2)*2':h=-2:eval=frame,crop=1080:1350:'(iw-1080)/2':'$2',pad=1080:1920:0:285:color=0x0B1220"
}
ffmpeg -y -loglevel error \
 -loop 1 -framerate $FPS -t $T1 -i title.png \
 -loop 1 -framerate $FPS -t $T2 -i proof-en.png \
 -loop 1 -framerate $FPS -t $T3 -i proof-en.png \
 -loop 1 -framerate $FPS -t $T4 -i today-en.png \
 -loop 1 -framerate $FPS -t $T5 -i end.png \
 -i "$VO" \
 -filter_complex "
 [0:v]scale=1080:1920,setsar=1,fade=t=in:d=0.5,fade=t=out:st=$(python3 -c "print($T1-0.4)"):d=0.4[v0];
 [1:v]$(kb 0.012 '(ih-1350)/2'),setsar=1,fade=t=in:d=0.4,fade=t=out:st=$(python3 -c "print($T2-0.4)"):d=0.4[v1];
 [2:v]scale=1350:-2,crop=1080:1350:135:'ih-1350-30',pad=1080:1920:0:285:color=0x0B1220,setsar=1,fade=t=in:d=0.4,fade=t=out:st=$(python3 -c "print($T3-0.4)"):d=0.4[v2];
 [3:v]$(kb 0.012 '0'),setsar=1,fade=t=in:d=0.4,fade=t=out:st=$(python3 -c "print($T4-0.4)"):d=0.4[v3];
 [4:v]scale=1080:1920,setsar=1,fade=t=in:d=0.4,fade=t=out:st=$(python3 -c "print($T5-0.8)"):d=0.8[v4];
 [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,format=yuv420p[v];
 [5:a]adelay=1200|1200,apad,atrim=0:$TOT,afade=t=out:st=$(python3 -c "print($TOT-1.0)"):d=1.0[a]" \
 -map "[v]" -map "[a]" -r $FPS -c:v libx264 -preset veryfast -crf 20 -profile:v high -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of compact "$OUT"
