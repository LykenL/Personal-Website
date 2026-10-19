#!/usr/bin/env python3
"""
Render the Agentic RecipeRAG demo clip.

Source: raw/agenticrag.mov  (2722x1596, 34.82fps, 95.67s) -- a desktop app
recording, no browser chrome to strip.

Timeline (source seconds):
  07-09    highlight the "+ New chat" button
  23-30    typing the prompt in the composer
  31-34    cursor moves to the "Nut allergy" toggle
  34.5-36  sending the prompt
  37-104?  answer streaming (centre of the interface, full height)
  77-80    cursor selects the grey italic disclaimer line
  81-91    right-hand sources column
  92-end   back to the full frame, then fade out

Camera moves are automatic (push-in, hold) and nothing is ever pulled back out:
pulling back before a cut reads as a violent jump.

Usage: python3 tools/build_rag.py [--dry-run]
"""
import json
import os
import subprocess
import sys

FFMPEG = "/Users/lykenl/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "raw", "agenticrag.mov")
OUT = os.path.join(ROOT, "videos", "recipe-rag")
TMP = os.path.join(ROOT, ".build_tmp_rag")

SRC_W, SRC_H = 2722, 1596
OUT_W, OUT_H = 1920, 1080
FPS = 30
XFADE = 0.15
ZOOM_IN = 0.5
CRF = 26
ENDING_FADE = 1.3

# The app window fills the frame; only a sliver of black sits at the edges.
# Largest 16:9 window inside the source frame:
PAGE_TOP = 0
PAGE_H = SRC_H
PAGE_W = SRC_W

# Layout measured from the frames (fractions of the full frame):
#   left sidebar  : 0.00 .. 0.29
#   chat column   : 0.29 .. 0.78
#   sources column: 0.78 .. 1.00
#   composer      : y 0.50 .. 0.58 (before send) / 0.86 .. 0.98 (after send)
#   "+ New chat"  : x 0.065 .. 0.145, y 0.037 .. 0.057
#   Nut toggle    : x 0.135 .. 0.152, y 0.198 .. 0.213
#   italic note   : x 0.30 .. 0.62, y 0.335 .. 0.360 (varies with scroll)


def box(cx, cy, frac=0.6):
    """16:9 focus box centred on (cx, cy) in frame fractions, kept inside the frame."""
    w = PAGE_W * frac
    h = w * 9 / 16
    if h > PAGE_H:
        h = PAGE_H
        w = h * 16 / 9
    x = min(max(cx * PAGE_W - w / 2, 0), PAGE_W - w)
    y = min(max(PAGE_TOP + cy * PAGE_H - h / 2, PAGE_TOP), PAGE_TOP + PAGE_H - h)
    return (x / PAGE_W, (y - PAGE_TOP) / PAGE_H, w / PAGE_W, h / PAGE_H)


def wide(cx=0.5, cy=0.5, frac=0.86):
    return box(cx, cy, frac)


SEGMENTS = [
    # "+ New chat": sidebar top, button readable and clearly the subject
    {"s": 7.0, "e": 9.0, "focus": box(0.17, 0.13, 0.42), "label": "new-chat"},
    # typing: composer plus the heading so the context reads
    {"s": 23.0, "e": 30.0, "focus": box(0.58, 0.46, 0.66), "label": "typing"},
    # cursor reaches the Nut allergy toggle (y ~0.43 in the sidebar)
    {"s": 31.0, "e": 34.0, "focus": box(0.20, 0.42, 0.40), "label": "nut-toggle"},
    # sending: composer + send button
    {"s": 34.5, "e": 36.0, "focus": box(0.58, 0.50, 0.62), "label": "send"},
    # answer streaming: middle column, FULL height (no vertical crop)
    {"s": 37.0, "e": 64.0, "focus": (0.29, 0.02, 0.49, 0.96), "label": "streaming",
     "no_zoom": True},
    # cursor selects the italic disclaimer
    {"s": 77.0, "e": 80.0, "focus": box(0.52, 0.40, 0.60), "label": "italics"},
    # right-hand sources column
    {"s": 81.0, "e": 91.0, "focus": box(0.84, 0.48, 0.44), "label": "sources"},
    # pull back to the whole interface, then fade
    {"s": 92.0, "e": 95.5, "focus": None, "label": "outro"},
]


def fit():
    """Fill 1920x1080 without exposing an edge."""
    return (f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
            f"crop={OUT_W}:{OUT_H}:x=(iw-{OUT_W})/2:y=(ih-{OUT_H})/2,setsar=1")


def expr_for(seg):
    dur = seg["e"] - seg["s"]
    if seg["focus"] is None:
        return f"crop={PAGE_W}:{PAGE_H}:0:0,{fit()}", dur

    fx, fy, fw, fh = seg["focus"]
    bw = PAGE_W * fw
    bh = PAGE_H * fh
    bx = PAGE_W * fx
    by = PAGE_TOP + PAGE_H * fy

    if seg.get("no_zoom"):
        # fixed window, no push-in: the streaming region must stay rock steady
        return (f"crop={int(bw)}:{int(bh)}:{int(bx)}:{int(by)},{fit()}"), dur

    ss = lambda v: f"(if(lt({v},0),0,if(gt({v},1),1,{v}*{v}*(3-2*{v}))))"
    prog = f"if(lt(t,{ZOOM_IN}),{ss(f't/{ZOOM_IN}')},1)"
    cw = f"({PAGE_W}-({PAGE_W}-{bw})*{prog})"
    ch = f"({cw}*9/16)"
    fcx = bx + bw / 2
    fcy = by + bh / 2
    cx = f"min(max({fcx}-{cw}/2,0),{PAGE_W}-{cw})"
    cy = f"min(max({fcy}-{ch}/2,{PAGE_TOP}),{PAGE_TOP}+{PAGE_H}-{ch})"
    return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',{fit()}"), dur


def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + (res.stderr or "")[-3000:])
        sys.exit(1)


def build(dry=False):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    parts = []
    for i, seg in enumerate(SEGMENTS):
        chain, dur = expr_for(seg)
        out = os.path.join(TMP, f"seg{i:02d}.mp4")
        vf = f"fps={FPS},{chain},format=yuv420p"
        cmd = [FFMPEG, "-y", "-ss", f"{seg['s']}", "-to", f"{seg['e']}",
               "-i", SRC, "-an", "-vf", vf, "-t", f"{dur:.3f}",
               "-c:v", "libx264", "-preset", "medium", "-crf", str(CRF),
               "-pix_fmt", "yuv420p", "-r", str(FPS), out]
        if dry:
            print(f"[{i}] {seg['label']}: {seg['s']}-{seg['e']} -> {dur:.2f}s")
        else:
            print(f"rendering {seg['label']} ({dur:.2f}s)...")
            run(cmd)
        parts.append((out, dur, seg["label"]))

    if dry:
        total = sum(d for _, d, _ in parts) - XFADE * (len(parts) - 1)
        print(f"\ntotal: {total:.2f}s across {len(parts)} segments")
        return

    inputs = []
    for p, _, _ in parts:
        inputs += ["-i", p]

    filters = []
    prev = "[0:v]"
    acc = parts[0][1]
    for i in range(1, len(parts)):
        offset = acc - XFADE
        label = f"[x{i}]" if i < len(parts) - 1 else "[linked]"
        filters.append(f"{prev}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}{label}")
        prev = label
        acc = offset + parts[i][1]

    end_start = acc - ENDING_FADE
    filters.append(f"[linked]fade=t=out:st={end_start:.3f}:d={ENDING_FADE}:color=black,"
                   f"format=yuv420p[vout]")

    final = os.path.join(OUT, "clip.mp4")
    run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filters),
         "-map", "[vout]", "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-movflags", "+faststart", final])

    poster = os.path.join(OUT, "poster.jpg")
    run([FFMPEG, "-y", "-ss", "1.2", "-i", final, "-frames:v", "1", "-q:v", "3", poster])

    report = {"output": final, "poster": poster, "bytes": os.path.getsize(final),
              "total_seconds": round(acc, 2),
              "segments": [{"label": l, "seconds": round(d, 2)} for _, d, l in parts],
              "crossfade": XFADE, "ending_fade": ENDING_FADE}
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    build(dry="--dry-run" in sys.argv)
