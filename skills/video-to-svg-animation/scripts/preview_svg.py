#!/usr/bin/env python3
"""Render an animated SVG at given times and build a contact sheet.

Usage:
  python3 -I preview_svg.py anim.svg --times 0.3,1,2,3.5 --out preview.png [--cols 2] [--w 1280 --h 720]

Uses headless Chromium (Playwright): pauses SMIL and calls setCurrentTime(t) per frame.
Install once:  pip install playwright && playwright install chromium
"""
import argparse, os, sys, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("svg")
    ap.add_argument("--times", required=True)
    ap.add_argument("--out", default="preview.png")
    ap.add_argument("--cols", type=int, default=2)
    ap.add_argument("--w", type=int, default=1280)
    ap.add_argument("--h", type=int, default=720)
    ap.add_argument("--thumb", type=int, default=640, help="thumbnail width in the sheet")
    a = ap.parse_args()

    times = [float(t) for t in a.times.split(",")]
    tmp = tempfile.mkdtemp()
    shots = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": a.w, "height": a.h})
        pg.goto("file://" + os.path.abspath(a.svg))
        for t in times:
            pg.evaluate(f"document.documentElement.pauseAnimations();document.documentElement.setCurrentTime({t})")
            f = os.path.join(tmp, f"{t}.png")
            pg.screenshot(path=f)
            shots.append(f)
        b.close()

    th = int(a.thumb * a.h / a.w)
    rows = (len(shots) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (a.cols * a.thumb, rows * th), "white")
    for i, f in enumerate(shots):
        sheet.paste(Image.open(f).convert("RGB").resize((a.thumb, th)), ((i % a.cols) * a.thumb, (i // a.cols) * th))
    sheet.save(a.out)
    print("preview:", a.out, "times:", times)


if __name__ == "__main__":
    sys.exit(main())
