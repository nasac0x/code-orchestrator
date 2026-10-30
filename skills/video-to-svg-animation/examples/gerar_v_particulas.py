import math, random

random.seed(11)
T = 13.2
DT = 0.12
FR = int(round(T / DT))
TIMES = [i * DT for i in range(FR + 1)]
CX, CY = 400, 300
IMP = 1.2  # instante do impacto (s)


def kt(s):
    return round(s / T, 4)


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


# ---------- target: the V shape made of particles ----------
S = 1.25
poly = [(-65, -65), (-25, -65), (0, 15), (25, -65), (65, -65), (20, 65), (-20, 65)]
poly = [(x * S, y * S) for x, y in poly]


def inside(x, y):
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


SP = 10.5
targets = []
row = 0
y = -82.0
while y <= 82:
    off = SP / 2 if row % 2 else 0
    x = -90 + off
    while x <= 90:
        if inside(x, y):
            targets.append((x + random.uniform(-0.8, 0.8), y + random.uniform(-0.8, 0.8)))
        x += SP
    y += SP * 0.866
    row += 1

n = len(targets)
order = sorted(range(n), key=lambda i: -targets[i][1] + random.uniform(-25, 25))
rank = {idx: r for r, idx in enumerate(order)}


def fmt(v):
    return f"{v:.1f}"


def particle(tx, ty, ts, kind):
    R = random.uniform(115, 200)
    alpha = random.choice([-1, 1]) * math.radians(random.uniform(50, 82))
    pitch = math.radians(random.uniform(15, 25))
    omega = 2 * math.pi / random.uniform(3.6, 6.2)
    phi0 = random.uniform(0, 2 * math.pi)
    t0 = IMP + random.uniform(0, 0.08)
    sx = random.choice([360, 440]) + random.uniform(-14, 14)
    sy = CY + random.uniform(-20, 20)
    ro = random.uniform(2.0, 3.6)
    rf = 6.0
    pos, rs, ops = [], [], []
    for t in TIMES:
        if t < t0:
            pos.append(f"{fmt(sx)} {fmt(sy)}")
            rs.append("0")
            ops.append("0")
            continue
        tb = t - t0
        phi = phi0 + omega * tb
        a = R * math.sin(phi)
        b = R * math.cos(phi)
        x = a * math.cos(alpha)
        z = a * math.sin(alpha)
        yy = -b * math.cos(pitch) + z * math.sin(pitch)
        d = z / R
        e = 1 - (1 - min(1.0, tb / 0.75)) ** 3
        px = sx * (1 - e) + (CX + x) * e
        py = sy * (1 - e) + (CY + yy) * e
        r = ro * (1 + 0.5 * d) * (0.3 + 0.7 * e)
        op = (0.7 + 0.3 * d) * min(1.0, tb / 0.1)
        if kind == "form":
            s = smooth((t - ts) / 1.5)
            px = px * (1 - s) + (CX + tx) * s
            py = py * (1 - s) + (CY + ty) * s
            r = r * (1 - s) + rf * s
            op = op * (1 - s) + s
        if t > 12.0:
            op *= max(0.0, 1 - (t - 12.0) / 0.9)
        pos.append(f"{fmt(px)} {fmt(py)}")
        rs.append(f"{r:.2f}")
        ops.append(f"{op:.2f}")
    return (
        f'<g opacity="0">'
        f'<animateTransform attributeName="transform" type="translate" dur="{T}s" repeatCount="indefinite" values="{";".join(pos)}"/>'
        f'<animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" values="{";".join(ops)}"/>'
        f'<circle r="0" fill="#0b0b0f"><animate attributeName="r" dur="{T}s" repeatCount="indefinite" values="{";".join(rs)}"/></circle>'
        f"</g>"
    )


parts = []
for i, (tx, ty) in enumerate(targets):
    ts = 3.6 + 5.0 * rank[i] / (n - 1) + random.uniform(-0.2, 0.2)
    parts.append(particle(tx, ty, ts, "form"))
for _ in range(45):
    parts.append(particle(0, 0, 0, "orbit"))

# ---------- high-speed circles ----------
k_imp = kt(IMP)
SPL = ".6 0 1 1;0 0 1 1"


def runner(accent, tx0, tx1, mirror, grad):
    m = ' transform="scale(-1 1)"' if mirror else ""
    streaks = ""
    for dy, ln, off in [(-30, 230, 50), (-18, 300, 80), (-6, 190, 40), (8, 280, 70), (20, 210, 55), (31, 250, 90)]:
        streaks += f'<line x1="{-off}" y1="{dy}" x2="{-off - ln}" y2="{dy}" stroke="{accent}" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>'
    return f"""
    <g>
      <animateTransform attributeName="transform" type="translate" dur="{T}s" repeatCount="indefinite"
        calcMode="spline" keyTimes="0;{k_imp};1" keySplines="{SPL}" values="{tx0} 300;{tx1} 300;{tx1} 300"/>
      <animate attributeName="opacity" dur="{T}s" repeatCount="indefinite"
        keyTimes="0;{k_imp};{k_imp + 0.002};1" values="1;1;0;0"/>
      <g{m}>
        <g>
          <animateTransform attributeName="transform" type="scale" dur="{T}s" repeatCount="indefinite"
            calcMode="spline" keyTimes="0;{k_imp};1" keySplines="{SPL}" values="0.15 1;1.5 1;1.5 1"/>
          <path d="M 0,-36 L -330,-9 L -330,9 L 0,36 Z" fill="url(#{grad})"/>
          {streaks}
        </g>
        <ellipse rx="46" ry="36" fill="#0b0b0f" stroke="{accent}" stroke-width="3.5"/>
      </g>
    </g>"""


# linhas de velocidade ao fundo
bg = ""
for i, (yy, col, direction, start) in enumerate([
    (110, "#e8772e", 1, 0.1), (190, "#3a56d4", -1, 0.25), (260, "#e8772e", 1, 0.45),
    (340, "#3a56d4", -1, 0.35), (420, "#e8772e", 1, 0.6), (500, "#3a56d4", -1, 0.2),
]):
    a, b = (-420, 1100) if direction == 1 else (1100, -420)
    s, e = kt(start), kt(start + 0.55)
    bg += f"""
    <g opacity="0.3"><animateTransform attributeName="transform" type="translate" dur="{T}s" repeatCount="indefinite"
      keyTimes="0;{s};{e};1" values="{a} 0;{a} 0;{b} 0;{b} 0"/>
      <line x1="0" y1="{yy}" x2="{300 + 40 * i}" y2="{yy}" stroke="{col}" stroke-width="2" stroke-linecap="round"/></g>"""

# sparks
sparks = ""
for i in range(14):
    ang = i * (360 / 14) + 6
    L = 95 + (i % 3) * 14
    col = "#e8772e" if i % 2 == 0 else "#0b0b0f"
    w = 16 if i % 2 == 0 else 11
    sparks += f"""
      <g transform="rotate({ang:.1f} 400 300)"><rect x="410" y="297.5" width="{w}" height="5" rx="2.5" fill="{col}" opacity="0">
        <animateTransform attributeName="transform" type="translate" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 1.0)};1" values="0 0;0 0;{L} 0;{L} 0"/>
        <animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{k_imp + 0.002};{kt(IMP + 1.0)};1" values="0;0;1;0;0"/></rect></g>"""

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="tailA" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#0b0b0f" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#0b0b0f" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="flash">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="0.5" stop-color="#ffd27a" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#ff9d3b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="#f3efe6"/>
  {bg}
  <g>
    <animateTransform attributeName="transform" type="translate" dur="{T}s" repeatCount="indefinite"
      keyTimes="0;{k_imp};{kt(IMP + 0.1)};{kt(IMP + 0.2)};{kt(IMP + 0.3)};{kt(IMP + 0.4)};{kt(IMP + 0.6)};1"
      values="0 0;0 0;-8 4;7 -5;-4 3;2 -1;0 0;0 0"/>

    <circle cx="400" cy="300" r="0" fill="none" stroke="#e8772e" stroke-width="8" opacity="0">
      <animate attributeName="r" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 1.0)};1" values="0;0;200;200"/>
      <animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 1.0)};1" values="0;0.9;0;0"/>
      <animate attributeName="stroke-width" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 1.0)};1" values="9;9;1;1"/>
    </circle>
    <circle cx="400" cy="300" r="0" fill="none" stroke="#0b0b0f" stroke-width="3" opacity="0">
      <animate attributeName="r" dur="{T}s" repeatCount="indefinite" keyTimes="0;{kt(IMP + 0.1)};{kt(IMP + 1.2)};1" values="0;0;140;140"/>
      <animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" keyTimes="0;{kt(IMP + 0.1)};{kt(IMP + 1.2)};1" values="0;0.6;0;0"/>
    </circle>
    <circle cx="400" cy="300" r="0" fill="url(#flash)" opacity="0">
      <animate attributeName="r" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 0.2)};{kt(IMP + 0.7)};1" values="0;0;130;60;60"/>
      <animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" keyTimes="0;{k_imp};{kt(IMP + 0.2)};{kt(IMP + 0.7)};1" values="0;1;0.9;0;0"/>
    </circle>
    {sparks}
    {runner("#e8772e", -420, 360, False, "tailA")}
    {runner("#3a56d4", 1220, 440, True, "tailA")}
    {"".join(parts)}
  </g>
</svg>
"""

with open("animacao-v2.svg", "w") as f:
    f.write(svg)
print("particulas do V:", n, "| total:", len(parts), "| bytes:", len(svg))
