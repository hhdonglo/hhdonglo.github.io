import math
from common import Lecture, fmt, val

L = Lecture(2, "Motion")
D = "Lecture 2 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))
atan = lambda x: math.degrees(math.atan(x))

L.C("A cyclist rides 60 m east along a straight road and then 20 m back towards the west. What are the displacement and the distance travelled?",
    "Displacement 40 m east, distance 80 m",
    ["Displacement 80 m east, distance 40 m", "Displacement 40 m east, distance 40 m", "Displacement 80 m east, distance 80 m"],
    "Displacement is the change in position: +60 m − 20 m = +40 m, which is 40 m east. Distance is the total path length, 60 m + 20 m = 80 m. Distance is never smaller than the magnitude of the displacement.",
    D + "‘Position and displacement in one dimension’ and ‘Concept check: distance or displacement?’")

v1, t1, d2, t2 = 2.0, 45.0, 30.0, 10.0
x1 = v1 * t1
avg = (x1 - d2) / (t1 + t2)
spd = (x1 + d2) / (t1 + t2)
L.N(f"A student walks {fmt(x1, 2)} m east in {fmt(t1, 2)} s, then {fmt(d2, 2)} m west in {fmt(t2, 2)} s. What is the average velocity for the whole {fmt(t1 + t2, 2)} s? Take east as positive.",
    avg, "m/s", [spd, (v1 - d2 / t2) / 2, (v1 + d2 / t2) / 2],
    f"Average velocity is the displacement divided by the total time: ({fmt(x1, 2)} − {fmt(d2, 2)}) m / {fmt(t1 + t2, 2)} s = {{a}}, in the positive (east) direction. The value {fmt(spd)} m/s is the average speed, found from the total distance. Averaging the two velocities, {fmt(v1, 2)} m/s and {fmt(-d2 / t2, 2)} m/s, does not work because the time intervals differ.",
    D + "‘Average velocity and average speed’")

c3 = -0.50; c2 = 3.0; x0 = 4.0; t = 5.0
x = lambda tt: x0 + c2 * tt ** 2 + c3 * tt ** 3
vv = lambda tt: 2 * c2 * tt + 3 * c3 * tt ** 2
L.N(f"The position of a particle is x(t) = {fmt(x0, 2)} + {fmt(c2, 2)}t² − {fmt(-c3, 2)}t³, with x in metres and t in seconds. What is its velocity at t = {fmt(t, 2)} s?",
    vv(t), "m/s", [-vv(t), x(t), (x(t) - x(0)) / t],
    f"Differentiate: v = dx/dt = {fmt(2 * c2, 2)}t − {fmt(-3 * c3, 2)}t². At t = {fmt(t, 2)} s, v = {{a}}. The negative sign means the particle moves in the −x direction. The value {fmt(x(t))} is the position, not the velocity, and {fmt((x(t) - x(0)) / t)} m/s is the average velocity over the first {fmt(t, 2)} s, not the instantaneous velocity.",
    D + "‘Toolkit 2: the calculus of motion’ and ‘Lecturer example: velocity from position’")

xa, xb, tb = 8.0, 2.0, 3.0
L.N(f"On an x–t graph the plot is a straight line falling from x = {fmt(xa, 2)} m at t = 0 to x = {fmt(xb, 2)} m at t = {fmt(tb, 2)} s. What is the velocity of the object?",
    (xb - xa) / tb, "m/s", [(xa - xb) / tb, xa / tb, (xa + xb) / tb],
    f"The slope of an x–t graph is the velocity. The slope is ({fmt(xb, 2)} − {fmt(xa, 2)}) m / {fmt(tb, 2)} s = {{a}}. The sign is negative because x decreases, so the object moves in the −x direction at constant speed. The height of the graph is the position, not the speed.",
    D + "‘Concept check: reading an x–t graph’ and ‘Toolkit 3: reading motion graphs’", typ="graph")

L.C("The x–t graph of a ball thrown straight up is a downward-opening parabola with its peak at t = 2.0 s. What are the velocity and acceleration of the ball at t = 2.0 s?",
    "The velocity is zero and the acceleration is about 9.8 m/s² downward.",
    ["The velocity is zero and the acceleration is zero.", "The velocity is zero and the acceleration is about 9.8 m/s² upward.", "The velocity is upward and the acceleration is zero."],
    "The slope of the x–t graph is zero at the peak, so the velocity is zero there. The curvature of the graph is downward at every point, so the acceleration is −9.8 m/s² at every point, including the top. Zero velocity does not mean zero acceleration.",
    D + "‘Concept check: reading an x–t graph’ and ‘Free fall’", "graph")

L.C("An object moves along the x axis with velocity −4 m/s and acceleration −2 m/s². What is happening to its speed?",
    "The speed is increasing, because the velocity and the acceleration have the same sign.",
    ["The speed is decreasing, because the acceleration is negative.", "The speed is constant, because the acceleration is constant.", "The speed cannot be found without knowing the position."],
    "When v and a have the same sign, the object speeds up. When the signs are opposite, it slows down. A negative acceleration does not by itself mean slowing down. Here the object moves in the −x direction and is accelerated further in the −x direction.",
    D + "‘Rule: speeding up or slowing down’", "misconception")

va, vb, dt = 12.0, -8.0, 4.0
aavg = (vb - va) / dt
L.N(f"The velocity of a trolley changes from {fmt(va, 2)} m/s to {fmt(vb, 2)} m/s in {fmt(dt, 2)} s, taking the first direction as positive. What is its average acceleration?",
    aavg, "m/s²", [-aavg, (va + vb) / dt, vb / dt],
    f"Average acceleration is Δv/Δt = (v₂ − v₁)/Δt = ({fmt(vb, 2)} − {fmt(va, 2)}) m/s / {fmt(dt, 2)} s = {{a}}. The sign is negative because the velocity changed towards the negative direction. Subtract the initial velocity from the final one, keeping the signs, rather than combining speeds.",
    D + "‘Average acceleration’")

v0, vf, tf = 6.0, -2.0, 4.0
tz = v0 / (v0 - vf) * tf
disp = 0.5 * (v0 + vf) * tf
L.N(f"On a v–t graph the plot is a straight line from {fmt(v0, 2)} m/s at t = 0 to {fmt(vf, 2)} m/s at t = {fmt(tf, 2)} s. What is the displacement during these {fmt(tf, 2)} s?",
    disp, "m", [0.5 * v0 * tz + 0.5 * abs(vf) * (tf - tz), v0 * tf, 0.5 * v0 * tf],
    f"The displacement is the signed area under the v–t graph. The velocity is zero at t = {fmt(tz)} s. The area above the axis is +{fmt(0.5 * v0 * tz)} m and the area below is −{fmt(0.5 * abs(vf) * (tf - tz))} m, so the displacement is {{a}}. The value {fmt(0.5 * v0 * tz + 0.5 * abs(vf) * (tf - tz))} m is the distance, in which the area below the axis is counted as positive.",
    D + "‘Solution: slopes and areas’ and ‘Toolkit 3, completed: reading motion graphs’", typ="graph")

u, a = 24.0, 4.00
dstop = u ** 2 / (2 * a)
L.N(f"A car travelling at {fmt(u, 2)} m/s brakes with a constant acceleration of magnitude {fmt(a)} m/s² until it stops. How far does it travel while braking?",
    dstop, "m", [u ** 2 / a, dstop / 2, u ** 2],
    f"Take +x along the motion, so v₀ = {fmt(u, 2)} m/s, v = 0 and a = −{fmt(a)} m/s². The time is not asked for, so use v² = v₀² + 2a(x − x₀). Then x − x₀ = (0 − {fmt(u ** 2)})/(2(−{fmt(a)})) = {{a}}. The value {fmt(u ** 2 / a)} m forgets the factor 2 in the denominator. The braking distance grows with v₀², so doubling the speed quadruples it.",
    D + "‘Lecturer example: braking distance’ and ‘Toolkit 4’")

L.C("You know the initial velocity, the final velocity and the displacement of an object moving with constant acceleration, and you need the acceleration. Which equation should you use?",
    "v² = v₀² + 2a(x − x₀), the equation that does not contain time",
    ["x − x₀ = v₀t + ½a t², because it contains the displacement",
     "v = v₀ + at, because it contains the acceleration",
     "x − x₀ = ½(v₀ + v)t, because it contains both velocities"],
    "List the five variables: x − x₀, v₀, v, a and t. The one that is neither known nor wanted is t, so choose the equation that omits t. The equation x − x₀ = ½(v₀ + v)t has no a at all, so it cannot give the acceleration.",
    D + "‘Toolkit 4: choosing a constant-acceleration equation’")

L.C("Which motion can be analysed with the constant-acceleration equations?",
    "A car braking steadily along a straight road",
    ["A car whose acceleration increases steadily with time", "A ball whirled at constant speed in a horizontal circle", "Any motion, provided the acceleration at one instant is known"],
    "The equations were derived for constant acceleration along a line. If a changes with time, integrate a(t) instead. In circular motion the acceleration changes direction, so it is not constant. Using the value of a at one instant gives wrong answers, as the counter-example slide shows.",
    D + "‘Rule: the constant-acceleration equations’ and ‘Counter-example: the rule has a limit’", "misconception")

tfall = 3.20
h = 0.5 * g * tfall ** 2
L.N(f"A stone is dropped from rest from a bridge and hits the water {fmt(tfall)} s later. Neglect air resistance and use g = 9.80 m/s². How high is the bridge above the water?",
    h, "m", [g * tfall ** 2, g * tfall, h / 2],
    f"With +y up and v₀ = 0, y − y₀ = ½(−9.80)({fmt(tfall)})² = −{fmt(h)} m, so the bridge is {{a}} high. The value {fmt(g * tfall)} is g t, which is the speed in m/s at the water and not a height. The value {fmt(g * tfall ** 2)} m omits the factor ½.",
    D + "‘Your turn: a stone from a bridge’")

L.C("A ball is thrown straight up. At the very top of its path, what are its velocity and acceleration?",
    "Velocity zero, acceleration 9.80 m/s² downward",
    ["Velocity zero, acceleration zero", "Velocity zero, acceleration 9.80 m/s² upward", "Velocity 9.80 m/s downward, acceleration zero"],
    "Throughout the flight, with air resistance neglected, the acceleration is the free-fall acceleration, 9.80 m/s² downward. At the top the velocity is momentarily zero as it changes from upward to downward. If the acceleration were zero there, the ball would stay at the top.",
    D + "‘Free fall’ and ‘Revisiting the opening throw’", "misconception")

u, H = 12.0, 25.0
a2, b2, c2_ = 0.5 * g, -u, -H
tpos = (u + math.sqrt(u * u + 2 * g * H)) / g
tneg = (u - math.sqrt(u * u + 2 * g * H)) / g
L.N(f"A ball is thrown upward at {fmt(u, 2)} m/s from the edge of a cliff {fmt(H, 2)} m above the ground. Neglect air resistance and use g = 9.80 m/s². How long after the throw does the ball reach the ground?",
    tpos, "s", [tneg, math.sqrt(2 * H / g), u / g],
    f"With +y up, the origin at the ground and y₀ = {fmt(H, 2)} m: 0 = {fmt(H, 2)} + {fmt(u, 2)}t − 4.90t². The two roots are t = {fmt(tpos)} s and t = {fmt(tneg)} s. Only the positive root is physical, so t = {{a}}. The negative root is when the same parabola would have crossed the ground before the throw. The value {fmt(math.sqrt(2 * H / g))} s is the time for a drop with no initial speed, and {fmt(u / g)} s is only the time to reach the highest point.",
    D + "‘Lecturer example: two roots’ and ‘Two roots: solution’")

v0, th = 18.0, 25.0
R = v0 ** 2 * sin(2 * th) / g
L.N(f"A ball is kicked from level ground with a speed of {fmt(v0, 2)} m/s at {fmt(th, 2)}° above the horizontal. Neglect air resistance and use g = 9.80 m/s². What is the horizontal range?",
    R, "m", [v0 ** 2 / g, v0 ** 2 * sin(th) / g, v0 ** 2 * cos(th) / g],
    f"The ball lands when y returns to zero, at t = 2v₀ sin θ/g = {fmt(2 * v0 * sin(th) / g)} s. The range is then (v₀ cos θ)t = v₀² sin 2θ/g = {{a}}. The value {fmt(v0 ** 2 / g)} m is the largest possible range, for a launch at 45°. Using sin θ or cos θ instead of sin 2θ gives {fmt(v0 ** 2 * sin(th) / g)} m or {fmt(v0 ** 2 * cos(th) / g)} m.",
    D + "‘Toolkit 5: projectile motion’ and ‘A long hit: solution’")

L.C("Two identical balls start at the same height at the same instant. One is dropped from rest and the other is fired horizontally. Neglect air resistance. Which statement is correct?",
    "Both balls reach the ground at the same time.",
    ["The dropped ball reaches the ground first.", "The ball fired horizontally reaches the ground first.", "The ball fired horizontally stays in the air longer, because it travels further."],
    "The horizontal and vertical motions are independent and are linked only by the time. Both balls have zero initial vertical velocity and the same vertical acceleration g, so they fall the same height in the same time. The horizontal velocity changes only where the ball lands.",
    D + "‘Independent components’ and ‘An opening puzzle: the monkey and the dart’", "misconception")

R_, f_rpm = 0.080, 2400.0
w = f_rpm * 2 * math.pi / 60
arad = w ** 2 * R_
L.N(f"A laboratory centrifuge rotor spins at {fmt(f_rpm, 3)} revolutions per minute. A sample sits {fmt(R_, 2)} m from the axis. What is the radial acceleration of the sample?",
    arad, "m/s²", [f_rpm ** 2 * R_, w * R_, w ** 2 * (2 * R_)],
    f"First convert to angular speed: ω = 2π(2400/60) = {fmt(w)} rad/s. Then a = ω²R = ({fmt(w)})²({fmt(R_, 2)}) = {{a}}, about {fmt(arad / g, 2)} g. The value {fmt(f_rpm ** 2 * R_)} m/s² keeps the rate in revolutions per minute. The value {fmt(w * R_)} is the speed in m/s, not the acceleration.",
    D + "‘Toolkit 6: circular motion’ and ‘Lecturer example: a laboratory centrifuge’")

L.C("A particle moves at constant speed in a vertical circle. It is at the top of the circle, moving to the right. In which direction is its acceleration?",
    "Downward, towards the centre of the circle",
    ["To the right, along the velocity", "Upward, away from the centre", "The acceleration is zero because the speed is constant"],
    "The velocity is tangent to the path, here horizontal. The speed is constant, so there is no component of acceleration along the path. The velocity still changes direction, and the acceleration v²/R points towards the centre, which is downward at the top.",
    D + "‘Uniform circular motion: the geometry’ and ‘Why the acceleration is v²/R’", "graph")

vb_, vc = 6.0, 2.5
vg = math.hypot(vb_, vc)
L.N(f"A river flows east at {fmt(vc, 2)} m/s relative to the ground. A boat with a speed of {fmt(vb_, 2)} m/s relative to the water is pointed due north. What is the speed of the boat relative to the ground?",
    vg, "m/s", [vb_ + vc, math.sqrt(vb_ ** 2 - vc ** 2), vb_ - vc],
    f"Use the chain v(B/G) = v(B/W) + v(W/G) with components: {fmt(vc, 2)} m/s east and {fmt(vb_, 2)} m/s north. The magnitude is √({fmt(vc, 2)}² + {fmt(vb_, 2)}²) = {{a}}. The two velocities are perpendicular, so their magnitudes do not add. The ground speed is larger than the boat speed, as the sketch suggests.",
    D + "‘Lecturer example: crossing a river’ and ‘Crossing a river: solution’")

vb_, vc = 4.00, 2.00
phi = math.degrees(math.asin(vc / vb_))
L.N(f"A river flows east at {fmt(vc)} m/s relative to the ground. A boat can move at {fmt(vb_)} m/s relative to the water and must travel due north across the river. At what angle west of north should it be pointed?",
    phi, "°", [90 - phi, atan(vc / vb_), atan(vb_ / vc)],
    f"For the ground velocity to point due north, its east component must be zero: −{fmt(vb_)} sin φ + {fmt(vc)} = 0, so sin φ = {fmt(vc / vb_)} and φ = {{a}}, pointing upstream. The value {fmt(atan(vc / vb_))}° uses tan, which would suit a boat pointed due north, not one aimed to cancel the current.",
    D + "‘Your turn: heading straight across’ and ‘Heading straight across: solution’")
