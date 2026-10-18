#!/usr/bin/env python3
"""
Video -> web asset pipeline.

Takes a source .mov/.mp4 and a JSON clip spec, and produces:
  * poster.jpg        - cover frame for the <video> tag
  * clip.mp4          - H.264 1080p, faststart, muted-friendly
  * clip-focus.mp4    - same clip, zoomed/panned into a region of interest

The "focus" is implemented as a smooth ken-burns style zoom on the region of
interest, so a screen recording can show a small UI area at a readable size
without re-recording it.

Clip spec (JSON):
{
  "source": "raw/demo.mov",
  "out": "videos/data-copilot",
  "segments": [
    {"start": "00:12", "end": "00:34", "label": "schema scan"},
    {"start": "01:02", "end": "01:20"}
  ],
  "focus": {"x": 0.42, "y": 0.30, "w": 0.34, "h": 0.34, "at": "00:20"},
  "poster_at": "00:14"
}
All focus rect values are fractions of the source frame (0..1).
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

FFMPEG = shutil.which("ffmpeg") or "/Users/lykenl/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg"

OUT_W, OUT_H = 1920, 1080


def run(cmd, capture=True):
    res = subprocess.run(cmd, capture_output=capture, text=True)
    if res.returncode != 0:
        sys.stderr.write("FAILED: " + " ".join(cmd) + "\n")
        sys.stderr.write(res.stderr[-4000:] if res.stderr else "")
        sys.exit(1)
    return res.stdout if capture else ""


def probe(path):
    """Read width/height/duration straight from ffmpeg -i output.

    ffprobe is not always installed alongside ffmpeg (it isn't on this machine),
    so we parse the banner instead of depending on it.
    """
    res = subprocess.run([FFMPEG, "-hide_banner", "-i", path],
                         capture_output=True, text=True)
    banner = res.stderr or ""
    re_dim = re.search(r"Video:.*?,\s*(\d{2,5})x(\d{2,5})", banner)
    re_dur = re.search(r"Duration:\s*(\d+):(\d{2}):(\d{2}\.?\d*)", banner)
    re_fps = re.search(r"(\d+(?:\.\d+)?)\s*fps", banner)
    if not re_dim:
        sys.stderr.write(banner[-2000:])
        sys.exit(f"could not read video dimensions from {path}")
    h, m, sec = re_dur.groups()
    return {
        "width": int(re_dim.group(1)),
        "height": int(re_dim.group(2)),
        "duration": int(h) * 3600 + int(m) * 60 + float(sec),
        "fps": float(re_fps.group(1)) if re_fps else None,
        "size": os.path.getsize(path) if os.path.exists(path) else 0,
    }


def ts(value):
    """Accept 'mm:ss', 'hh:mm:ss', or plain seconds."""
    if isinstance(value, (int, float)):
        return float(value)
    parts = str(value).split(":")
    parts = [float(p) for p in parts]
    total = 0.0
    for p in parts:
        total = total * 60 + p
    return total


def fmt_ts(sec):
    return f"{int(sec // 60):02d}:{sec % 60:06.3f}"


def cut_filter(segments, tail=""):
    """Keep only the given ranges, join them, then run `tail` on the result.

    The joined stream is labelled [cut]; `tail` must consume [cut] and produce
    [outv], so filters can be appended without clobbering a label.
    """
    parts = []
    for i, (a, b) in enumerate(segments):
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{i}]")
    labels = "".join(f"[v{i}]" for i in range(len(segments)))
    parts.append(f"{labels}concat=n={len(segments)}:v=1:a=0[cut]")
    if tail:
        parts.append("[cut]" + tail)
    else:
        parts.append("[cut]null[outv]")
    return ";".join(parts)


def build_plain(src, segments, out_path, crf=23, preset="slow"):
    tail = (f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=decrease,"
            f"pad={OUT_W}:{OUT_H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[outv]")
    chain = cut_filter(segments, tail)
    run([FFMPEG, "-y", "-i", src, "-filter_complex", chain,
         "-map", "[outv]", "-an",
         "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-movflags", "+faststart", out_path])


def build_focus(src, segments, rect, out_path, crf=23, preset="slow"):
    """Zoom into rect (fractions of source frame) with a slow push-in."""
    info = probe(src)
    sw, sh = info["width"], info["height"]
    # crop region in source pixels, kept even (yuv420p requirement)
    cw = int(sw * rect["w"]) // 2 * 2
    ch = int(sh * rect["h"]) // 2 * 2
    cx = int(sw * rect["x"]) // 2 * 2
    cy = int(sh * rect["y"]) // 2 * 2
    cw, ch = min(cw, sw - cx), min(ch, sh - cy)

    # crop the ROI, upscale to fill, then a slow push-in (1.0 -> 1.08)
    tail = (
        f"crop={cw}:{ch}:{cx}:{cy},"
        f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=increase,"
        f"crop={OUT_W}:{OUT_H},setsar=1,"
        f"zoompan=z='min(zoom+0.0004,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d=1:s={OUT_W}x{OUT_H}:fps=30[outv]"
    )
    chain = cut_filter(segments, tail)
    run([FFMPEG, "-y", "-i", src, "-filter_complex", chain,
         "-map", "[outv]", "-an",
         "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-movflags", "+faststart", out_path])


def build_poster(src, at, out_path):
    run([FFMPEG, "-y", "-ss", str(at), "-i", src, "-frames:v", "1",
         "-vf", f"scale={OUT_W}:{OUT_H}:force_original_aspect_ratio=decrease,"
                f"pad={OUT_W}:{OUT_H}:(ow-iw)/2:(oh-ih)/2:color=black",
         "-q:v", "3", out_path])


def build_segments(src, segments, outdir, poster_at=None, focus=None, crf=23, preset="slow"):
    """Cut the segments and also export each one individually (for montage previews)."""
    os.makedirs(outdir, exist_ok=True)
    os.makedirs(os.path.join(outdir, "segments"), exist_ok=True)
    made = []

    for i, (a, b) in enumerate(segments, 1):
        p = os.path.join(outdir, "segments", f"seg{i:02d}-{int(a)}s-{int(b)}s.mp4")
        build_plain(src, [(a, b)], p, crf, preset)
        made.append(p)

    full = os.path.join(outdir, "clip.mp4")
    build_plain(src, segments, full, crf, preset)
    made.append(full)

    if focus:
        focus_path = os.path.join(outdir, "clip-focus.mp4")
        rect = focus["rect"]
        build_focus(src, segments, rect, focus_path, crf, preset)
        made.append(focus_path)

    poster = os.path.join(outdir, "poster.jpg")
    build_poster(src, ts(poster_at if poster_at is not None else segments[0][0]), poster)
    made.append(poster)

    report = {"source": src, "info": probe(src), "outputs": []}
    for p in made:
        report["outputs"].append({"path": p, "bytes": os.path.getsize(p)})
    with open(os.path.join(outdir, "manifest.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


def montage(src, times, outdir, cols=5):
    """Contact sheet at the given timestamps — used to find good cut points."""
    os.makedirs(outdir, exist_ok=True)
    thumbs = []
    for t in times:
        p = os.path.join(outdir, f"t{int(t):05d}.jpg")
        run([FFMPEG, "-y", "-ss", str(t), "-i", src, "-frames:v", "1",
             "-vf", "scale=480:-2", "-q:v", "4", p])
        thumbs.append((t, p))
    with open(os.path.join(outdir, "frames.json"), "w") as f:
        json.dump([{"t": t, "path": p} for t, p in thumbs], f, indent=2)
    print(f"extracted {len(thumbs)} frames -> {outdir}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", help="JSON clip spec")
    ap.add_argument("--montage", help="source video: extract a contact sheet")
    ap.add_argument("--times", help="comma separated timestamps for montage")
    ap.add_argument("--out", default="videos", help="output dir for montage")
    a = ap.parse_args()

    if a.montage:
        times = [ts(t) for t in (a.times or "0,5,10,15,20,25,30,35,40,45").split(",")]
        montage(a.montage, times, os.path.join(a.out, "frames"))
        return

    with open(a.spec) as f:
        spec = json.load(f)
    segs = [(ts(s["start"]), ts(s["end"])) for s in spec["segments"]]
    focus = None
    if "focus" in spec:
        focus = {"rect": spec["focus"]}
        if "at" in spec["focus"]:
            focus["at"] = ts(spec["focus"]["at"])
    build_segments(spec["source"], segs, spec["out"],
                   poster_at=ts(spec["poster_at"]) if spec.get("poster_at") else None,
                   focus=focus,
                   crf=spec.get("crf", 23),
                   preset=spec.get("preset", "slow"))


if __name__ == "__main__":
    main()
