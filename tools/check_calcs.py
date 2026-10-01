"""Independent re-computation of every calculation answer.

Each entry below solves the problem a different way from the authoring script
(components, numerical differentiation, bisection, step-by-step simulation and
so on) and compares the result with the correct option stored in quizzes/.
"""
import glob, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
rad = math.radians
g = 9.80


def bisect(f, lo, hi):
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def deriv(f, t, h=1e-5):
    return (f(t + h) - f(t - h)) / (2 * h)


def simulate_range(v, ang, dt=1e-5):
    x, y = 0.0, 0.0
    vx, vy = v * math.cos(rad(ang)), v * math.sin(rad(ang))
    while True:
        x += vx * dt; vy -= g * dt; y += vy * dt
        if y < 0:
            return x


def simulate_fall(t_end, dt=1e-5):
    y = v = t = 0.0
    while t < t_end:
        v += g * dt; y += v * dt; t += dt
    return y


def time_to_ground(v0, H, dt=1e-5):
    y, v, t = H, v0, 0.0
    while y > 0:
        v -= g * dt; y += v * dt; t += dt
    return t


def trapezoid(f, a, b, n=100000):
    h = (b - a) / n
    return h * (0.5 * f(a) + sum(f(a + i * h) for i in range(1, n)) + 0.5 * f(b))


EXPECT = {
    # Lecture 1
    "L1-04": math.degrees(math.atan2(5.0, 3.0)),
    "L1-07": math.hypot(4.0 + 3.0 * math.cos(rad(50)), 3.0 * math.sin(rad(50))),
    "L1-08": 90 + 40,
    "L1-09": 12.0 * math.sin(rad(-35)),
    "L1-11": math.degrees(math.atan2(-12.0, -5.0)) % 360,
    "L1-12": math.hypot(3.0 + -5.0, -2.0 + 6.0),
    "L1-13": math.sqrt(4 + 9 + 36),
    "L1-14": 2 * 4 + (-3) * 2 + 5 * (-1),
    "L1-15": 5.0 * 4.0 * math.cos(rad(120)),
    "L1-17": abs(6.0 * 3.0 * math.sin(rad(30))),
    "L1-20": (40.0 * math.cos(rad(60))) * 5.0,
    # Lecture 2
    "L2-02": (90.0 - 30.0) / (45.0 + 10.0),
    "L2-03": deriv(lambda t: 4.0 + 3.0 * t ** 2 - 0.5 * t ** 3, 5.0),
    "L2-04": (2.0 - 8.0) / 3.0,
    "L2-07": (-8.0 - 12.0) / 4.0,
    "L2-08": trapezoid(lambda t: 6.0 + (-2.0 - 6.0) / 4.0 * t, 0, 4.0),
    "L2-09": (lambda a: (24.0 / a) * 24.0 / 2)(4.0),
    "L2-12": simulate_fall(3.20),
    "L2-14": time_to_ground(12.0, 25.0),
    "L2-15": simulate_range(18.0, 25.0),
    "L2-17": (2 * math.pi * 2400 / 60) ** 2 * 0.080,
    "L2-19": math.sqrt(6.0 ** 2 + 2.5 ** 2),
    "L2-20": math.degrees(math.asin(2.0 / 4.0)),
}


def parse(text):
    t = text.replace("−", "-")
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)(?:×10<sup>(-?\d+)</sup>)?", t)
    v = float(m.group(1))
    return v * 10 ** int(m.group(2)) if m.group(2) else v


def main():
    bad = checked = 0
    seen = set()
    for path in sorted(glob.glob(os.path.join(ROOT, "quizzes", "lecture*.js"))):
        raw = open(path, encoding="utf-8").read()
        data = json.loads(re.search(r"\]\s*=\s*(\{.*\});\s*$", raw, re.S).group(1))
        for q in data["questions"]:
            if "calc" not in q:
                continue
            seen.add(q["id"])
            if q["id"] not in EXPECT:
                print("NO INDEPENDENT CHECK:", q["id"]); bad += 1; continue
            shown = parse(q["options"][q["answer"]])
            want = EXPECT[q["id"]]
            sf = q["calc"]["sf"]
            ok = abs(shown - want) <= 0.5 * 10 ** (math.floor(math.log10(abs(want))) - sf + 1) * 1.0001 if want else shown == 0
            checked += 1
            if not ok:
                bad += 1
                print(f"MISMATCH {q['id']}: shown {shown}, independent {want}")
    for k in EXPECT:
        if k not in seen:
            print("UNUSED CHECK (no such question):", k); bad += 1
    print(f"{checked} calculation answers re-checked independently; {bad} problems")
    sys.exit(1 if bad else 0)


main()
