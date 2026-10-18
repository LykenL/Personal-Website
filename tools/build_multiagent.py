#!/usr/bin/env python3
"""
Render the Multi-Agent Data Copilot demo from the raw screen recording.

Source: raw/multiagent_record.mov  (2884x1982, 57fps, 98.77s)
The top of the recording contains the browser tab strip, which is cropped off
for every frame, so "full view" always means the page content only.

Timeline (source seconds):
  04-12  prompt typing          full view, 1.0x
  13-61  waiting for the LLM    DROPPED
  62-73  LLM output appears     focus centre-right, 1.25x
  74-77  scrolling down         DROPPED
  78-86  chart renders          focus bottom-right, 1.1x
  87-92  source code output     focus bottom-right, 1.1x
  >92    DROPPED

Each focus segment pushes in from full view, holds, and pulls back out, so the
zoom transition is part of the clip rather than a cut.

Usage: python3 tools/build_multiagent.py [--dry-run]
"""
import json
import os
import subprocess
import sys

FFMPEG = "/Users/lykenl/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "raw", "multiagent_record.mov")
OUT = os.path.join(ROOT, "videos", "multi-agent")
TMP = os.path.join(ROOT, ".build_tmp")

SRC_W, SRC_H = 2884, 1982
CHROME_BOTTOM = 0.1505          # fraction of source height occupied by browser UI
OUT_W, OUT_H = 1920, 1080
FPS = 30
XFADE = 0.15                    # crossfade length between segments, seconds
ENDING_FADE = 0.8               # fade-to-black duration at the very end
ENDING_TAIL = 0.3               # black hold after the fade finishes
ZOOM_IN = 0.55                  # seconds to push from full view into the focus box
ZOOM_OUT = 0.55                 # seconds to pull back out
CRF = 26
FRAME_RIGHT = 0.965
# Code segment framing. The code block itself spans 0.044..0.801 of the page
# (measured on frames 88-91s, where the layout is stable). A window of that width
# upscales to 1920 at 0.88x -- close to native size, with the whole block visible.
CODE_LEFT = 0.040
CODE_RIGHT = 0.805            # right edge of page content, used for the code window
BOTTOM_BAND_PAD = 0.06     # gap below the composer before the crop bottom             # fraction of the page height promoted to centre in full view


def page_frame():
    """The page-only area of the source frame (browser chrome removed)."""
    top = int(SRC_H * CHROME_BOTTOM)
    return 0, top, SRC_W, SRC_H - top


def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + (res.stderr or "")[-3000:])
        sys.exit(1)
    return res.stderr


# ---------------------------------------------------------------------------
# Segment definitions. Focus boxes are fractions of the PAGE frame (x,y,w,h).
# Every box is 16:9 so it maps 1:1 onto the 1920x1080 output with no letterbox.
# ---------------------------------------------------------------------------

def focus_box_right(cy, frac=0.66, right=0.965):
    # `right` is the page fraction where the visible window ends.
    """A 16:9 box whose right edge sits at `right` of the page width.

    Used when the subject must not leave a gap on the right: the window always
    ends where the content ends, so nothing blank is exposed.
    """
    page = page_frame()
    pw, ph = page[2], page[3]
    w = pw * frac
    h = w * 9 / 16
    if h > ph:
        h = ph
        w = h * 16 / 9
    x = pw * right - w
    x = min(max(x, 0), pw - w)
    y = min(max(cy * ph - h / 2, 0), ph - h)
    return (x / pw, y / ph, w / pw, h / ph)


def focus_box_left(x_left, cy, right=0.965):
    """A 16:9 box starting at `x_left` of the page width.

    Used when the left edge of a pane has to be visible: the window begins at the
    pane border and extends right until it runs out of content or reaches a 16:9
    aspect, whichever comes first.
    """
    page = page_frame()
    pw, ph = page[2], page[3]
    w = pw * (right - x_left)
    h = w * 9 / 16
    if h > ph:                     # keep it inside the page
        h = ph
        w = h * 16 / 9
    x = pw * x_left
    y = min(max(cy * ph - h / 2, 0), ph - h)
    return (x / pw, y / ph, w / pw, h / ph)


def focus_box(cx, cy, frac=0.62):
    """Build a 16:9 box of width `frac` of the page, centred on (cx, cy)."""
    pw_top, pw_h = None, None
    page = page_frame()
    pw = page[2]
    ph = page[3]
    w = pw * frac
    h = w * 9 / 16
    if h > ph:                     # never taller than the page area
        h = ph
        w = h * 16 / 9
    # centre, clamped inside the page
    x = min(max(cx * pw - w / 2, 0), pw - w)
    y = min(max(cy * ph - h / 2, 0), ph - h)
    return (x / pw, y / ph, w / pw, h / ph)


SEGMENTS = [
    # start, end, focus (None = full view), speed
    {"s": 4.0,  "e": 12.0, "focus": None,
     "speed": 1.0, "label": "prompt"},
    # centre-right: the response pane
    {"s": 62.0, "e": 73.0, "focus": focus_box(0.58, 0.52, 0.70),
     "speed": 1.25, "label": "llm-output", "hold": True},
    # bottom-right: chart area (skip top 1/5 and left 1/5 of the page)
    {"s": 78.0, "e": 86.0, "focus": focus_box(0.62, 0.64, 0.66),
     "speed": 1.1, "label": "chart"},
    # source code: same band as the chart but moved left by ~1/5 of the page width
    # source code: whole script pane visible, its left border flush with the frame
    # source code: framed at natural scale. A window of 70% of the page width
    # (~2019 source px) upscales to 1920 at 0.95x -- i.e. the code reads at
    # roughly the size it does on the original screen. Wider shrinks the text,
    # narrower blows it up.
    {"s": 87.0, "e": 92.0, "focus": focus_box_left(CODE_LEFT, 0.60, CODE_RIGHT),
     "speed": 1.1, "label": "code", "align_left": True},
]


def crop_expressions(seg):
    """Return the crop filter that renders one segment at 1920x1080."""
    page = page_frame()
    px, py, pw, ph = page
    dur = (seg["e"] - seg["s"]) / seg["speed"]

    if seg["focus"] is None:
        # Full page view with the prompt composer promoted: the bottom fifth of the
        # page is moved up so it sits in the middle of the frame, and the space it
        # vacates is filled with black. This keeps the text being typed legible
        # instead of shrunk to a strip at the bottom.
        # Frame the dialog column: a 16:9 window spanning the dialog's horizontal
        # extent, ending at the composer. Measured content runs x=0.035..0.963 of
        # the page. Scaling up (not padding) keeps the composer large.
        content_left, content_right = 0.035, 0.963
        band_w = pw * (content_right - content_left)
        band_h = band_w * 9 / 16
        band_x = px + pw * content_left
        # Anchor the window's bottom just below the composer so the text being
        # typed sits in the lower-middle of the frame.
        band_bottom = py + ph * (1 - BOTTOM_BAND_PAD)
        band_top = max(band_bottom - band_h, py)
        # Shift the scaled frame up by 1/3 of the output height; the vacated area
        # at the bottom is padded black. pad height is +2/3 so the frame can move
        # without ever exposing the edge.
        shift = int(OUT_H / 3)
        return (f"crop={int(band_w)}:{int(band_bottom - band_top)}:{int(band_x)}:{int(band_top)},"
                f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
                f"crop={OUT_W}:{OUT_H},setsar=1,"
                f"pad={OUT_W}:{OUT_H + shift}:0:0:color=black,"
                f"crop={OUT_W}:{OUT_H}:0:{shift}")

    fx, fy, fw, fh = seg["focus"]
    # focus box in source pixels
    bw = pw * fw
    bh = ph * fh
    full_w, full_h = pw, pw * 9 / 16          # 16:9 window at full-view scale
    bx = px + pw * fx
    by = py + ph * fy

    # zoom interpolation: 1.0 at the start/end, 0.0 in the middle (hold at the box)
    t_in = ZOOM_IN / dur
    t_out = 1 - ZOOM_OUT / dur
    # smoothstep for ease-in-out
    ss = lambda v: f"(if(lt({v},0),0,if(gt({v},1),1,{v}*{v}*(3-2*{v}))))"

    # progress: 0->1 over the push-in, then 1 (hold). Segments flagged "hold"
    # stay zoomed in and rely on the crossfade to the next segment, so they never
    # pull back out.
    if seg.get("hold"):
        prog = f"if(lt(t,{ZOOM_IN}),{ss(f't/{ZOOM_IN}')},1)"
    else:
        prog = (f"if(lt(t,{ZOOM_IN}),{ss(f't/{ZOOM_IN}')},"
                f"if(gt(t,{dur - ZOOM_OUT}),{ss(f'({dur}-t)/{ZOOM_OUT}')},1))")

    # width shrinks from full_w to bw as progress rises
    cw = f"({full_w}-({full_w}-{bw})*{prog})"
    ch = f"({cw}*9/16)"
    # Keep the window centred on the focus box, clamped to the same 16:9 window
    # the full view uses, so the push-in never reveals anything outside it.
    fcx = bx + bw / 2
    fcy = by + bh / 2
    win_x = px + pw / 2 - full_w / 2
    win_y = py + ph / 2 - full_h / 2
    # Horizontal anchor: by default centre on the focus box. Segments flagged
    # "align_left" pin the box's LEFT edge to frame x=0 instead, so a pane's own
    # left border is visible (clamped so the window never leaves the page content).
    if seg.get("align_left"):
        cx = f"min(max({bx}+{bw}-{cw},{win_x}),{win_x}+{full_w}-{cw})"
    else:
        cx = f"min(max({fcx}-{cw}/2,{win_x}),{win_x}+{full_w}-{cw})"
    cy = f"min(max({fcy}-{ch}/2,{win_y}),{win_y}+{full_h}-{ch})"

    return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',"
            f"scale={OUT_W}:{OUT_H},setsar=1")


def build(dry=False):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)

    parts = []
    for i, seg in enumerate(SEGMENTS):
        dur = (seg["e"] - seg["s"]) / seg["speed"]
        out = os.path.join(TMP, f"seg{i:02d}.mp4")
        vf = (f"setpts=PTS/{seg['speed']},fps={FPS},"
              f"{crop_expressions(seg)},format=yuv420p")
        cmd = [FFMPEG, "-y", "-ss", f"{seg['s']}", "-to", f"{seg['e']}",
               "-i", SRC, "-an", "-vf", vf,
               "-t", f"{dur:.3f}",
               "-c:v", "libx264", "-preset", "medium", "-crf", str(CRF),
               "-pix_fmt", "yuv420p", "-r", str(FPS), out]
        if dry:
            print(f"[{i}] {seg['label']}: {seg['s']}-{seg['e']} @ {seg['speed']}x "
                  f"-> {dur:.2f}s\n    {vf}")
        else:
            print(f"rendering {seg['label']} ({dur:.2f}s)...")
            run(cmd)
        parts.append((out, dur, seg["label"]))

    if dry:
        total = sum(d for _, d, _ in parts) - XFADE * (len(parts) - 1)
        print(f"\ntotal duration: {total:.2f}s across {len(parts)} segments")
        return

    # chain the segments with crossfades
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

    # Ending: fade to black over the last ENDING_FADE seconds, then hold black for
    # ENDING_TAIL so the clip settles instead of snapping off. A plain fade=out on
    # the joined stream handles both, since it pads the tail with black.
    # fade=out only darkens the stream that exists; it does not extend it. So run
    # the fade over the last ENDING_FADE seconds and then hold the final (black)
    # frame for ENDING_TAIL via tpad, which does add duration.
    end_start = acc - ENDING_FADE
    filters.append(
        f"[linked]fade=t=out:st={end_start:.3f}:d={ENDING_FADE}:color=black,"
        f"tpad=stop_mode=clone:stop_duration={ENDING_TAIL},"
        f"format=yuv420p[vout]")
    total = acc + ENDING_TAIL

    final = os.path.join(OUT, "clip.mp4")
    run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filters),
         "-map", "[vout]", "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-movflags", "+faststart", final])

    # poster: a clean frame from the prompt segment
    poster = os.path.join(OUT, "poster.jpg")
    run([FFMPEG, "-y", "-ss", "1.5", "-i", final, "-frames:v", "1",
         "-q:v", "3", poster])

    report = {
        "output": final,
        "poster": poster,
        "bytes": os.path.getsize(final),
        "poster_bytes": os.path.getsize(poster),
        "segments": [{"label": l, "seconds": round(d, 2)} for _, d, l in parts],
        "total_seconds": round(total, 2),
        "ending_fade": {"fade": ENDING_FADE, "black_tail": ENDING_TAIL},
        "crossfade": XFADE,
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    build(dry="--dry-run" in sys.argv)
