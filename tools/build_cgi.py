#!/usr/bin/env python3
"""
Render the CGI "AI-Powered RFP Optimization & Capacity Management" demo clip.

Source: raw/CGI_record.mov  (2888x1982, 33.77fps, 119.89s)
The top of the recording holds the browser chrome (Safari toolbar + tab strip);
it is cropped off every frame, so "full view" always means the page content.

Timeline (source seconds):
   08-12  bar chart            focus centre
   13-18  donut chart          pan right (shear right rather than a new crop)
   24-33  filters panel        focus the Filters column, 1.5x
   44-47  current vs history   focus that panel
   48-55  workload trend       focus the trend chart
   56-57  tool switch          focus the left black sidebar
   59-66  RFP document + click focus RFP Input, scroll down to the Analyze RFP button
  86-88   blue conclusion box  focus it near the top, 2x from 88s, width unchanged
  ends with a 1.3s fade to black

Usage: python3 tools/build_cgi.py [--dry-run]
"""
import json
import os
import subprocess
import sys

FFMPEG = "/Users/lykenl/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "raw", "CGI_record.mov")
OUT = os.path.join(ROOT, "videos", "rfp-optimizer")
TMP = os.path.join(ROOT, ".build_tmp_cgi")

SRC_W, SRC_H = 2888, 1982
CHROME_BOTTOM = 0.1200          # toolbar + tab strip end at y=238/1982 (measured)
OUT_W, OUT_H = 1920, 1080
FPS = 30
XFADE = 0.15
ZOOM_IN = 0.55
ZOOM_OUT = 0.55
CRF = 26
ENDING_FADE = 1.3               # fade to black at the very end


def page_frame():
    top = int(SRC_H * CHROME_BOTTOM)
    return 0, top, SRC_W, SRC_H - top


def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + (res.stderr or "")[-3000:])
        sys.exit(1)


def box(cx, cy, frac=0.62):
    """16:9 focus box centred on (cx, cy), kept inside the page's usable band.

    The page is slightly taller than 16:9, so a 16:9 window only fits within a band
    `usable_h` tall. Clamping to that band (rather than the full page) is what stops
    the final cover-fit from cropping content or exposing black edges.
    """
    _, _, pw, ph = page_frame()
    usable_h = min(ph, pw * 9 / 16) if pw * 9 / 16 < ph else ph
    w = pw * frac
    h = w * 9 / 16
    # keep this box within the usable 16:9 band
    if h > usable_h:
        h = usable_h
        w = h * 16 / 9
    band_top = (ph - usable_h) / 2      # centre the band vertically
    x = min(max(cx * pw - w / 2, 0), pw - w)
    y = min(max(cy * ph - h / 2, band_top), band_top + usable_h - h)
    return (x / pw, y / ph, w / pw, h / ph)


# Layout measured from the frames (fractions of the PAGE area, chrome removed):
#   left black sidebar   0.038 .. 0.30
#   main content         0.30  .. 0.976
#   bar chart            0.30  .. 0.68   vertical 0.15 .. 0.95
#   donut chart          0.68  .. 0.976
SEGMENTS = [
    # bar chart: the plot body sits mid-panel (title marker at y=0.188)
    {"s": 8.0, "e": 12.0, "focus": box(0.47, 0.58, 0.66), "speed": 1.0, "label": "bar-chart"},
    # donut: identical window, slid right
    {"s": 13.0, "e": 18.0, "focus": box(0.775, 0.58, 0.60), "speed": 1.0,
     "label": "donut", "pan_right": True},
    # filters column (left column of the assignment tool)
    {"s": 24.0, "e": 33.0, "focus": box(0.48, 0.50, 0.70), "speed": 1.5, "label": "filters"},
    # "Current Load vs Historical Average": title marker at y=0.175, chart 0.19..0.40
    {"s": 44.0, "e": 47.0, "focus": box(0.62, 0.29, 0.66), "speed": 1.0, "label": "history"},
    # "Workload Trend - Last 8 Quarters": marker at y=0.553, chart below-left
    {"s": 48.0, "e": 55.0, "focus": box(0.40, 0.73, 0.46), "speed": 1.0, "label": "trend"},
    # tool switch in the black sidebar
    {"s": 55.5, "e": 57.5, "focus": box(0.17, 0.38, 0.28), "speed": 1.0, "label": "tool-switch"},
    # "RFP Input" column, then drift down to the Analyze RFP button.
    # Smaller window (0.44 page width) so there is vertical room to travel without
    # the window bottom reaching the page edge.
    # start higher and use a smaller window so the downward travel stays fully
    # inside the page (the page is only ~0.95 of the cropped frame tall)
    {"s": 59.0, "e": 66.0, "focus": box(0.58, 0.44, 0.62), "speed": 1.0,
     "label": "rfp-input", "scroll_up_start": 0.10},
    # conclusion + results: runs to 1:50, then fades out. The page scrolls from the
    # blue retrieval note down to the Risk Flags colour blocks over this span.
    {"s": 86.0, "e": 110.0, "focus": box(0.67, 0.45, 0.55), "speed": 1.0,
     "label": "conclusion"},
]


def page_chain(seg):
    """Crop/scale chain that removes the browser chrome."""
    px, py, pw, ph = page_frame()
    full_h = pw * 9 / 16
    full_y = py + ph / 2 - full_h / 2
    return px, py, pw, ph, full_h, full_y


def cover_fit():
    """Scale up to cover 1920x1080, then centre-crop.

    crop= with expression sizes can round a pixel or two, and a plain
    scale=1920:1080 would turn that rounding into thin black bars. Cover-fit
    never leaves an edge exposed.
    """
    return (f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
            f"crop={OUT_W}:{OUT_H}:x=(iw-{OUT_W})/2:y=(ih-{OUT_H})/2,setsar=1")


def expr_for(seg):
    """Return the filter chain for one segment (before fps/format)."""
    px, py, pw, ph, full_h, full_y = page_chain(seg)
    dur = (seg["e"] - seg["s"]) / seg["speed"]

    if seg["focus"] is None:
        return (f"crop={pw}:{int(full_h)}:{px}:{int(full_y)},"
                f"{cover_fit()}")

    fx, fy, fw, fh = seg["focus"]
    bw = pw * fw
    bh = ph * fh
    bx = px + pw * fx
    by = py + ph * fy

    ss = lambda v: f"(if(lt({v},0),0,if(gt({v},1),1,{v}*{v}*(3-2*{v}))))"
    # Push in once and HOLD. Never pull back out: returning to the wide shot before
    # the crossfade makes the camera jump across the page on every cut, which reads
    # as violent shake. The next segment simply crossfades from this framing.
    prog = f"if(lt(t,{ZOOM_IN}),{ss(f't/{ZOOM_IN}')},1)"

    cw = f"({pw}-({pw}-{bw})*{prog})"
    ch = f"({cw}*9/16)"
    fcx = bx + bw / 2
    fcy = by + bh / 2

    # pan_right: start on the previous box, slide to this one (no zoom change)
    if seg.get("pan_right"):
        prev = seg.get("_pan_from")
        if prev:
            pfx, pfy, pfw, pfh = prev
            pcx = px + pw * pfx + pw * pfw / 2
            pcx_expr = f"({pcx}+({fcx}-{pcx})*{prog})"
            cx = f"min(max({pcx_expr}-{cw}/2,{px}),{px}+{pw}-{cw})"
            cy = f"min(max({fcy}-{ch}/2,{py}),{py}+{ph}-{ch})"
            return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',"
                    f"{cover_fit()}")

    # scroll_up_start: begin the window higher than the focus centre and ease down
    # to it. Needed when the page is itself scrolling under a fixed crop.
    if seg.get("scroll_up_start"):
        lift = ph * seg["scroll_up_start"]
        y_off = f"({-lift}*(1-{prog}))"
        cx = f"min(max({fcx}-{cw}/2,{px}),{px}+{pw}-{cw})"
        cy = f"min(max({fcy}-{ch}/2+{y_off},{py}),{py}+{ph}-{ch})"
        return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',"
                f"{cover_fit()}")

    # scroll_down: drift the window downward to reveal the button below.
    # The travel is clamped so the window's bottom never passes the page bottom,
    # which is what produced black bars in the first pass.
    if seg.get("scroll_down"):
        # room left between the starting window and the page bottom
        room = (py + ph) - (by + bh)
        travel = min(ph * 0.34, max(room, 0))
        cy = f"min({fcy}-{ch}/2+{travel:.1f}*{prog},{py}+{ph}-{ch})"
        cy = f"max({cy},{py})"
        cx = f"min(max({fcx}-{cw}/2,{px}),{px}+{pw}-{cw})"
        return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',"
                f"{cover_fit()}")

    cx = f"min(max({fcx}-{cw}/2,{px}),{px}+{pw}-{cw})"
    cy = f"min(max({fcy}-{ch}/2,{py}),{py}+{ph}-{ch})"
    return (f"crop=w='{cw}':h='{ch}':x='{cx}':y='{cy}',"
            f"{cover_fit()}")


def build(dry=False):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)

    # donut pans from the bar-chart window
    SEGMENTS[1]["_pan_from"] = SEGMENTS[0]["focus"]

    parts = []
    for i, seg in enumerate(SEGMENTS):
        dur = (seg["e"] - seg["s"]) / seg["speed"]
        vf = expr_for(seg)
        out = os.path.join(TMP, f"seg{i:02d}.mp4")

        vf = f"setpts=PTS/{seg['speed']},fps={FPS},{vf},format=yuv420p"
        cmd = [FFMPEG, "-y", "-ss", f"{seg['s']}", "-to", f"{seg['e']}",
               "-i", SRC, "-an", "-vf", vf, "-t", f"{dur:.3f}",
               "-c:v", "libx264", "-preset", "medium", "-crf", str(CRF),
               "-pix_fmt", "yuv420p", "-r", str(FPS), out]

        if dry:
            print(f"[{i}] {seg['label']}: {seg['s']}-{seg['e']} @ {seg['speed']}x -> {dur:.2f}s")
        else:
            print(f"rendering {seg['label']} (~{dur:.2f}s)...")
            run(cmd)
        parts.append((out, dur, seg["label"]))

    if dry:
        total = sum(d for _, d, _ in parts) - XFADE * (len(parts) - 1)
        print(f"\ntotal: {total:.2f}s across {len(parts)} segments (+{ENDING_FADE}s fade)")
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
    filters.append(
        f"[linked]fade=t=out:st={end_start:.3f}:d={ENDING_FADE}:color=black,"
        f"format=yuv420p[vout]")

    final = os.path.join(OUT, "clip.mp4")
    run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filters),
         "-map", "[vout]", "-an",
         "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-movflags", "+faststart", final])

    poster = os.path.join(OUT, "poster.jpg")
    run([FFMPEG, "-y", "-ss", "1.5", "-i", final, "-frames:v", "1",
         "-q:v", "3", poster])

    report = {
        "output": final,
        "poster": poster,
        "bytes": os.path.getsize(final),
        "total_seconds": round(acc, 2),
        "segments": [{"label": l, "seconds": round(d, 2)} for _, d, l in parts],
        "crossfade": XFADE,
        "ending_fade": ENDING_FADE,
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    build(dry="--dry-run" in sys.argv)
