import cv2, numpy as np, math, random

random.seed(5)
SRC = "full_2.4.png"
img = cv2.imread(SRC)
H, W = img.shape[:2]
b, g, r = [img[:, :, i].astype(int) for i in range(3)]

red = (r > 180) & (g < 90) & (b < 90)
yel = (r > 200) & (g > 150) & (b < 80)
orng = (r > 200) & (g > 110) & (g <= 165) & (b < 70)
roi = np.zeros((H, W), bool)
roi[180:630, 280:880] = True


def med_color(mask):
    px = img[mask & roi]
    c = np.median(px, axis=0)
    return "#%02x%02x%02x" % (int(c[2]), int(c[1]), int(c[0]))


COL = {"red": med_color(red), "yel": med_color(yel), "orng": med_color(orng)}
print(COL)

HEAD = "M660,205 C745,207 826,262 859,369 L668,370 Z"


def bez(t):
    p0, p1, p2, p3 = (660, 205), (745, 207), (826, 262), (859, 369)
    x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
    y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
    dx = 3 * (1 - t) ** 2 * (p1[0] - p0[0]) + 6 * (1 - t) * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    dy = 3 * (1 - t) ** 2 * (p1[1] - p0[1]) + 6 * (1 - t) * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    n = math.hypot(dx, dy)
    return x, y, dy / n, -dx / n  # ponto e normal (para fora)


shapes = []  # (cor, d, cx)
for name, m in [("red", red), ("yel", yel), ("orng", orng)]:
    mk = (m & roi).astype(np.uint8) * 255
    mk = cv2.morphologyEx(mk, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    cs, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in cs:
        area = cv2.contourArea(c)
        if area < 25:
            continue
        M = cv2.moments(c)
        cx, cy = M["m10"] / M["m00"], M["m01"] / M["m00"]
        if name == "yel" and cx > 650 and cy < 380 and area > 5000:
            shapes.append((COL["yel"], HEAD, cx))  # head hand-redrawn (clean curve)
            continue
        bx, by, bw, bh = cv2.boundingRect(c)
        if bx > 690 and by > 285 and bx + bw < 815 and by + bh < 370 and area < 5000:
            continue
        if name == "orng" and bx > 680 and by < 370 and bx + bw < 830:
            continue
        a = cv2.approxPolyDP(c, 1.6, True)[:, 0, :]
        d = "M" + " L".join(f"{x},{y}" for x, y in a) + " Z"
        shapes.append((COL[name], d, cx))
print("formas:", len(shapes))

x0 = min(s[2] for s in shapes)
x1 = max(s[2] for s in shapes)

T = 7.0


def kt(s):
    return f"{s / T:.4f}"


def anim(attr, pairs, extra="", tag="animate", **kw):
    """pairs: [(segundos, valor)] -> animate com keyTimes (loop de T)"""
    pairs = sorted(pairs, key=lambda p: p[0])
    if pairs[0][0] > 0:
        pairs.insert(0, (0, pairs[0][1]))
    if pairs[-1][0] < T:
        pairs.append((T, pairs[-1][1]))
    if extra.startswith("calcMode"):
        extra = splines(len(pairs) - 1)
    kts = ";".join(kt(p[0]) for p in pairs)
    vals = ";".join(str(p[1]) for p in pairs)
    if tag == "animateTransform":
        return f'<animateTransform attributeName="transform" type="{kw["type"]}" dur="{T}s" repeatCount="indefinite" keyTimes="{kts}" values="{vals}" {extra}/>'
    return f'<animate attributeName="{attr}" dur="{T}s" repeatCount="indefinite" keyTimes="{kts}" values="{vals}" {extra}/>'


EASE = 'calcMode="spline" keySplines="{}"'


def splines(n):
    return EASE.format(";".join([".45 0 .2 1"] * n))


# ---------------- criatura ----------------
body = ""
for col, d, cx in shapes:
    u = (cx - x0) / (x1 - x0)
    s0 = 0.55 + 0.8 * u
    s1 = s0 + 0.7
    body += f'<path d="{d}" pathLength="1" fill="{col}" fill-opacity="0" stroke="{COL["red"]}" stroke-width="2.4" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1" stroke-opacity="0">'
    body += anim("stroke-dashoffset", [(s0, 1), (s1, 0)])
    body += anim("stroke-opacity", [(s0, 0), (s0 + 0.02, 1), (2.0, 1), (2.5, 0)])
    body += anim("fill-opacity", [(1.9, 0), (2.15, 0.45), (2.5, 1)])
    body += "</path>\n"

# olho
eye = f"""
<g opacity="0">{anim("opacity", [(2.1, 0), (2.5, 1)])}
  <g transform="translate(750 307)"><g>{anim("", [(4.9, "1 1"), (5.0, "1 0.08"), (5.12, "1 1"), (5.55, "1 1"), (5.65, "1 0.08"), (5.77, "1 1")], tag="animateTransform", type="scale")}
    <g transform="translate(-750 -307)">
      <circle cx="750" cy="307" r="45" fill="#fff"/>
      <circle cx="765" cy="308" r="15" fill="{COL['red']}"/>
      <circle cx="770" cy="303" r="4.5" fill="#fff"/>
    </g></g></g>
</g>"""

# crests (small yellow "teeth" on top of the head)
crests = ""
for i, t in enumerate([0.05, 0.17, 0.29, 0.41]):
    px, py, nx, ny = bez(t)
    ax, ay = px + nx * 6, py + ny * 6
    bx, by = px + nx * 24, py + ny * 24
    cs0 = 3.35 + i * 0.07
    crests += f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{COL["yel"]}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1" pathLength="1" stroke-dashoffset="1">'
    crests += anim("stroke-dashoffset", [(cs0, 1), (cs0 + 0.2, 0)])
    crests += "</line>\n"

# transforms: translate(pos) -> scale -> translate(-centre)
creature = f"""
<g>{anim("", [(0, "640 372"), (2.55, "640 372"), (3.3, "450 384"), (T, "450 384")], tag="animateTransform", type="translate", extra=splines(3))}
 <g>{anim("", [(0, "1"), (2.55, "1"), (3.3, "0.64"), (T, "0.64")], tag="animateTransform", type="scale", extra=splines(3))}
  <g transform="translate(-578 -408)">
   {body}
   {eye}
   {crests}
  </g>
 </g>
</g>"""

# ---------------- texto ----------------
text = f"""
<g opacity="0">{anim("opacity", [(2.7, 0), (3.4, 1)])}
 <g>{anim("", [(2.7, "-70 0"), (3.4, "0 0"), (T, "0 0")], tag="animateTransform", type="translate", extra=splines(2))}
  <text x="660" y="347" font-family="Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="57" font-weight="700" fill="#1f1f23">Page Craft</text>
  <text x="660" y="418" font-family="Montserrat, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="57" font-weight="300" fill="#1f1f23">Extract</text>
 </g>
</g>"""

# ---------------- riscos de velocidade e crescentes (abertura) ----------------
dirx, diry = 0.64, -0.77
streaks = ""
specs = [
    (160, 160, 150, 14, "red"), (330, 120, 110, 9, "yel"), (210, 330, 90, 8, "red"), (420, 250, 140, 12, "yel"),
    (880, 150, 160, 13, "red"), (1020, 260, 100, 9, "yel"), (760, 300, 120, 11, "yel"), (950, 400, 150, 14, "red"),
    (300, 450, 130, 12, "red"), (560, 130, 80, 7, "yel"), (1100, 480, 110, 9, "yel"), (700, 540, 140, 12, "red"),
]
for i, (x, y, ln, wd, c) in enumerate(specs):
    s = 0.05 + (i % 6) * 0.1
    e = s + 0.7
    tx, ty = 230 * dirx, 230 * diry
    streaks += f'<g opacity="0">{anim("opacity", [(s, 0), (s + 0.15, 1), (e - 0.2, 1), (e, 0)])}'
    streaks += f'<g>{anim("", [(s, f"{x - tx:.0f} {y - ty:.0f}"), (e, f"{x + tx:.0f} {y + ty:.0f}")], tag="animateTransform", type="translate")}'
    streaks += f'<line x1="0" y1="0" x2="{ln * dirx:.0f}" y2="{ln * diry:.0f}" stroke="{COL[c]}" stroke-width="{wd}" stroke-linecap="round"/></g></g>\n'

cres = ""
for i, (x, y, rot, sc) in enumerate([(210, 440, 200, 1.0), (520, 560, 160, 1.2), (880, 120, 20, 0.9), (1050, 330, 330, 1.1)]):
    s = 0.15 + i * 0.12
    e = s + 0.8
    cres += f'<g opacity="0">{anim("opacity", [(s, 0), (s + 0.15, 1), (e - 0.25, 1), (e, 0)])}'
    cres += f'<g transform="translate({x} {y}) rotate({rot}) scale({sc})"><g>{anim("", [(s, "-60 0"), (e, "70 0")], tag="animateTransform", type="translate")}'
    cres += f'<path d="M0,-34 A34 34 0 1 0 0,34 A24 24 0 1 1 0,-34 Z" fill="{COL["yel"]}"/></g></g></g>\n'

# ---------------- sparks (ray burst) and particles ----------------
def burst(cx, cy, r0, r1, n, start, color):
    out = ""
    for k in range(n):
        a = 2 * math.pi * k / n + 0.2
        ux, uy = math.cos(a), math.sin(a)
        ln = 14 + (k % 3) * 6
        out += f'<g opacity="0">{anim("opacity", [(start, 0), (start + 0.08, 1), (start + 0.6, 0)])}'
        out += f'<g>{anim("", [(start, f"{ux * r0:.1f} {uy * r0:.1f}"), (start + 0.6, f"{ux * r1:.1f} {uy * r1:.1f}")], tag="animateTransform", type="translate")}'
        out += f'<line x1="{cx}" y1="{cy}" x2="{cx + ux * ln:.1f}" y2="{cy + uy * ln:.1f}" stroke="{color}" stroke-width="4.5" stroke-linecap="round"/></g></g>\n'
    return out


fx = burst(365, 470, 22, 62, 14, 3.55, COL["yel"])
fx += burst(930, 400, 25, 68, 12, 3.85, COL["yel"])
fx += burst(520, 235, 20, 50, 9, 3.95, COL["yel"])

parts = ""
for i in range(34):
    a = random.uniform(0, 2 * math.pi)
    cx = random.choice([400, 520, 700, 880])
    cy = random.choice([330, 400, 460])
    d0 = random.uniform(40, 80)
    d1 = d0 + random.uniform(60, 150)
    s = 4.0 + random.uniform(0, 0.5)
    parts += f'<g opacity="0">{anim("opacity", [(s, 0), (s + 0.1, 1), (s + 0.9, 0)])}'
    parts += f'<g>{anim("", [(s, f"{math.cos(a) * d0:.0f} {math.sin(a) * d0:.0f}"), (s + 0.9, f"{math.cos(a) * d1:.0f} {math.sin(a) * d1:.0f}")], tag="animateTransform", type="translate")}'
    parts += f'<circle cx="{cx}" cy="{cy}" r="{random.uniform(1.8, 3.6):.1f}" fill="{random.choice([COL["yel"], COL["yel"], COL["red"]])}"/></g></g>\n'

shadow = f"""<ellipse cx="640" cy="650" rx="260" ry="14" fill="#000" opacity="0">
 {anim("opacity", [(1.9, 0), (2.5, 0.10), (6.3, 0.10), (6.9, 0)])}
 {anim("cx", [(2.55, 640), (3.3, 450), (T, 450)], extra=splines(2))}
 {anim("cy", [(2.55, 650), (3.3, 538), (T, 538)], extra=splines(2))}
 {anim("rx", [(2.55, 260), (3.3, 150), (T, 150)], extra=splines(2))}
</ellipse>"""

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
<defs>
 <radialGradient id="bg" cx="50%" cy="45%" r="75%">
  <stop offset="0" stop-color="#ffffff"/>
  <stop offset="1" stop-color="#e9e9ea"/>
 </radialGradient>
</defs>
<rect width="1280" height="720" fill="url(#bg)"/>
{streaks}
{cres}
{shadow}
<g>{anim("opacity", [(0, 1), (6.3, 1), (6.9, 0)])}
{text}
{creature}
{fx}
{parts}
</g>
</svg>
"""
open("animacao-camaleao.svg", "w").write(svg)
print("bytes:", len(svg))
