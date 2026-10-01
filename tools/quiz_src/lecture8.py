import math
from common import Lecture, fmt, val

L = Lecture(8, "Rotation")
D = "Lecture 8 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))
pi = math.pi

n = 3.5
L.N(f"A wheel turns through {fmt(n, 2)} complete revolutions. What is its angular displacement in radians?",
    2 * pi * n, "rad", [360 * n, n, n / (2 * pi)],
    f"One revolution is 2π rad, so θ = (2π)({fmt(n, 2)}) = {{a}}. The value {fmt(360 * n)} is the displacement in degrees. The deck works with radians because s = rθ and v = ωr hold only when θ is in radians.",
    D + "‘Angle in radians’")

rpm = 45.0
L.N(f"A turntable rotates at {fmt(rpm, 2)} revolutions per minute. What is its angular speed in rad/s?",
    rpm * 2 * pi / 60, "rad/s", [rpm * 2 * pi, rpm / 60, 2 * rpm * 2 * pi / 60],
    f"ω = (45 rev/min)(2π rad/rev)(1 min/60 s) = {{a}}. The value {fmt(rpm * 2 * pi)} forgets to convert minutes to seconds, and {fmt(rpm / 60)} is the frequency in revolutions per second, not an angular speed in rad/s.",
    D + "‘Angular velocity and angular acceleration’ and ‘Toolkit 1’")

w, R = 12.0, 0.35
L.N(f"A wheel of radius {fmt(R, 2)} m turns at a constant angular speed of {fmt(w, 3)} rad/s. What is the speed of a point on its rim?",
    w * R, "m/s", [w / R, R / w, w ** 2 * R],
    f"For a point at distance r from the axis, v = ωr = ({fmt(w, 3)})({fmt(R, 2)}) = {{a}}. Dividing gives {fmt(w / R)}, which does not have the units of speed. The value {fmt(w ** 2 * R)} is the radial acceleration, ω²r, in m/s².",
    D + "‘Toolkit 2: linking linear and angular motion’")

R, w, al = 0.50, 3.0, 8.0
at, ar = al * R, w ** 2 * R
L.N(f"A point on the rim of a wheel of radius {fmt(R, 2)} m moves with angular speed {fmt(w, 2)} rad/s while the wheel is speeding up with an angular acceleration of {fmt(al, 2)} rad/s². What is the magnitude of the total acceleration of the point?",
    math.hypot(at, ar), "m/s²", [at + ar, ar, at],
    f"The tangential acceleration is a<sub>t</sub> = αr = {fmt(at)} m/s² and the radial acceleration is a<sub>rad</sub> = ω²r = {fmt(ar)} m/s². These are perpendicular, so a = √(a<sub>t</sub>² + a<sub>rad</sub>²) = {{a}}. Adding the magnitudes, {fmt(at + ar)} m/s², is wrong because the components are at right angles.",
    D + "‘Lecturer example: a point on a speeding-up wheel’ and ‘A point on a speeding-up wheel: solution’")

L.C("Two points on a wheel that rotates about a fixed axis are at distances of 0.10 m and 0.30 m from the axis. Which statement about their motion is correct?",
    "They have the same angular speed, and the outer point has the greater linear speed.",
    ["They have the same linear speed, and the outer point has the greater angular speed.", "They have the same linear speed and the same angular speed.", "They have the same angular speed and the same linear speed, because they are on the same wheel."],
    "Every point of a rigid rotating body turns through the same angle in the same time, so all points have the same ω. The linear speed v = ωr is proportional to the distance r from the axis, so the outer point is faster.",
    D + "‘Two points on one wheel’")

w0, t = 40.0, 8.0
th = 0.5 * w0 * t
revs = th / (2 * pi)
L.N(f"A washing-machine drum spinning at {fmt(w0, 3)} rad/s is braked with a constant angular deceleration until it stops after {fmt(t, 2)} s. How many revolutions does the drum make while stopping?",
    revs, "rev", [th, 2 * revs, revs / 2],
    f"With constant α, θ = ½(ω₀ + ω)t = ½({fmt(w0, 3)} + 0)({fmt(t, 2)}) = {fmt(th)} rad. One revolution is 2π rad, so the number of revolutions is {fmt(th)}/(2π) = {{a}}. The value {fmt(th)} is the angle in radians, not revolutions.",
    D + "‘Lecturer example: a braking washing-machine drum’ and ‘Toolkit 1’")

w1, w2, tt = 10.0, -6.0, 4.0
al = (w2 - w1) / tt
L.N(f"On an ω–t graph the angular velocity falls along a straight line from {fmt(w1, 2)} rad/s at t = 0 to {fmt(w2, 2)} rad/s at t = {fmt(tt, 2)} s. What is the angular acceleration?",
    al, "rad/s²", [-al, w1 / tt, w2 / tt],
    f"The slope of an ω–t graph is the angular acceleration: α = Δω/Δt = ({fmt(w2, 2)} − {fmt(w1, 2)})/{fmt(tt, 2)} = {{a}}. The sign is negative because ω decreases. The wheel first slows, stops at t = {fmt(w1 / -al)} s, and then turns in the opposite direction with increasing speed.",
    D + "‘Concept check: reading an ω(t) graph’ and ‘Reading an ω(t) graph: answers’", typ="graph")

ms = [(1.0, 0.20), (3.0, 0.50)]
I = sum(m * r ** 2 for m, r in ms)
L.N(f"Two small masses are attached to a light rod that rotates about a fixed axis: {fmt(ms[0][0], 2)} kg at {fmt(ms[0][1], 2)} m from the axis and {fmt(ms[1][0], 2)} kg at {fmt(ms[1][1], 2)} m from the axis. What is the moment of inertia about the axis?",
    I, "kg·m²", [sum(m * r for m, r in ms), sum(m for m, r in ms) * (sum(r for m, r in ms) / 2) ** 2, 0.5 * I],
    f"For separate particles I = Σmr² = ({fmt(ms[0][0], 2)})({fmt(ms[0][1], 2)})² + ({fmt(ms[1][0], 2)})({fmt(ms[1][1], 2)})² = {{a}}. The distance is squared, so the mass farther from the axis dominates. Using mr gives {fmt(sum(m * r for m, r in ms))}, which has the wrong units.",
    D + "‘Kinetic energy of rotation and the moment of inertia’ and ‘Toolkit 3: moment of inertia’")

M, Lr = 2.0, 1.20
Icm = M * Lr ** 2 / 12
Iend = M * Lr ** 2 / 3
L.N(f"A uniform thin rod of mass {fmt(M, 2)} kg and length {fmt(Lr, 3)} m has I<sub>cm</sub> = ML²/12 about an axis through its centre, perpendicular to the rod. What is its moment of inertia about a parallel axis through one end?",
    Iend, "kg·m²", [Icm, M * Lr ** 2 / 2, M * Lr ** 2],
    f"Use the parallel-axis theorem: I = I<sub>cm</sub> + Md², with d = L/2 = {fmt(Lr / 2, 2)} m. Then I = {fmt(Icm)} + ({fmt(M, 2)})({fmt(Lr / 2, 2)})² = {{a}}, which equals ML²/3. The end of the rod is farther from the axis than the centre, so I about the end is larger than I<sub>cm</sub> = {fmt(Icm)} kg·m².",
    D + "‘The parallel-axis theorem’ and ‘Lecturer example: one body, three axes’")

L.C("A hoop and a uniform solid disc have the same mass and the same radius. Each turns about a central axis perpendicular to its plane. Which has the greater moment of inertia, and why?",
    "The hoop, because all of its mass is at the full radius from the axis",
    ["The disc, because it has more material near the centre", "They are equal, because the mass and the radius are equal", "The disc, because it has the larger area"],
    "I = Σmr² grows when mass sits farther from the axis. A hoop has I = MR², while a solid disc has I = ½MR², because part of the disc’s mass is closer to the axis. The moment of inertia depends on how the mass is distributed, not only on M and R.",
    D + "‘An opening question: the disc and the hoop’ and ‘Moments of inertia of standard bodies’")

r, F, ph = 0.40, 25.0, 30.0
L.N(f"A force of {fmt(F, 3)} N is applied at a point {fmt(r, 2)} m from a pivot. The angle between the force and the line from the pivot to the point is {fmt(ph, 2)}°. What is the magnitude of the torque about the pivot?",
    r * F * sin(ph), "N·m", [r * F * cos(ph), r * F, F * sin(ph)],
    f"Torque has magnitude τ = rF sin φ, where φ is the angle between r and F: τ = ({fmt(r, 2)})({fmt(F, 3)}) sin {fmt(ph, 2)}° = {{a}}. Only the component of the force perpendicular to r produces torque. Using cosine, or dropping the angle, gives the wrong values {fmt(r * F * cos(ph))} and {fmt(r * F)} N·m.",
    D + "‘Torque’ and ‘Toolkit 4: torque’")

L.C("Torque and energy both have SI units of newton metres. Which statement is correct?",
    "Torque is a vector related to turning about an axis, and it is not an energy, so it is not expressed in joules.",
    ["Torque is a scalar, so it can be added to energies directly.", "Torque and energy are the same quantity, so the unit joule is used for both.", "Torque is an energy, because force times distance is energy."],
    "Energy is a scalar, the work done by a force over a displacement. Torque is a vector given by r × F, with r and F perpendicular in the useful case, and it describes the tendency to change rotation. The unit N·m is the same, but the joule is reserved for energy and work, so torque is written in N·m.",
    D + "‘Torque and energy are different quantities’", "misconception")

M, R, F = 4.0, 0.30, 6.0
tau = F * R
I = 0.5 * M * R ** 2
L.N(f"A cord wound round a uniform solid disc of mass {fmt(M, 2)} kg and radius {fmt(R, 2)} m is pulled with a constant force of {fmt(F, 2)} N tangent to the rim. The disc turns about its central axis. What is its angular acceleration?",
    tau / I, "rad/s²", [tau / (M * R ** 2), tau / (M * R ** 2) * 0.25, F / M],
    f"Use Στ = Iα. The torque is τ = FR = {fmt(tau)} N·m and for a solid disc I = ½MR² = {fmt(I)} kg·m². So α = τ/I = {{a}}. Using I = MR², the value for a hoop, gives {fmt(tau / (M * R ** 2))}. The value {fmt(F / M)} is the linear acceleration F/M, not an angular one.",
    D + "‘Toolkit 5: rotational dynamics’ and ‘Lecturer example: pulling a cord wound on a disc’")

Mp, R, m = 2.0, 0.10, 3.0
a = m * g / (m + Mp / 2)
L.N(f"A {fmt(m, 2)} kg mass hangs from a light cord wound round a pulley, which is a uniform solid disc of mass {fmt(Mp, 2)} kg and radius {fmt(R, 2)} m. The pulley turns freely about its axis and the cord does not slip. What is the acceleration of the hanging mass?",
    a, "m/s²", [g, m * g / (m + Mp), g / 2],
    f"For the mass, mg − T = ma. For the pulley, TR = Iα with I = ½MR² and α = a/R, so T = ½Ma. Adding the equations gives mg = (m + ½M)a, so a = mg/(m + ½M) = {{a}}. The acceleration is less than g because the pulley has to be spun up. Treating the pulley mass as if it were all in the load, mg/(m + M), gives {fmt(m * g / (m + Mp))} m/s².",
    D + "‘Lecturer example: a mass on a cord turns a pulley’ and ‘The pulley: Newton’s laws for the acceleration’")

tau, n = 40.0, 3.0
th = 2 * pi * n
L.N(f"A constant torque of {fmt(tau, 3)} N·m turns a flywheel through {fmt(n, 2)} revolutions. How much work does the torque do?",
    tau * th, "J", [tau * n, tau * 360 * n, 0.5 * tau * th],
    f"For a constant torque, W = τθ with θ in radians. Here θ = (2π)({fmt(n, 2)}) = {fmt(th)} rad, so W = ({fmt(tau, 3)})({fmt(th)}) = {{a}}. Using the number of revolutions, {fmt(n, 2)}, instead of radians gives {fmt(tau * n)} J, and using degrees gives {fmt(tau * 360 * n)} J. Both are wrong.",
    D + "‘Work and power of a torque’ and ‘Lecturer example: a flywheel under a constant torque’")

M, R, w = 1.5, 0.20, 30.0
I = 0.5 * M * R ** 2
K = 0.5 * I * w ** 2
L.N(f"A uniform solid disc of mass {fmt(M, 2)} kg and radius {fmt(R, 2)} m spins about its central axis at {fmt(w, 3)} rad/s. What is its rotational kinetic energy?",
    K, "J", [I * w ** 2, I * w, 0.25 * I * w ** 2],
    f"First I = ½MR² = ½({fmt(M, 2)})({fmt(R, 2)})² = {fmt(I)} kg·m². Then K = ½Iω² = ½({fmt(I)})({fmt(w, 3)})² = {{a}}. Omitting the ½ gives {fmt(I * w ** 2)} J, and Iω = {fmt(I * w)} kg·m²/s is the angular momentum, not an energy.",
    D + "‘Kinetic energy of rotation and the moment of inertia’ and ‘Toolkit 6’")

L.C("A solid sphere, a solid disc and a hoop, all of the same mass and radius, are released together from rest at the top of an incline and roll without slipping. In what order do they reach the bottom?",
    "The sphere first, then the disc, then the hoop",
    ["They arrive together, because they have the same mass and radius", "The hoop first, then the disc, then the sphere", "The disc first, then the sphere, then the hoop"],
    "Rolling without slipping shares the energy between translation and rotation: K = ½Mv² + ½Iω² with ω = v/R. A body with a smaller I/(MR²) puts less energy into rotation and so gains more translational speed. The ratios are 2/5 for the sphere, 1/2 for the disc and 1 for the hoop. The mass and radius cancel.",
    D + "‘Concept check: a race down an incline’ and ‘The race: solution’")

hh = 1.20
v = math.sqrt(10 * g * hh / 7)
L.N(f"A solid sphere rolls without slipping from rest down a slope, falling through a height of {fmt(hh, 3)} m. What is its speed at the bottom? For a solid sphere I = (2/5)MR².",
    v, "m/s", [math.sqrt(2 * g * hh), math.sqrt(4 * g * hh / 3), math.sqrt(g * hh)],
    f"Energy conservation with rolling: Mgh = ½Mv² + ½Iω² = ½Mv² + ½(2/5)MR²(v/R)² = (7/10)Mv². So v = √(10gh/7) = {{a}}. The value {fmt(math.sqrt(2 * g * hh))} m/s would be the speed of a block sliding without friction, with no rotational energy. The value {fmt(math.sqrt(4 * g * hh / 3))} m/s would be for a solid disc.",
    D + "‘Energy with rotation, and rolling’ and ‘Your turn: a sphere rolls up an incline’")

L.C("A skater spinning on ice pulls her arms in close to her body. Her angular speed increases. What happens to her rotational kinetic energy?",
    "It increases, because the skater does work in pulling her arms in.",
    ["It stays the same, because angular momentum is conserved.", "It decreases, because the moment of inertia decreases.", "It increases by creating energy from nothing."],
    "With no external torque, L = Iω is constant. As I decreases, ω increases in proportion. K = L²/(2I), so K rises when I falls. The extra energy comes from the work done by the skater’s muscles as she pulls her arms inward. Angular momentum is conserved, but kinetic energy is not.",
    D + "‘Concept check: a skater pulls in her arms’ and ‘Conservation of angular momentum’", "misconception")

I1, w1, mc, rc = 200.0, 1.50, 30.0, 2.0
I2 = I1 + mc * rc ** 2
wf = I1 * w1 / I2
L.N(f"A merry-go-round with moment of inertia {fmt(I1, 3)} kg·m² turns at {fmt(w1, 3)} rad/s. A {fmt(mc, 2)} kg child, initially at rest, jumps on at a distance of {fmt(rc, 2)} m from the axis. What is the new angular speed? Neglect friction at the bearing.",
    wf, "rad/s", [w1, I1 * w1 / (I1 + mc), I1 * w1 / (I1 + mc * rc)],
    f"There is no external torque about the axis, so L = Iω is conserved: I₁ω₁ = (I₁ + mr²)ω₂. Then ω₂ = (200)(1.50)/(200 + (30.0)(2.00)²) = {{a}}. The child adds mr² = {fmt(mc * rc ** 2)} kg·m² to the moment of inertia, so the speed decreases. Leaving the distance squared out of the child’s term gives wrong values.",
    D + "‘Your turn: a child jumps on a merry-go-round’ and ‘Toolkit 7: angular momentum and its conservation’")
