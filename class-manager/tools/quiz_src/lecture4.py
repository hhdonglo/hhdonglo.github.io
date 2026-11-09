import math
from common import Lecture, fmt, val

L = Lecture(4, "Work and kinetic energy")
D = "Lecture 4 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))

F, d, th = 120.0, 15.0, 30.0
W = F * d * cos(th)
L.N(f"A sled is pulled {fmt(d, 2)} m along level ground by a rope that exerts a constant force of {fmt(F, 3)} N at {fmt(th, 2)}° above the horizontal. How much work does the rope do on the sled?",
    W, "J", [F * d * sin(th), F * d, F * d * math.cos(th)],
    f"Work by a constant force is W = Fd cos θ = ({fmt(F, 3)})({fmt(d, 2)}) cos {fmt(th, 2)}° = {{a}}. Only the component of the force along the displacement does work. Using sine gives the contribution of the vertical component, {fmt(F * d * sin(th))} J, and leaving out the angle gives the maximum possible value, {fmt(F * d)} J.",
    D + "‘Work by a constant force’ and ‘Toolkit 1: work by a constant force’")

L.C("A box slides along a rough horizontal floor and comes to rest. What is the sign of the work done on the box by kinetic friction?",
    "Negative, because the friction force points opposite to the displacement",
    ["Positive, because friction is what brings the box to a stop", "Zero, because the box ends with no kinetic energy", "Zero, because friction is perpendicular to the displacement"],
    "The sign of the work comes from the angle between the force and the displacement. Kinetic friction opposes the motion, so φ = 180° and W = fd cos 180° = −fd. The negative work removes kinetic energy from the box.",
    D + "‘The sign of work’")

L.C("A crate rests on the flat bed of a truck that is speeding up in a straight line. The crate does not slide on the bed. What is the work done on the crate by static friction, measured in the ground frame?",
    "Positive, because the friction force is in the direction of the crate’s displacement",
    ["Negative, because friction always opposes motion", "Zero, because the crate does not move relative to the truck", "Zero, because static friction never does work"],
    "The only horizontal force on the crate is static friction from the truck bed, and it points forward, along the displacement of the crate over the ground. Hence it does positive work and is what increases the crate’s kinetic energy. Friction does not always oppose motion. It opposes sliding between the surfaces.",
    D + "‘Concept check: can friction do positive work?’", "misconception")

L.C("A waiter carries a tray horizontally at constant velocity. What is the work done on the tray by the waiter’s upward supporting force?",
    "Zero, because the force is perpendicular to the displacement",
    ["Positive, because the waiter is exerting a force", "Positive, because the tray is moving", "Negative, because the force opposes the weight of the tray"],
    "Work is W = Fd cos φ. The supporting force is vertical and the displacement is horizontal, so φ = 90° and W = 0. A force does no work if it is perpendicular to the displacement, however hard it is exerted. Effort in the everyday sense is not work in the physics sense.",
    D + "‘Concept check: which forces do no work?’ and ‘Is a hard workout work?’")

F, th, d, f = 80.0, 40.0, 6.0, 35.0
Wnet = (F * cos(th) - f) * d
L.N(f"A box is dragged {fmt(d, 2)} m across a rough horizontal floor by a rope pulling with a force of {fmt(F, 3)} N at {fmt(th, 2)}° above the horizontal. The friction force is a constant {fmt(f, 2)} N. What is the total work done on the box?",
    Wnet, "J", [F * cos(th) * d, (F - f) * d, f * d],
    f"The weight and the normal force are perpendicular to the displacement and do no work. The rope does {fmt(F * cos(th) * d)} J and friction does −{fmt(f * d)} J, so the net work is {fmt(F * cos(th) * d)} J − {fmt(f * d)} J = {{a}}. Ignoring friction gives {fmt(F * cos(th) * d)} J. Subtracting the friction force from the full rope force ignores the angle.",
    D + "‘Total work on an object’ and ‘Toolkit 2: net work from the free-body diagram’")

m, v = 1200.0, 25.0
K = 0.5 * m * v ** 2
L.N(f"A car of mass {fmt(m, 4)} kg travels at {fmt(v * 3.6, 3)} km/h. What is its kinetic energy?",
    K, "J", [0.5 * m * (v * 3.6) ** 2, m * v, m * v ** 2],
    f"Convert first: {fmt(v * 3.6, 3)} km/h = {fmt(v, 3)} m/s. Then K = ½mv² = ½({fmt(m, 4)})({fmt(v, 3)})² = {{a}}. Using the speed in km/h gives {fmt(0.5 * m * (v * 3.6) ** 2)} J, which is not a joule value. Omitting the ½ gives {fmt(m * v ** 2)} J, and mv is the momentum, not the kinetic energy.",
    D + "‘The physical meaning of kinetic energy’ and ‘Comparing kinetic energies’")

L.C("A car’s speed is doubled. By what factor does its kinetic energy change?",
    "It is multiplied by 4.", ["It is multiplied by 2.", "It is multiplied by 8.", "It does not change, because the mass is the same."],
    "Kinetic energy is K = ½mv², which is proportional to v². Doubling v multiplies K by 2² = 4. This is why the braking distance, which is proportional to the kinetic energy for a fixed braking force, also quadruples.",
    D + "‘Comparing kinetic energies’ and ‘Back to the opening question: braking distance’")

m, Fn, d = 3.0, 15.0, 4.0
Wn = Fn * d
v = math.sqrt(2 * Wn / m)
L.N(f"A {fmt(m, 2)} kg block starts from rest on a smooth horizontal floor. A net horizontal force of {fmt(Fn, 3)} N acts on it over a distance of {fmt(d, 2)} m. What is its final speed?",
    v, "m/s", [Wn / m, math.sqrt(Wn / m), 2 * v],
    f"The work–energy theorem gives W<sub>net</sub> = ΔK. So Fd = ½mv², and v = √(2Fd/m) = √(2({fmt(Fn, 3)})({fmt(d, 2)})/{fmt(m, 2)}) = {{a}}. Forgetting the square root gives {fmt(Wn / m)}, and forgetting the factor 2 inside it gives {fmt(math.sqrt(Wn / m))} m/s.",
    D + "‘Rule: the work–energy theorem’ and ‘Toolkit 3: applying the work–energy theorem’")

m, v0, f = 1500.0, 20.0, 6000.0
dist = 0.5 * m * v0 ** 2 / f
L.N(f"A {fmt(m, 4)} kg car travelling at {fmt(v0, 3)} m/s brakes with a constant friction force of {fmt(f, 4)} N until it stops. How far does it travel while stopping?",
    dist, "m", [m * v0 ** 2 / f, dist / 2, 2 * m * v0 ** 2 / f],
    f"The work done by friction removes all of the kinetic energy: −fd = 0 − ½mv₀². So d = mv₀²/(2f) = ({fmt(m, 4)})({fmt(v0, 3)})²/(2({fmt(f, 4)})) = {{a}}. Leaving out the ½ doubles the answer, to {fmt(m * v0 ** 2 / f)} m.",
    D + "‘Back to the opening question: braking distance’ and ‘Toolkit 4: choosing the method’")

m, h = 2.50, 1.80
v = math.sqrt(2 * g * h)
L.N(f"A {fmt(m, 3)} kg hammer head falls from rest through {fmt(h, 3)} m before striking a pile. Neglect air resistance. What is its speed on impact?",
    v, "m/s", [v ** 2, math.sqrt(g * h), g * h],
    f"Only gravity does work, W = mgh, and it equals the gain in kinetic energy: mgh = ½mv². The mass cancels, so v = √(2gh) = √(2(9.80)({fmt(h, 3)})) = {{a}}. A heavier hammer would have the same speed but more kinetic energy. The value {fmt(v ** 2)} is v² and {fmt(math.sqrt(g * h))} m/s leaves out the factor 2.",
    D + "‘Work done by the weight’ and ‘Lecturer example: a pile driver’")

F0, x1, x2 = 12.0, 2.0, 5.0
W = F0 * x1 + 0.5 * F0 * (x2 - x1)
L.N(f"The graph of the force F<sub>x</sub> on an object against position x shows a constant {fmt(F0, 3)} N from x = 0 to x = {fmt(x1, 2)} m. The force then falls in a straight line to zero at x = {fmt(x2, 2)} m. What is the work done by the force from x = 0 to x = {fmt(x2, 2)} m?",
    W, "J", [F0 * x2, F0 * x1, 0.5 * F0 * x2],
    f"Work is the area under the F<sub>x</sub>–x graph. The rectangle is ({fmt(F0, 3)})({fmt(x1, 2)}) = {fmt(F0 * x1)} J and the triangle is ½({fmt(F0, 3)})({fmt(x2 - x1, 2)}) = {fmt(0.5 * F0 * (x2 - x1))} J, so the total is {{a}}. Using the full width at the full height gives {fmt(F0 * x2)} J, which ignores that the force falls.",
    D + "‘Work as the area under a force graph’ and ‘Example: work from an F<sub>x</sub>–x graph’", typ="graph")

k, x = 400.0, 0.15
L.N(f"A spring of force constant {fmt(k, 3)} N/m is stretched from its natural length by {fmt(x, 2)} m. How much work is done on the spring?",
    0.5 * k * x ** 2, "J", [k * x, k * x ** 2, 0.5 * k * x],
    f"The spring force grows from 0 to kx, so the work done on the spring is the area of a triangle, W = ½kx² = ½({fmt(k, 3)})({fmt(x, 2)})² = {{a}}. The value {fmt(k * x)} is the final force in newtons, not a work. Omitting the ½ gives {fmt(k * x ** 2)} J.",
    D + "‘Work done on a spring’ and ‘Toolkit 6: springs’")

k, xa, xb = 200.0, 0.10, 0.30
L.N(f"A spring with force constant {fmt(k, 3)} N/m is stretched from {fmt(xa, 2)} m to {fmt(xb, 2)} m beyond its natural length. How much work is done on the spring during this stretch?",
    0.5 * k * (xb ** 2 - xa ** 2), "J", [0.5 * k * xb ** 2, 0.5 * k * (xb - xa) ** 2, k * (xb - xa)],
    f"Work is the change in ½kx²: W = ½k(x₂² − x₁²) = ½({fmt(k, 3)})({fmt(xb, 2)}² − {fmt(xa, 2)}²) = {{a}}. It is not ½k(Δx)², which gives {fmt(0.5 * k * (xb - xa) ** 2)} J. The value {fmt(0.5 * k * xb ** 2)} J is the work to stretch from the natural length to {fmt(xb, 2)} m.",
    D + "‘Work done on a spring’ and ‘Toolkit 6: springs’")

m, k, x = 0.200, 50.0, 0.12
v = x * math.sqrt(k / m)
L.N(f"A {fmt(m, 3)} kg glider on a frictionless air track is attached to a spring of force constant {fmt(k, 3)} N/m. It is pulled {fmt(x, 2)} m from the equilibrium position and released from rest. What is its speed when it passes the equilibrium position?",
    v, "m/s", [x ** 2 * k / m, math.sqrt(2 * k * x ** 2 / m), math.sqrt(k * x ** 2 / (2 * m))],
    f"The spring does work ½kx² on the glider as it returns to equilibrium. Setting this equal to ½mv² gives v = x√(k/m) = ({fmt(x, 2)})√({fmt(k, 3)}/{fmt(m, 3)}) = {{a}}. The value {fmt(x ** 2 * k / m)} is v², and the other wrong values come from a misplaced factor of 2.",
    D + "‘Lecturer example: a glider on a spring’ and ‘A glider on a spring: solution’")

m, h, t = 60.0, 4.50, 8.0
P = m * g * h / t
L.N(f"A student of mass {fmt(m, 3)} kg climbs a flight of stairs of total height {fmt(h, 3)} m in {fmt(t, 2)} s at a steady pace. What is the average power the student develops against gravity?",
    P, "W", [m * g * h, m * h / t, 2 * P],
    f"The work done against gravity is mgh = ({fmt(m, 3)})(9.80)({fmt(h, 3)}) = {fmt(m * g * h)} J. Average power is work divided by time: P = W/t = {{a}}. The value {fmt(m * g * h)} is the work, in joules, not a power. Leaving out g gives {fmt(m * h / t)}.",
    D + "‘Power’ and ‘Lecturer example: two stair climbers’")

Fd, v = 600.0, 25.0
L.N(f"A car moves at a constant {fmt(v, 3)} m/s on a level road against a total resistive force of {fmt(Fd, 3)} N. What power must the engine deliver to the wheels? Give the answer in kilowatts.",
    Fd * v / 1000, "kW", [Fd * v / 2000, Fd * v ** 2 / 1000, 2 * Fd * v / 1000],
    f"At constant velocity the forward force equals the resistive force, so P = Fv = ({fmt(Fd, 3)} N)({fmt(v, 3)} m/s) = {fmt(Fd * v)} W = {{a}}. A power of {fmt(Fd * v / 2000)} kW would use the average of the speeds over a start from rest, which does not apply here.",
    D + "‘Toolkit 7: power’ and ‘Lecturer example: a car at constant speed’")

L.C("A 2.0 kg object and a 4.0 kg object start from rest on a smooth floor. The same net force acts on each over the same distance. Which has the greater kinetic energy at the end?",
    "They have the same kinetic energy.",
    ["The 4.0 kg object, because it has more mass.", "The 2.0 kg object, because it reaches a higher speed.", "It cannot be found without the force and the distance."],
    "By the work–energy theorem, ΔK = W<sub>net</sub> = Fd. The force and the distance are the same, so the kinetic energies are the same. The lighter object ends up faster, but its smaller mass exactly compensates in ½mv².",
    D + "‘The physical meaning of kinetic energy’ and ‘Comparing kinetic energies’", "misconception")

L.C("A graph of the kinetic energy of an object against the square of its speed is a straight line through the origin. What does the slope of the line represent?",
    "Half the mass of the object",
    ["The mass of the object", "Twice the mass of the object", "The weight of the object"],
    "K = ½mv², so a plot of K against v² has the form y = (½m)x. The slope is ½m. Reading a slope with its physical meaning is part of graph interpretation.",
    D + "‘Rule: the work–energy theorem’ and ‘The physical meaning of kinetic energy’", "graph")

L.C("A ball is thrown straight up. How does the sign of the work done on the ball by gravity change during the flight, as it rises and as it falls?",
    "Negative while the ball rises and positive while it falls",
    ["Positive while the ball rises and negative while it falls", "Always negative, because gravity always acts downward", "Always positive, because the ball always has weight"],
    "Work depends on the angle between the force and the displacement. While the ball rises, gravity points down and the displacement points up, so the work is negative and the ball slows. While it falls, they point the same way, so the work is positive and the ball speeds up.",
    D + "‘The sign of work’ and ‘Work done by the weight’")

m, v0, k = 3.0, 5.0, 1200.0
xm = v0 * math.sqrt(m / k)
L.N(f"A {fmt(m, 2)} kg block slides at {fmt(v0, 2)} m/s on a frictionless floor into a spring of force constant {fmt(k, 4)} N/m. What is the maximum compression of the spring?",
    xm, "m", [math.sqrt(2) * xm, xm / 2, xm ** 2],
    f"At maximum compression the block is momentarily at rest, so the spring has done work −½kx² and removed all the kinetic energy: ½kx² = ½mv₀². Then x = v₀√(m/k) = ({fmt(v0, 2)})√({fmt(m, 2)}/{fmt(k, 4)}) = {{a}}. The value {fmt(xm ** 2)} is x² and the others come from misplaced factors.",
    D + "‘Integrated problem: a block and a spring on a rough floor’")
