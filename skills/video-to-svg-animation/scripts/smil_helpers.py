"""Small helpers to generate consistent SMIL animations.

    from smil_helpers import Timeline
    tl = Timeline(T=7.0)
    tl.anim("opacity", [(1.0, 0), (1.5, 1), (6.0, 1), (6.5, 0)])
    tl.anim("", [(0, "0 0"), (2, "100 0")], tag="animateTransform", type="translate", ease=True)

Every animation shares the master duration T, so the whole piece loops seamlessly.
keyTimes are normalised to 0..1 and the first/last keyframes are padded to 0 and T.
With ease=True, keySplines gets exactly (keyframes - 1) entries (a wrong count makes
browsers silently ignore the animation).
"""

EASE_IN_OUT = ".45 0 .2 1"
EASE_IN = ".6 0 1 1"


class Timeline:
    def __init__(self, T=7.0):
        self.T = T

    def kt(self, s):
        return f"{s / self.T:.4f}"

    def anim(self, attr, pairs, tag="animate", type=None, ease=False, spline=EASE_IN_OUT, extra=""):
        pairs = sorted(pairs, key=lambda p: p[0])
        if pairs[0][0] > 0:
            pairs.insert(0, (0, pairs[0][1]))
        if pairs[-1][0] < self.T:
            pairs.append((self.T, pairs[-1][1]))
        kts = ";".join(self.kt(p[0]) for p in pairs)
        vals = ";".join(str(p[1]) for p in pairs)
        calc = ""
        if ease:
            calc = 'calcMode="spline" keySplines="%s"' % ";".join([spline] * (len(pairs) - 1))
        if tag == "animateTransform":
            return (f'<animateTransform attributeName="transform" type="{type}" dur="{self.T}s" '
                    f'repeatCount="indefinite" keyTimes="{kts}" values="{vals}" {calc} {extra}/>')
        return (f'<animate attributeName="{attr}" dur="{self.T}s" repeatCount="indefinite" '
                f'keyTimes="{kts}" values="{vals}" {calc} {extra}/>')


def smoothstep(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def fmt(v, nd=1):
    return f"{v:.{nd}f}"
