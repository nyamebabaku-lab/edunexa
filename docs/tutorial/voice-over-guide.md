# Adding a Ghanaian voice-over

The video has captions burned in and a **silent audio track**, so a narrator can be added without re-recording the screen.

## 1. Record the narration
- Use `narration-script.md`. Each line has the time it starts (minute:second).
- A quiet room and a phone held about 20 cm from the mouth is enough. Record in a voice-memo app.
- Easiest: play `EduNexa-Tutorial.mp4` on a laptop and read along while recording, pausing the video if you need a breath.
- Or record one file per chapter (`chapters.txt` lists where each starts).

## 2a. Merge with one command (computer)
With [ffmpeg](https://ffmpeg.org) installed:

```bash
ffmpeg -i EduNexa-Tutorial.mp4 -i voiceover.m4a -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest EduNexa-Tutorial-voiced.mp4
```

If the voice starts a little early or late, shift it, e.g. 1.5 seconds later: add `-itsoffset 1.5` before `-i voiceover.m4a`.

## 2b. Merge on a phone (CapCut, free)
1. New project → add `EduNexa-Tutorial.mp4`.
2. Audio → Extracted/Sounds → add your recording(s) and drag each to its chapter time.
3. Optional: Text → Auto captions → Import `EduNexa-Tutorial.srt` instead of the burned-in captions.
4. Export 1080p.

## Subtitles
`EduNexa-Tutorial.srt` can be uploaded to YouTube or Facebook as closed captions (useful if you later export a version without burned-in captions).
