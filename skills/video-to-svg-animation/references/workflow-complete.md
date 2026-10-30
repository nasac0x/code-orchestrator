# Complete workflow (faithful record of what was done, step by step)

This document records, in chronological order, everything that was done to create the
three animations (V with collision, V with particles, chameleon from video): tools,
commands, parameters, decisions, errors found and fixes. It serves as a recipe for
repeating or adapting the process.

## 0. Environment and tools used

| Item | Detail |
|---|---|
| Agent tools | `Read` (open files and **images**), `Write` (create files), `Edit` (change snippets), `Bash` (run commands), `SendUserFile` (deliver file; `display: render` for SVG/image, `attach` for zip) |
| Not used | No skills loaded, no web search, no task list, no subagents |
| Programs | `ffmpeg`, `ffprobe`, `python3` (3.13) |
| Python libraries | `opencv-python` 5.0 (cv2), `numpy`, `pillow` 12, `playwright` (headless Chromium) already present in the environment. `scikit-image` and `scipy` existed but were not used. There was no `potrace`, `vtracer`, `inkscape` or `cairosvg` |
| Directories | Working in `/home/claude`; temporaries in the session scratchpad; user uploads in `/root/.claude/uploads/<session>/` (read-only) |
| Final format | Pure SVG with **SMIL** animation (`<animate>`, `<animateTransform>`), no JavaScript, no embedded video |

Safety rule applied: user files read as data; Python scripts run with `python3 -I`
(isolated mode) when reading external files.

## 1. Animation 1: V with circle collision (hand-written)

Request: two circles collide with an impact effect, the letter V appears, the circles
bounce shrinking until they vanish, black particles orbit the V in a semi-frontal view.

1. **Timeline planning** (10 s loop, everything in `keyTimes` from 0 to 1):
   - 0-1.2 s: circles enter from the sides and reach x=360 and x=440 (radius 40).
   - 1.2 s (keyTime 0.12): impact: shock wave (outline-only circle with `r`,
     `opacity`, `stroke-width` animated), second blue ring, flash (`radialGradient`),
     12 sparks (`rect` rotated 30 degrees at a time, `translate` outward), screen shake
     (`translate` on the root group: 0 0; -7 4; 6 -5; -4 3; 2 -1; 0 0).
   - V: polygon `M -65 -65 L -25 -65 L 0 15 L 25 -65 L 65 -65 L 20 65 L -20 65 Z`,
     `scale` 0.2 -> 1.18 -> 1 ("pop" effect) and `opacity` 0 -> 1.
   - Bounce: `cx`, `cy` and `r` with 8 keyframes: cx -60,360,215,310,250,295,268,285;
     cy 300,300,230,300,258,300,278,300; r 40,40,32,24,17,10,5,0. Circle B mirrors
     (800 - cx).
   - Orbit: two rings of 9 and 9 particles; each particle is a `<circle>` with
     `animateMotion` over an elliptical path (`A 55 170` and `A 95 130`), rings tilted
     with `rotate(-18)` and `rotate(22)`; fake depth by animating `r` and `fill-opacity`
     ("front" side larger and more opaque); staggered appearance via `opacity` over
     10 s; different phases with `begin="-0.5s"`, `-1s`...
2. File created with `Write` (`animacao-v.svg`) and delivered with `SendUserFile`
   (`display: render`).
3. **Honest limitation:** this version was delivered **without rendering or checking the
   frames** (Chromium verification only started being used later, with the chameleon).

## 2. Animation 2: V formed by particles (script-generated)

Request: circles at high speed with a speed effect, collide and **become** the black
particles that form the V while orbiting.

1. Decision: generate the SVG via **Python script** (`gerar_v2.py`), because each particle
   has its own trajectory (hundreds of keyframes). Created with `Write`.
2. Main parameters: `T = 13.2 s`, step `DT = 0.12 s` (110 frames),
   impact at `1.2 s`, centre `(400, 300)`.
3. **V target:** V polygon scaled 1.25x; hexagonal grid with 10.5 px spacing
   (`SP`), points kept only if inside the polygon (ray-casting point-in-polygon test),
   jitter of +-0.8 px. Result: **140 particles** form the V, plus **45 orbiters** that
   never settle = 185 in total.
4. **Formation order:** particles sorted bottom-up (key `-y` with +-25 noise),
   settle time `ts = 3.6 + 5.0 * rank/(n-1) +- 0.2 s`, 1.5 s transition with
   `smoothstep`, final radius 6 px.
5. **Simplified 3D orbit** per particle: radius R 115-200; azimuth alpha +-(50-82 degrees);
   tilt 15-25 degrees; period 3.6-6.2 s; random phase. Equations:
   `a=R sin(phi)`, `b=R cos(phi)`, `x=a cos(alpha)`, `z=a sin(alpha)`,
   `y=-b cos(pitch)+z sin(pitch)`, depth `d=z/R` controls size
   (`ro*(1+0.5d)`) and opacity (`0.7+0.3d`).
6. **Explosion:** each particle is born at (360 or 440, ~300) (where the circles were)
   and travels to its ring position in 0.75 s with `easeOutCubic`.
7. **High-speed circles:** group with `translate` accelerating
   (`calcMode="spline" keySplines=".6 0 1 1;0 0 1 1"`), comet-shaped tail
   (`path` with transparent `linearGradient`), 6 coloured streaks (`line`), tail with
   `scale` in x from 0.15 to 1.5, flattened 46x36 ellipse with coloured outline; 6 speed
   lines crossing the background; circle B is the same content with `scale(-1 1)`.
8. Overall fade from 12.0 s to 12.9 s so the loop restarts clean.
9. **To save size:** no `keyTimes` on the keyframe lists (implicit uniform spacing);
   positions rounded to 1 decimal place. Final file: 511,597 bytes.
10. **Incident:** the first `Bash` call returned "NOT RUN" (did not execute). The command
    was redone from scratch starting at `/home/claude`, using the already-saved script;
    output: `V particles: 140 | total: 185 | bytes: 511597`.
11. Delivery: `SendUserFile` with `display: render`. **Also not rendered in a browser
    before delivery.**

## 3. Animation 3: "Page Craft Extract" chameleon from video

Request: transform the video (mp4) into an SVG animation.

### 3.1 Video inspection
- `ffprobe -show_entries stream=codec_name,width,height,r_frame_rate,duration,nb_frames`:
  H.264, 1280x720, 24 fps, 4.0 s, 96 frames, plus an AAC track.
- Frames at 3 fps, width 640 (`ffmpeg -vf "fps=3,scale=640:-1"`) = 12 images, tiled
  into a 4x3 sheet (`tile=4x3`) = `contact.png`, opened with `Read`.
- Reading the sequence: coloured streaks/crescents on the diagonal -> red outline being
  drawn -> pastel fill -> full colour + eye -> chameleon shrinks and the text
  "Page Craft / Extract" slides in -> crests, yellow rays and particles.
- Full-size frames at 1.5; 2.4; 2.9; 3.2 s. Chose **2.4 s** as the vectorization source
  (full body, sharp, text still a ghost).

### 3.2 Vectorization (`trace.py`, later embedded in the build)
- Colour-threshold masks (BGR read by OpenCV; r,g,b as integers):
  red `r>180, g<90, b<90`; yellow `r>200, g>150, b<80`;
  orange `r>200, 110<g<=165, b<70`.
- Region of interest x 280-880, y 180-630 (excludes the ghost text on the right).
- Morphology: 3x3 closing and 2x2 opening; `findContours` (RETR_EXTERNAL);
  `approxPolyDP` with epsilon 1.6 (1.2 on the first attempt); discards area < 25 px.
- Real colours sampled by the **median** of the pixels: red `#da3835`,
  yellow `#f2c422`, orange `#dd9926`.
- **Failure 1:** eye detection by "white" captured the background (huge rectangle).
  Solution: eye hand-made: white circle centre (750,307) r45, red pupil
  (765,308) r15, highlight (770,303) r4.5.
- **Failure 2:** the traced head came out "stair-stepped". Solution: head redrawn as a clean
  curve `M660,205 C745,207 826,262 859,369 L668,370 Z` and the traced shape was discarded.
- Loose contours inside the eye region (orange ring, ghost "G") removed by a
  bounding-box filter (x>690, y>285, x+w<815, y+h<370, area<5000).
- Result: **27 shapes**.

### 3.3 Assembling the animation (`build_camaleao.py`, 7 s loop)
| When | What |
|---|---|
| 0.05-1.5 s | 12 thick streaks (red/yellow) cross on the diagonal (direction 0.64,-0.77), plus 4 yellow crescents |
| 0.55-2.05 s | Outline drawn: `pathLength="1"`, `stroke-dasharray=1`, `stroke-dashoffset` 1 -> 0, **staggered by the x position** of each shape |
| 1.9-2.5 s | Fill: `fill-opacity` 0 -> 0.45 -> 1; stroke fades out at 2.0-2.5; eye appears 2.1-2.5 |
| 2.55-3.3 s | Chameleon moves from centre (640,372, scale 1) to (450,384, scale 0.64); nested groups `translate` > `scale` > `translate(-578 -408)`; easing via `keySplines` |
| 2.7-3.4 s | Text "Page Craft" (weight 700) and "Extract" (weight 300), 57 px, slides 70 px from behind the head with fade |
| 3.35+ s | 4 crests on top of the head (positions computed along the head Bézier curve, on the outer normal) |
| 3.55 / 3.85 / 3.95 s | 3 yellow ray bursts (14, 12 and 9 rays) |
| 4.0-5.4 s | 34 scattered particles |
| 4.9 and 5.55 s | Blinks (`scale` 1 1 -> 1 0.08 -> 1 1 on the eye group) |
| 6.3-6.9 s | Overall fade for the loop |

Ground shadow: ellipse with `cx`, `cy`, `rx` and `opacity` animated alongside the movement.
Background: `radialGradient` #ffffff -> #e9e9ea.

### 3.4 Visual verification (what was missing in animations 1 and 2)
- `playwright` + headless Chromium: `document.documentElement.pauseAnimations()` and
  `setCurrentTime(t)` for each time, `screenshot`, contact sheet with Pillow.
- 1st round (10 times): structure ok; findings: shadow too far away, orange ring/"G" in the eye.
- 2nd round: the "G" persisted; the shadow and text **did not move**.
- **Root cause:** `keySplines` needs (number of keyframes - 1) entries; a fixed number (2)
  was passed where there were 3 intervals, so the browser **ignored the whole animation**.
  Fix: the `anim()` function now generates `keySplines` with the right count
  automatically (`splines(len(pairs)-1)`), and the bounding-box filter was extended to
  all colours.
- 3rd round (times 1.9 / 2.9 / 3.1 / 5.2): everything as expected.
- Delivery: `animacao-camaleao.svg` (59,842 bytes).

## 4. Creating this skill

1. Written with `Write`: `SKILL.md`, `scripts/extract_frames.sh`, `scripts/trace_colors.py`
   (k-means instead of fixed thresholds, to serve any image), `scripts/preview_svg.py`,
   `scripts/smil_helpers.py` (`Timeline` class).
2. Copied to `examples/`: `build_camaleao.py`, `gerar_v_particulas.py`,
   `animacao-camaleao.svg`.
3. **Real tests** of each script: `extract_frames.sh` on the video (12 frames),
   `trace_colors.py` on frame 2.4 s (with `--k 5` it gave 49 fragments, because soft
   edges became intermediate colours; hence the note about `--k`),
   `preview_svg.py` on the chameleon SVG, `smil_helpers.py` (correct keySplines).
4. Packaged with `zipfile` without `__pycache__`, delivered with `SendUserFile` (`attach`).

## 5. Checklist to repeat the process

1. Install requirements (see `requirements.txt` and `SKILL.md`).
2. `extract_frames.sh` -> read `contact.png` -> annotate the motion beats with times.
3. Choose the cleanest full frame -> `trace_colors.py` -> check `debug.png`.
4. Redraw by hand whatever the trace got wrong (curves, eye, text, small details).
5. Generate the SVG by script with `smil_helpers.Timeline` (a single `T` for everything,
   continuous loop). For the GSAP pipeline, emit the same pairs as a
   `gsap.timeline({ repeat: -1 })` instead.
6. `preview_svg.py` on at least 8-10 times, including the first and last frame.
7. Fix, repeat step 6 until correct. Check file size.
8. Deliver the `.svg` (and the generator script), listing the differences from the
   reference.
