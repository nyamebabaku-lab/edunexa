# Puts the narration clips at their scene times over the original music (ducked under the voice), then onto the video.
# usage: mix.py video.webm marks.json voicedir trim_seconds out.mp4
import json, subprocess, sys, os, re
D = os.path.dirname(os.path.abspath(__file__))
FF = f'{D}/node_modules/ffmpeg-static/ffmpeg'
PY = f'{D}/../venv/bin/python'
video, marks, vdir, trim, dest = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], float(sys.argv[4]), sys.argv[5]
info = subprocess.run([FF, '-i', video], capture_output=True, text=True).stderr
h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info).groups()
total = int(h) * 3600 + int(m) * 60 + float(s) - trim
bed = f'{vdir}/bed.wav'
subprocess.run([PY, f'{D}/../music/music.py', str(total + 1), bed], check=True)
inputs, parts = [], []
for i, mk in enumerate(marks):
    clip = f"{vdir}/{mk['id']}.mp3"
    if not os.path.exists(clip):
        continue
    inputs += ['-i', clip]
    ms = max(0, int((mk['at'] - trim + 0.35) * 1000))
    parts.append(f'[{len(parts) + 2}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{len(parts)}]')
n = len(parts)
fc = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0:duration=longest,volume=1.6,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=150[voice];'
fc += '[voice]asplit=2[vo][key];'
fc += f'[1:a]aresample=44100,volume=0.30,afade=t=in:st=0:d=1.5,afade=t=out:st={max(0, total - 3):.2f}:d=3[mus];'
fc += '[mus][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];'
fc += '[vo][duck]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[a]'
cmd = [FF, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(trim), '-i', video, '-i', bed] + inputs + [
    '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
    '-vf', 'fade=t=in:st=0:d=0.5', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-t', f'{total:.2f}', '-movflags', '+faststart', dest]
subprocess.run(cmd, check=True)
print('wrote', dest, round(total, 1), 's')
