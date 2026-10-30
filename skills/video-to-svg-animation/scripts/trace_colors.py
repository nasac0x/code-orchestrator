#!/usr/bin/env python3
"""Trace flat-colour artwork from a frame into polygons (JSON).

Usage:
  python3 -I trace_colors.py frame.png --k 4 --roi 280,180,600,450 \
      --eps 1.6 --min-area 25 --out shapes.json --debug debug.png

- K-means quantises the ROI to --k colours; clusters that look like the background
  (low saturation, light) are dropped unless --keep-bg is given.
- Each remaining colour becomes one or more polygons (cv2.approxPolyDP, --eps px).
- Output: {"size":[w,h], "shapes":[{"color":"#rrggbb","area":..,"cx":..,"cy":..,
  "bbox":[x,y,w,h],"points":[[x,y],...]}]}
"""
import argparse, json
import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--k", type=int, default=4)
    ap.add_argument("--roi", default=None, help="x,y,w,h")
    ap.add_argument("--eps", type=float, default=1.6)
    ap.add_argument("--min-area", type=float, default=25)
    ap.add_argument("--keep-bg", action="store_true")
    ap.add_argument("--out", default="shapes.json")
    ap.add_argument("--debug", default=None)
    a = ap.parse_args()

    img = cv2.imread(a.image)
    if img is None:
        raise SystemExit(f"cannot read {a.image}")
    H, W = img.shape[:2]
    x0, y0, rw, rh = (0, 0, W, H)
    if a.roi:
        x0, y0, rw, rh = [int(v) for v in a.roi.split(",")]
    crop = img[y0:y0 + rh, x0:x0 + rw]

    # light blur removes compression noise before clustering
    blur = cv2.GaussianBlur(crop, (3, 3), 0)
    data = blur.reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, labels, centers = cv2.kmeans(data, a.k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    labels = labels.reshape(rh, rw)

    shapes = []
    for ci, c in enumerate(centers):
        bgr = np.uint8([[c]])
        h, s, v = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0, 0]
        if not a.keep_bg and s < 40 and v > 170:
            continue  # background / white
        mask = (labels == ci).astype(np.uint8) * 255
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hexcol = "#%02x%02x%02x" % (int(c[2]), int(c[1]), int(c[0]))
        for cnt in cs:
            area = cv2.contourArea(cnt)
            if area < a.min_area:
                continue
            m = cv2.moments(cnt)
            pts = cv2.approxPolyDP(cnt, a.eps, True)[:, 0, :] + np.array([x0, y0])
            bx, by, bw, bh = cv2.boundingRect(cnt)
            shapes.append({
                "color": hexcol, "area": area,
                "cx": m["m10"] / m["m00"] + x0, "cy": m["m01"] / m["m00"] + y0,
                "bbox": [bx + x0, by + y0, bw, bh],
                "points": pts.tolist(),
            })

    json.dump({"size": [W, H], "shapes": shapes}, open(a.out, "w"))
    print(f"{len(shapes)} shapes, colours: {sorted({s['color'] for s in shapes})}")

    if a.debug:
        dbg = np.full((H, W, 3), 245, np.uint8)
        for s in shapes:
            col = tuple(int(s["color"][i:i + 2], 16) for i in (5, 3, 1))
            cv2.fillPoly(dbg, [np.array(s["points"], np.int32)], col)
        cv2.imwrite(a.debug, dbg)
        print("debug render:", a.debug)


if __name__ == "__main__":
    main()
