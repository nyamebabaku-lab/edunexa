# Makes one narration clip per scene (British English voice) and writes their lengths in seconds.
import asyncio, json, subprocess, sys, re, os
import edge_tts
FF = os.path.join(os.path.dirname(__file__), 'node_modules/ffmpeg-static/ffmpeg')
scenes = json.load(open(sys.argv[1]))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
VOICE = 'en-GB-RyanNeural'
async def one(s):
    path = f"{out}/{s['id']}.mp3"
    await edge_tts.Communicate(s['text'], VOICE, rate=s.get('rate', '+4%')).save(path)
    info = subprocess.run([FF, '-i', path], capture_output=True, text=True).stderr
    h, m, sec = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info).groups()
    return s['id'], int(h) * 3600 + int(m) * 60 + float(sec)
async def main():
    durs = {}
    for s in scenes:  # one at a time: kinder to the service
        k, d = await one(s)
        durs[k] = round(d, 2)
        print(k, durs[k])
    json.dump(durs, open(f'{out}/durations.json', 'w'), indent=1)
    print('total', round(sum(durs.values()), 1))
asyncio.run(main())
