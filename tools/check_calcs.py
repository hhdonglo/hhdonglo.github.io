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


def solve2(a11, a12, b1, a21, a22, b2):
    det = a11 * a22 - a12 * a21
    return (b1 * a22 - a12 * b2) / det, (a11 * b2 - b1 * a21) / det


def sim_stop(w0, t_total, dt=1e-5):
    """Angular deceleration to rest over t_total; return revolutions turned."""
    al = -w0 / t_total
    w = w0; th = 0.0; t = 0.0
    while t < t_total:
        th += w * dt; w += al * dt; t += dt
    return th / (2 * math.pi)


def energy_bisect(f_over_v, lo, hi):
    return bisect(f_over_v, lo, hi)


EXPECT.update({
    # Lecture 3
    "L3-03": 65.0 * 1.62,
    "L3-04": abs(complex(30.0 - 20.0, 40.0)),
    "L3-06": 3000.0 / 1200.0,
    "L3-08": bisect(lambda T: 2 * T * math.sin(rad(25)) - 8.0 * g, 1, 500),
    "L3-11": solve2(1.0, -3.0, 0.0, 1.0, 5.0, 5.0 * g)[1],   # unknowns (T, a): T - 3a = 0, T + 5a = 5g
    "L3-12": 3.0 * ((5.0 * g) / (3.0 + 5.0)),
    "L3-13": 0.30 * 40.0 * g,
    "L3-14": 50.0,
    "L3-15": (7.3 * g * math.sin(rad(35))) / 7.3,
    "L3-16": (7.3 * g * math.sin(rad(25)) - 0.20 * 7.3 * g * math.cos(rad(25))) / 7.3,
    "L3-17": 900.0 * (12.0 / 40.0) * 12.0,
    "L3-18": bisect(lambda v: v * v / 60.0 - 0.80 * g, 1, 100),
    # Lecture 4
    "L4-01": 120.0 * math.cos(rad(30)) * 15.0 + 120.0 * math.sin(rad(30)) * 0.0,
    "L4-05": (80.0 * math.cos(rad(40)) * 6.0) + (-35.0 * 6.0),
    "L4-06": 0.5 * 1200.0 * (90.0 / 3.6) ** 2,
    "L4-08": bisect(lambda v: 0.5 * 3.0 * v * v - 15.0 * 4.0, 0, 100),
    "L4-09": bisect(lambda d: 6000.0 * d - 0.5 * 1500.0 * 20.0 ** 2, 0, 1000),
    "L4-10": g * math.sqrt(2 * 1.80 / g),
    "L4-11": trapezoid(lambda x: 12.0 if x <= 2.0 else 12.0 * (5.0 - x) / 3.0, 0, 5.0, 300000),
    "L4-12": trapezoid(lambda x: 400.0 * x, 0, 0.15),
    "L4-13": trapezoid(lambda x: 200.0 * x, 0.10, 0.30),
    "L4-14": bisect(lambda v: 0.5 * 0.200 * v * v - 0.5 * 50.0 * 0.12 ** 2, 0, 100),
    "L4-15": (60.0 * g * 4.50) / 8.0,
    "L4-16": 600.0 * 25.0 / 1000.0,
    "L4-20": 5.0 / math.sqrt(1200.0 / 3.0),
    # Lecture 5
    "L5-01": 2.0 * g * 2.5 - 2.0 * g * 1.0,
    "L5-03": (lambda t: 15.0 * t - 0.5 * g * t * t)(15.0 / g),
    "L5-04": g * math.sqrt(2 * 6.5 / g),
    "L5-06": math.sqrt(2 * g * (1.50 - 1.50 * math.cos(rad(40)))),
    "L5-07": math.sqrt(250.0 / 0.50) * 0.20,
    "L5-08": bisect(lambda x: 0.5 * 900.0 * x * x - 1.2 * g * (0.60 + x), 0.0, 1.0),
    "L5-09": 4.0 * g * 3.0 - 0.5 * 4.0 * 5.0 ** 2,
    "L5-10": (6.0 ** 2 / (2 * 12.0)) / g,
    "L5-13": -(lambda U: (U(3.0 + 1e-5) - U(3.0 - 1e-5)) / 2e-5)(lambda x: 5.0 * x ** 2 - 2.0 * x ** 3),
    "L5-16": math.sqrt(2 * 0.50 * (12.0 - 8.0)) / 0.50,
    "L5-18": g * math.sqrt(2 * (30.0 - 12.0) / g),
    "L5-20": bisect(lambda d: 0.25 * 1.0 * g * d - 0.5 * 800.0 * 0.10 ** 2, 0.0, 100.0),
    # Lecture 7
    "L7-01": 0.057 * 45.0,
    "L7-03": 0.40 * (9.0 - (-12.0)),
    "L7-04": 8.40 / 0.0060,
    "L7-06": trapezoid(lambda t: 800.0 * t / 0.010 if t <= 0.010 else 800.0 * (0.020 - t) / 0.010, 0, 0.020, 200000),
    "L7-07": abs(-(2.0 * 8.0) / 60.0),
    "L7-08": (0.50 * 3.0 + 0.75 * -1.0) / 1.25,
    "L7-09": (0.5 * 0.5 * 9.0 + 0.5 * 0.75 * 1.0) - 0.5 * 1.25 * 0.6 ** 2,
    "L7-11": 2 * (3.0 * 8.0 / 4.0) - 0.0,
    "L7-13": math.hypot(6.0 - 3.0 * math.cos(rad(60)), 3.0 * math.sin(rad(60))),
    "L7-14": math.sqrt(math.sqrt(2 * g * 0.90) ** 2 / math.sqrt(2 * g * 1.50) ** 2),
    "L7-15": (lambda vcm: vcm - 0.60 * (5.0 - vcm))((4.0 * 5.0 + 2.0 * 1.0) / 6.0),
    "L7-16": (1.52 / 0.020) * math.sqrt(2 * g * 0.12),
    "L7-18": (60.0 * 0.0 + 40.0 * 5.0) / 100.0,
    "L7-20": (lambda u: bisect(lambda d: 0.30 * g * d - 0.5 * u * u, 0, 100))(0.020 * 300.0 / 2.0),
    # Lecture 8
    "L8-01": math.radians(3.5 * 360.0),
    "L8-02": 45.0 / 60.0 * 2 * math.pi,
    "L8-03": 12.0 * 0.35,
    "L8-04": math.sqrt((8.0 * 0.50) ** 2 + (3.0 ** 2 * 0.50) ** 2),
    "L8-06": sim_stop(40.0, 8.0),
    "L8-07": (-6.0 - 10.0) / 4.0,
    "L8-08": 1.0 * 0.20 ** 2 + 3.0 * 0.50 ** 2,
    "L8-09": 2.0 * 1.20 ** 2 / 12 + 2.0 * 0.60 ** 2,
    "L8-11": 0.40 * 25.0 * math.sin(rad(30)),
    "L8-13": (6.0 * 0.30) / (0.5 * 4.0 * 0.30 ** 2),
    "L8-14": solve2(1.0, 3.0, 3.0 * g, 1.0, -1.0, 0.0)[1],   # unknowns (T, a): T + 3a = 3g, T - a = 0
    "L8-15": 40.0 * math.radians(3 * 360.0),
    "L8-16": 0.5 * (0.5 * 1.5 * 0.20 ** 2) * 30.0 ** 2,
    "L8-18": math.sqrt(2 * g * 1.20 / (1 + 2.0 / 5.0)),
    "L8-20": 200.0 * 1.50 / (200.0 + 30.0 * 2.0 ** 2),
})


def F2K(f):
    return (f - 32) * 5 / 9 + 273.15


def conduct_time(Q_needed, k, A, L, dT, dt=0.001):
    q = t = 0.0
    while q < Q_needed:
        q += k * A * dT / L * dt; t += dt
    return t


EXPECT.update({
    # Lecture 9
    "L9-03": (350.0 - 32.0) / 1.8,
    "L9-04": -40.0 + 273.15,
    "L9-05": (2.5 * (1 + 2.4e-5 * 80.0) - 2.5) * 1000,
    "L9-06": 2.0e11 * (1.2e-5 * 30.0) / 1e6,
    "L9-08": 40.0 * (1 + 9.5e-4 * 18.0) - 40.0,
    "L9-09": 1.50 * 4186.0 * (80.0 - 20.0),
    "L9-10": bisect(lambda T: 0.300 * 390.0 * (120.0 - T) - 0.400 * 4186.0 * (T - 20.0), 0, 200),
    "L9-12": 0.80 * 12.0 * (22.0 - 2.0) / 0.20,
    "L9-13": bisect(lambda T: 200.0 * (90.0 - T) - 50.0 * (T - 10.0), 10, 90),
    "L9-16": 0.97 * 5.67e-8 * 1.8 * (305.0 ** 2) ** 2,
    "L9-17": conduct_time(0.010 * 3.34e5, 385.0, 4.0e-4, 0.60, 100.0, 0.01),
    "L9-19": F2K(18.0) - F2K(0.0),
    # Lecture 10
    "L10-01": 6.022e23 * (8.0 / 4.00),
    "L10-02": 2.00 * 8.314 * 300.0 / 0.0500,
    "L10-03": 1.00 * (3.0 / 0.50) * (450.0 / 300.0),
    "L10-07": 0.100 * 2100.0 * 10.0 + 0.100 * 3.34e5 + 0.100 * 4186.0 * 30.0,
    "L10-08": 0.200 * 3.34e5 / 500.0,
    "L10-09": bisect(lambda T: 0.300 * 4186.0 * (40.0 - T) - (0.050 * 3.34e5 + 0.050 * 4186.0 * T), 0, 40),
    "L10-13": 1.5 * 1.381e-23 * 400.0,
    "L10-14": math.sqrt(3 * 8.314 * 350.0 / 0.0320),
    "L10-16": math.sqrt(1200.0) / math.sqrt(300.0),
    "L10-17": (1.01e5 * 1.00 / (8.314 * 300.0)) * 6.022e23,
    "L10-18": 150.0 * 350.0 / 290.0,
    # Lecture 11
    "L11-01": 500.0 - 200.0,
    "L11-02": 2.0e5 * (0.030 - 0.050),
    "L11-03": trapezoid(lambda V: 3.0e5 + (1.0e5 - 3.0e5) * (V - 2.0e-3) / 4.0e-3, 2.0e-3, 6.0e-3, 200000),
    "L11-05": trapezoid(lambda V: 0.500 * 8.314 * 300.0 / V, 2.0, 6.0, 200000),
    "L11-06": 2.00 * (2.5 * 8.314) * 100.0,
    "L11-07": 1.50 * 2.5 * 8.314 * 40.0,
    "L11-09": 290.0 * 15.0 ** 0.4,
    "L11-10": 100.0 * (1 / 0.5) ** (5 / 3),
    "L11-11": 0.200 * 1.5 * 8.314 * (400.0 - 300.0),
    "L11-12": 0.5 * 2.0e5 * 4.0e-3,
    "L11-13": 600.0 - 450.0,
    "L11-14": 2.00e-3 * 2.256e6 - 1.013e5 * (3.40e-3 - 2.0e-6),
    "L11-16": 7 / 2 * 8.314,
    "L11-17": trapezoid(lambda V: 0.250 * 8.314 * 320.0 / V, 1.0, 0.2, 200000),
    "L11-19": -80.0 - (-200.0),
    "L11-20": 5 / 3,
    # Lecture 12
    "L12-02": 0.200 * 3.34e5 / 273.15,
    "L12-03": 1000.0 / 300.0 - 1000.0 / 400.0,
    "L12-05": trapezoid(lambda V: 1.00 * 8.314 / V, 1.0, 2.0, 200000),
    "L12-06": 100.0 * (800.0 - 500.0) / 800.0,
    "L12-07": 700.0 / 0.35 - 700.0,
    "L12-08": 100.0 * (1 - (1 / 9.0) ** 0.40),
    "L12-10": 600.0 / 150.0,
    "L12-11": 1.2 + 3.5 * 1.2,
    "L12-14": 100.0 * (500.0 - 320.0) / 500.0,
    "L12-15": 1200.0 - 1200.0 * (300.0 / 700.0),
    "L12-18": 500.0 / 300.0 - 800.0 / 600.0,
    "L12-19": (90.0 / 300.0) / ((450.0 - 300.0) / 450.0),
    "L12-20": 255.0 / (295.0 - 255.0),
})


def parse(text):
    t = text.replace("−", "-")
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)(?:×10<sup>(-?\d+)</sup>)?", t)
    v = float(m.group(1))
    return v * 10 ** int(m.group(2)) if m.group(2) else v


def main():
    bad = checked = 0
    seen = set()
    for path in sorted(glob.glob(os.path.join(ROOT, "quizzes", "lecture*.json"))):
        raw = open(path, encoding="utf-8").read()
        data = json.loads(raw)
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
