---
name: video-to-svg-animation
description: Recreate a video, GIF or reference animation as a real, lightweight vector animation. Two output pipelines - pure SMIL (standalone SVG, no JavaScript) or GSAP (web pages, with MorphSVG for organic path morphing). Use when the user asks to turn a video/animation/logo reveal into an animated SVG, or to build an SVG/vector motion piece (collisions, particles, orbits, line-drawing, logo reveals) and wants it verified visually.
---

# Video / reference -> vector animation (SMIL or GSAP)

Goal: a small, crisp, loopable animation that *recreates* the motion with vector shapes.
It is NOT an automatic video converter: never embed frames or base64 video. Trace the
key artwork once, then re-animate it with vector motion.

## Step 0 — ask the user for the output pipeline

Before animating, **ask the user** which output they want:

| Pipeline | Best for | Not for |
| --- | --- | --- |
| **SMIL** (default) | Standalone `.svg` files, `<img>` tags, GitHub READMEs, e-mail, anywhere JS cannot run | Interactive timelines, scroll control, organic path morphing |
| **GSAP** | Web pages with inline SVG, interactive/scrub-able timelines, **organic path morphing** (MorphSVG plugin, free since 2025) | Contexts where JS is stripped (`<img>`, sanitizers, GitHub READMEs) |

**Pros and cons:**

- **SMIL**
  - ✅ self-contained file (60 KB example), zero dependencies, works in `<img>` and
    everywhere the file travels
  - ✅ animations survive sanitizers (GitHub, CMSs)
  - ❌ path morphing requires all keyframe paths to share the same command structure
    (painful hand work); no timeline control; fire-and-forget
- **GSAP + MorphSVG**
  - ✅ `morphSVG` normalizes paths automatically — morph between shapes with different
    point counts in one line; full timeline control (pause/seek/reverse/stagger)
  - ✅ DrawSVG, easing library, scroll triggers
  - ❌ requires the library (~230 KB min) loaded in the page and the SVG **inlined**
    (JS never runs inside `<img>`); animation is lost where scripts are stripped

If the user does not answer or does not care, default to **SMIL**.

## Workflow

1. **Inspect the source** (skip if there is no video; then go to step 3).
   `bash scripts/extract_frames.sh <video> <outdir>` prints fps/duration/size, writes a
   contact sheet (`contact.png`) and a few full-res frames. Open the contact sheet and
   write down the *beats* of the motion (e.g. streaks -> outline draws -> fill -> text
   slides in -> sparkle burst -> fade/loop) with approximate timestamps.
2. **Trace the artwork** from the cleanest full-res frame (fully formed, nothing blurred):
   `python3 -I scripts/trace_colors.py <frame.png> --k 4 --roi x,y,w,h --out shapes.json --debug debug.png`
   Set `--k` to the number of real flat colours (+1 for the background). Extra clusters
   are usually anti-aliasing blends (washed-out in-between colours): lower `--k`, raise
   `--min-area`, or delete those shapes. Check `debug.png`. Curves that come out stair-stepped (anti-aliasing) should be
   redrawn by hand as a clean `C`/`A` path; eyes, text and small details are better
   hand-built than traced. Drop stray contours (shadows, ghost text, tiny specks).
3. **Write a generator script** (Python) that emits the animation. For SMIL use
   `scripts/smil_helpers.py` (`anim`, `kt`, `splines`) so keyTimes/keySplines are always
   consistent; for GSAP emit an inline `<script>` block with a `gsap.timeline()`. Keep one
   master duration `T` and express every animation as `(seconds, value)` pairs so the whole
   piece loops seamlessly. See `examples/build_camaleao.py` for a complete SMIL example.
4. **Verify visually, always.** Vector animation cannot be judged from the code:
   `python3 -I scripts/preview_svg.py out.svg --times 0.3,1,2,3.5 --out preview.png`
   (headless Chromium via Playwright, pauses the animation and calls `setCurrentTime`).
   Read the contact sheet, fix, repeat. Check the first and last frames match (loop).
5. **Deliver** the file (and the generator script if the user may want to tweak it).
   Mention differences from the source honestly (redrawn shapes, font fallback, etc.).

## Output pipeline details

### SMIL mode

- One master duration `T` on every `<animate>`; `repeatCount="indefinite"`.
- Pure vector file: works inside `<img>`, GitHub READMEs and sanitizing CMSs.
- Morphing limitation: `<animate attributeName="d">` only interpolates paths with the
  exact same command sequence. Hand-compatible states only (see morphing section).

### GSAP mode

- Load `gsap.min.js` + `MorphSVGPlugin` (both free since the Webflow acquisition, 2025).
- The SVG must be **inlined** in the HTML (or fetched and injected) so scripts run.
- Emit a `gsap.timeline({ repeat: -1 })` with the same `(seconds, value)` pairs the
  SMIL version would use — the verification step (Playwright) works the same way.
- Delivery to the user: an `.html` snippet (inline SVG + script tags) or the SVG plus
  a JS file, since the animation no longer lives inside the `.svg` file itself.

## Reusable motion patterns

- **Line drawing:** `pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"` then animate
  `stroke-dashoffset` 1 -> 0; stagger start by x position for a sweep. Fade stroke out and
  fill in afterwards (`fill-opacity` 0 -> .45 -> 1 gives the "pastel then solid" look).
  With GSAP, DrawSVG does the same with `drawSVG: "0%"`.
- **Speed streaks:** thick round-cap `<line>`s in a `<g>` whose `translate` moves along a
  diagonal while `opacity` goes 0 -> 1 -> 0; spline ease-in for acceleration.
- **Impact:** expanding stroke-only circles (r up, opacity/stroke-width down), a radial-gradient
  flash, 10-14 radial spark `<rect>`/`<line>`s translating outward, 6-8px screen shake on the
  root group.
- **Particles / orbits:** compute positions in Python (ellipse in a tilted vertical plane:
  `x=R sin(phi) cos(a)`, `z=R sin(phi) sin(a)`, `y=-R cos(phi) cos(p)+z sin(p)`), sample
  ~0.1s keyframes, write them as `values` on an `animateTransform translate`; derive size and
  opacity from depth `z/R` for the 3D feel. Omit `keyTimes` for evenly spaced samples to
  keep the file small. Particles that "become" a shape: blend orbit position -> target with
  `smoothstep`.
- **Scale/move a whole group about its centre:** nest `translate(pos)` > `scale(s)` >
  `translate(-centre)` and animate the first two.
- **Blink:** animate `scale` "1 1" -> "1 0.08" -> "1 1" on a group centred on the eye.

## Organic path morphing

Flowing, organic strokes that travel around a silhouette and *become* its outline are
the hardest vector move. Two ways:

- **GSAP (recommended):** draw the stroke in N hand-keyed states (hugging the silhouette,
  stretching, snapping onto the outline segment) — the states do **not** need matching
  command structures. Then `tl.to("#stroke", { morphSVG: "#outline-seg", ease: "power2.inOut" })`,
  staggered per segment. MorphSVG normalizes point counts and finds the point mapping.
- **SMIL (hard mode):** hand-build every keyframe path with the *same* command sequence
  (same number and types of `C`/`L` segments), then
  `<animate attributeName="d" values="s0;s1;s2" calcMode="spline" .../>`. Feasible for
  2-3 states of a simple curve; genuinely painful beyond that.

Rule of thumb: **if the user's video shows strokes morphing into artwork, prefer the
GSAP pipeline** (say so in step 0), or simplify the effect to a line-drawing + fill
approach in SMIL and state the difference honestly.

## Pitfalls (these silently break animations)

- `keySplines` needs exactly **(number of keyTimes - 1)** entries, and `calcMode="spline"`
  must be set. A wrong count makes the browser ignore the whole animation. `smil_helpers.anim`
  generates the right count.
- `keyTimes` must start at 0, end at 1 and be increasing; `values` count must match.
- Multiple `animateTransform` on one element override each other -> nest groups instead.
- Do not animate the same attribute twice on one element (e.g. opacity on a `<g>` and a child
  is fine; two `opacity` animations on the same element is not).
- GSAP: several `gsap.to()` on the same target/property need `overwrite: "auto"` or a
  single timeline, or tweens fight each other — same root cause, different syntax.
- Text: use a font stack (`Montserrat, 'Segoe UI', Helvetica, Arial, sans-serif`); web fonts do
  not load when the SVG is used in `<img>`. Offer converting text to paths for exact fidelity.
- Keep the file small: round numbers to 1 decimal, avoid per-frame `keyTimes`, reuse gradients.
- A 0.5 MB SVG with ~600 SMIL animations still runs fine in modern browsers; warn about
  weak devices if you go beyond that.
- Respect IP: recreate motion/style, do not trace copyrighted logos or characters the user
  does not own. Their own logo/artwork is fine.

## Setup notes

- Needs: `ffmpeg`/`ffprobe`, Python 3 with `opencv-python`, `numpy`, `pillow`, and
  `playwright` (+ `playwright install chromium`) for previews.
- GSAP mode additionally needs `gsap.min.js` + `MorphSVGPlugin` served with the page
  (download from https://gsap.com or the gsap npm package; both free since 2025).
- Install: `pip install -r requirements.txt && playwright install chromium`
  (`ffmpeg` via `apt install ffmpeg` / `brew install ffmpeg` / `winget install ffmpeg`).
- Full chronological record of the original sessions (every command, parameter, bug and
  fix, with timings of each animation): `references/workflow-complete.md`. Read it when
  you need exact values or want to reproduce one of the three example animations.
- Run user-provided files through `python3 -I` and keep scripts outside the folder holding
  downloaded/untrusted data.
