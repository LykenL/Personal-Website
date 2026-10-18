# Video pipeline

Turns a screen recording into web-ready assets for a project card.

## 1. Put the source in `raw/`

```
raw/data-copilot.mov      # your Google Drive export, 30-60 MB is fine
```

`raw/` and `*.mov` are gitignored — source footage never leaves your machine.

## 2. Find the good moments

Extract a contact sheet, one frame every few seconds, to pick timestamps:

```bash
python3 tools/clip_video.py --montage raw/data-copilot.mov \
  --times 0,5,10,15,20,25,30,35,40,45,50,55 \
  --out /tmp/frames
```

Frames land in `/tmp/frames/frames/` with a `frames.json` index.

## 3. Describe the clip

`clips/data-copilot.json`:

```json
{
  "source": "raw/data-copilot.mov",
  "out": "videos/data-copilot",
  "segments": [
    {"start": "00:12", "end": "00:34"},
    {"start": "01:02", "end": "01:20"}
  ],
  "focus": {"x": 0.42, "y": 0.30, "w": 0.34, "h": 0.34},
  "poster_at": "00:14",
  "crf": 30
}
```

- `segments` — multiple cuts joined in order; `mm:ss` or plain seconds.
- `focus` — a rectangle in fractions of the source frame. Produces a second
  file focused on that area (good for showing a small UI panel at readable size).
- `poster_at` — the still used before the video plays.
- `crf` — 26 = crisp, 30 = default (good balance), 33 = smallest.

## 4. Render

```bash
python3 tools/clip_video.py --spec clips/data-copilot.json
```

Outputs (default 1920x1080 H.264, `+faststart`, no audio track):

```
videos/data-copilot/
  poster.jpg
  clip.mp4            # all segments joined
  clip-focus.mp4      # zoomed into `focus`
  segments/seg01-...  # each cut on its own
  manifest.json       # file sizes + source metadata
```

## 5. Ship it

The card at `#dc-video-slot` already points at `videos/data-copilot/clip.mp4`
and `poster.jpg`. Generate those two files and the placeholder is replaced
automatically — no HTML edit needed.

Only commit generated assets once they are small (`clip.mp4` under ~5 MB).
`.gitignore` keeps them out of git by default; force-add once you are happy:

```bash
git add -f videos/data-copilot/clip.mp4 videos/data-copilot/poster.jpg
```

## Why not embed Google Drive directly

A Drive `preview` iframe cannot autoplay muted, cannot be paused programmatically,
ignores aspect ratio, and large files are throttled after a few views. A 3 MB
H.264 local file starts instantly and works offline.
