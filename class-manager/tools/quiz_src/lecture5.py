import math
from common import Lecture, fmt, val

L = Lecture(5, "Potential energy and energy conservation")
D = "Lecture 5 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))

m, h1, h2 = 2.0, 1.0, 2.5
dU = m * g * (h2 - h1)
L.N(f"A {fmt(m, 2)} kg book is raised from a shelf {fmt(h1, 2)} m above the floor to a shelf {fmt(h2, 2)} m above the floor. What is the change in its gravitational potential energy?",
    dU, "J", [m * g * h2, m * g * h1, dU / 2],
    f"ΔU = mg(y₂ − y₁) = ({fmt(m, 2)})(9.80)({fmt(h2 - h1, 2)}) = {{a}}. Only the change in height matters. The value {fmt(m * g * h2)} J would be U at the upper shelf if the floor were chosen as the zero of U, and {fmt(m * g * h1)} J is U at the lower shelf. Neither is a change.",
    D + "‘Defining gravitational potential energy’ and ‘Toolkit 1’")

L.C("Two students analyse the same falling ball. One chooses the floor as the level where U = 0 and the other chooses a table top. Which quantity is the same for both students?",
    "The change in gravitational potential energy between two positions of the ball",
    ["The value of U at any particular position", "The value of the total mechanical energy", "The value of U at the floor"],
    "The zero of potential energy is a choice. Different choices shift every value of U by the same constant, so the values of U and of E = K + U differ, but differences ΔU do not. Only differences have physical meaning, and so the speed of the ball, found from ΔK = −ΔU, is the same for both students.",
    D + "‘The zero of U is a choice’", "misconception")

v0 = 15.0
H = v0 ** 2 / (2 * g)
L.N(f"A ball is thrown straight up at {fmt(v0, 3)} m/s. Neglect air resistance. Using energy conservation, what maximum height above the launch point does it reach?",
    H, "m", [v0 ** 2 / g, v0 / g, H / 2],
    f"At the highest point the speed is zero. Conservation of mechanical energy gives ½mv₀² = mgH, so H = v₀²/(2g) = ({fmt(v0, 3)})²/(2(9.80)) = {{a}}. The mass cancels. The value {fmt(v0 ** 2 / g)} m leaves out the factor 2, and {fmt(v0 / g)} is a time in seconds, not a height.",
    D + "‘Conservation of mechanical energy’ and ‘Lecturer example: the cliff ball’")

hh = 6.5
v = math.sqrt(2 * g * hh)
L.N(f"A smooth ramp has a height of {fmt(hh, 2)} m. A block is released from rest at the top and slides down without friction. What is its speed at the bottom?",
    v, "m/s", [v ** 2, math.sqrt(g * hh), 2 * v],
    f"The normal force does no work and there is no friction, so mechanical energy is conserved: mgh = ½mv². Thus v = √(2gh) = {{a}}. The speed depends only on the height, not on the angle of the ramp or on the mass. The value {fmt(math.sqrt(g * hh))} m/s leaves out the factor 2.",
    D + "‘Concept check: ramps and reference levels’ and ‘Toolkit 2: conservation of mechanical energy’")

L.C("Three identical balls are launched from the same height with the same speed: one straight up, one horizontally and one straight down. Neglect air resistance. How do their speeds compare just before they reach the ground?",
    "All three speeds are equal.",
    ["The ball thrown up is the slowest, because it goes up first.", "The ball thrown down is the fastest, and the ball thrown up is the slowest.", "The ball thrown horizontally is the fastest."],
    "The gravitational work depends only on the change in height, which is the same for all three. By the work–energy theorem, or conservation of mechanical energy, each ball has the same final kinetic energy and hence the same speed. The directions and times of flight differ, but the speeds do not.",
    D + "‘The three launches’ and ‘The work of gravity depends only on the height’", "misconception")

Lp, th = 1.50, 40.0
hp = Lp * (1 - cos(th))
v = math.sqrt(2 * g * hp)
L.N(f"A pendulum bob hangs from a string of length {fmt(Lp, 3)} m. It is released from rest when the string makes {fmt(th, 2)}° with the vertical. Neglect air resistance. What is the speed of the bob at the lowest point?",
    v, "m/s", [math.sqrt(2 * g * Lp), math.sqrt(2 * g * Lp * (1 - sin(th))), math.sqrt(g * hp)],
    f"The bob drops through a height h = L(1 − cos θ) = {fmt(Lp, 3)}(1 − cos {fmt(th, 2)}°) = {fmt(hp)} m. The tension does no work, so mgh = ½mv² and v = √(2gh) = {{a}}. Taking h = L, as if the bob fell the full length of the string, gives {fmt(math.sqrt(2 * g * Lp))} m/s. Using sin instead of cos gives a wrong height.",
    D + "‘Curved paths: energy for the speed, Newton for the force’ and ‘The pendulum: solution’")

k, x, m = 250.0, 0.20, 0.50
v = x * math.sqrt(k / m)
L.N(f"A {fmt(m, 3)} kg block is pressed against a spring of force constant {fmt(k, 3)} N/m, compressing it by {fmt(x, 2)} m, and released on a frictionless horizontal surface. What is the speed of the block as it leaves the spring?",
    v, "m/s", [k * x ** 2 / m, math.sqrt(k * x ** 2 / (2 * m)), math.sqrt(0.5 * k * x ** 2)],
    f"The stored elastic energy ½kx² = {fmt(0.5 * k * x ** 2)} J becomes kinetic energy: ½kx² = ½mv². So v = x√(k/m) = {{a}}. The value {fmt(k * x ** 2 / m)} is v² and the others come from a misplaced factor of ½.",
    D + "‘Elastic potential energy’ and ‘Toolkit 3: elastic potential energy and springs’")

m, h, k = 1.2, 0.60, 900.0
a_, b_, c_ = 0.5 * k, -m * g, -m * g * h
x = (-b_ + math.sqrt(b_ ** 2 - 4 * a_ * c_)) / (2 * a_)
L.N(f"A {fmt(m, 2)} kg block is dropped from rest from {fmt(h, 2)} m above a vertical spring of force constant {fmt(k, 3)} N/m. What is the maximum compression of the spring? Include the gravitational energy lost while the spring is compressing.",
    x, "m", [math.sqrt(2 * m * g * h / k), m * g / k, 2 * m * g / k],
    f"Take the system from release to maximum compression, where the block is momentarily at rest. The block falls a total height h + x, so mg(h + x) = ½kx². This is the quadratic {fmt(0.5 * k, 3)}x² − {fmt(m * g)}x − {fmt(m * g * h)} = 0, whose positive root is x = {{a}}. The value {fmt(math.sqrt(2 * m * g * h / k))} m leaves out the extra fall during the compression. The value {fmt(m * g / k)} m is where the block would sit at rest on the spring.",
    D + "‘Lecturer example: dropping a block on a spring’ and ‘Dropping a block on a spring: solution’")

m, hh, v = 4.0, 3.0, 5.0
Eloss = m * g * hh - 0.5 * m * v ** 2
L.N(f"A {fmt(m, 2)} kg block slides from rest down a rough incline that is {fmt(hh, 2)} m high and reaches the bottom at {fmt(v, 2)} m/s. How much mechanical energy is converted to thermal energy by friction?",
    Eloss, "J", [m * g * hh, 0.5 * m * v ** 2, m * g * hh + 0.5 * m * v ** 2],
    f"Use K₁ + U₁ + W<sub>other</sub> = K₂ + U₂. With K₁ = 0, U₁ = mgh = {fmt(m * g * hh)} J, K₂ = ½mv² = {fmt(0.5 * m * v ** 2)} J and U₂ = 0, the energy lost is {fmt(m * g * hh)} − {fmt(0.5 * m * v ** 2)} = {{a}}. It appears as thermal energy of the block and the incline. The energy is not destroyed.",
    D + "‘Friction and the lost energy’ and ‘The incline: solution’")

v0, d = 6.0, 12.0
mu = v0 ** 2 / (2 * g * d)
L.N(f"A block moving at {fmt(v0, 2)} m/s slides {fmt(d, 2)} m along a rough horizontal floor before stopping. What is the coefficient of kinetic friction?",
    mu, "", [v0 ** 2 / (g * d), v0 ** 2 / (4 * g * d), v0 ** 2 / (g * d) * 2],
    f"The work done by friction equals the loss of kinetic energy: μ<sub>k</sub>mgd = ½mv₀². The mass cancels and μ<sub>k</sub> = v₀²/(2gd) = ({fmt(v0, 2)})²/(2(9.80)({fmt(d, 2)})) = {{a}}. A coefficient has no units. Leaving out the factor 2 doubles the answer, to {fmt(v0 ** 2 / (g * d))}.",
    D + "‘Toolkit 4: the energy equation with other forces’")

L.C("Which of the following forces is nonconservative?",
    "Kinetic friction between a sliding box and the floor",
    ["The weight of an object near the Earth’s surface", "The force exerted by an ideal spring", "The gravitational force of the Earth on a satellite"],
    "A force is conservative if the work it does between two points does not depend on the path and its work is recoverable. Gravity and the ideal spring force are conservative and have potential energies. Kinetic friction does more negative work on a longer path and converts energy irreversibly to thermal energy, so no potential energy can be defined for it.",
    D + "‘Conservative and nonconservative forces’ and ‘Toolkit 5: classifying forces’")

L.C("A 2 kg box is moved from the bottom to the top of a 3 m high hill, once along a short steep path and once along a long winding path. Compare the work done by gravity on the box along the two paths.",
    "The two works are equal, because gravity is conservative and the heights are the same.",
    ["The work is greater along the long path, because the displacement along the path is greater.", "The work is greater along the steep path, because the force is applied over a smaller distance.", "The work is zero along both paths, because the box ends at rest."],
    "For a conservative force, the work between two points is path independent and equals −ΔU. Here the work done by gravity is −mgh along both paths, about −59 J. By contrast, the work done by friction would be larger along the long path.",
    D + "‘Lecturer example: two ramps’ and ‘Two ramps: solution’", "misconception")

c1, c2, xx = 5.0, 2.0, 3.0
Fx = -(2 * c1 * xx - 3 * c2 * xx ** 2)
L.N(f"A particle has potential energy U(x) = {fmt(c1, 2)}x² − {fmt(c2, 2)}x³, with U in joules and x in metres. What is the x-component of the force on the particle at x = {fmt(xx, 2)} m?",
    Fx, "N", [-Fx, c1 * xx ** 2 - c2 * xx ** 3, 2 * c1 * xx + 3 * c2 * xx ** 2],
    f"The force is F<sub>x</sub> = −dU/dx = −(2({fmt(c1, 2)})x − 3({fmt(c2, 2)})x²) = −{fmt(2 * c1, 2)}x + {fmt(3 * c2, 2)}x². At x = {fmt(xx, 2)} m this is {{a}}. The positive sign means the force points in the +x direction. The value {fmt(c1 * xx ** 2 - c2 * xx ** 3)} is U itself, which is in joules. A force requires the derivative, with the minus sign.",
    D + "‘Force from potential energy’ and ‘Lecturer example: a force from a formula’")

L.C("An energy diagram shows U(x) with a single valley. A particle has total energy E, with E equal to U at x = a and at x = b, and E greater than U for all x between a and b. How does the particle move?",
    "It oscillates between x = a and x = b, and its speed is zero at both points.",
    ["It moves from x = a to x = b and then leaves the region.", "It stays at rest at the bottom of the valley.", "It moves at constant speed between x = a and x = b."],
    "The kinetic energy is K = E − U, which is positive between a and b and zero where E = U. Those two points are turning points, where the velocity reverses. The particle cannot enter regions where U > E. The speed is greatest where U is lowest, at the bottom of the valley.",
    D + "‘Reading an energy diagram’ and ‘Toolkit 7: reading energy diagrams’", "graph")

L.C("On a graph of U(x), the slope is zero at x₀ and U curves upward on both sides of x₀, like the bottom of a bowl. What type of equilibrium is this?",
    "Stable equilibrium, because a small displacement produces a force back towards x₀",
    ["Unstable equilibrium, because the slope is zero", "Stable equilibrium, because the force at x₀ is large", "It is not an equilibrium, because the potential energy is not zero"],
    "Equilibrium requires F = −dU/dx = 0, which is a zero slope. At a minimum of U, moving away raises U, so the force −dU/dx points back towards x₀. At a maximum of U, a small displacement produces a force away from x₀, which is unstable.",
    D + "‘Toolkit 7: reading energy diagrams’", "graph")

m, E, U = 0.50, 12.0, 8.0
v = math.sqrt(2 * (E - U) / m)
L.N(f"A {fmt(m, 3)} kg particle has total mechanical energy {fmt(E, 3)} J. At x = 3.0 m the potential energy is {fmt(U, 3)} J. What is its speed at that point?",
    v, "m/s", [math.sqrt(2 * E / m), math.sqrt(2 * U / m), math.sqrt((E - U) / m)],
    f"The kinetic energy is K = E − U = {fmt(E - U)} J. Then v = √(2K/m) = √(2({fmt(E - U)})/{fmt(m, 3)}) = {{a}}. Using E or U alone, instead of their difference, gives the wrong values {fmt(math.sqrt(2 * E / m))} m/s and {fmt(math.sqrt(2 * U / m))} m/s.",
    D + "‘Toolkit 7: reading energy diagrams’")

L.C("A sliding block comes to rest on a rough floor. Which statement about its energy is correct?",
    "Its kinetic energy has been converted to thermal energy of the block and the floor, and the total energy is conserved.",
    ["Its kinetic energy has been destroyed, because the block no longer moves.", "Its kinetic energy has been converted to potential energy of the block.", "Energy conservation does not apply to systems with friction."],
    "The law of conservation of energy holds for any isolated system. Friction changes mechanical energy into thermal energy (and a little sound). Mechanical energy K + U is not conserved here, but the total energy, including thermal energy, is.",
    D + "‘The law of conservation of energy’ and ‘Friction and the lost energy’", "misconception")

hs, ht = 30.0, 12.0
v = math.sqrt(2 * g * (hs - ht))
L.N(f"A roller-coaster car is released from rest at a point {fmt(hs, 3)} m above the ground, and rolls without friction to the top of a loop {fmt(ht, 3)} m above the ground. What is its speed at the top of the loop?",
    v, "m/s", [math.sqrt(2 * g * hs), math.sqrt(2 * g * ht), v ** 2],
    f"Only the difference in height matters: mg(h<sub>s</sub> − h<sub>t</sub>) = ½mv². So v = √(2g({fmt(hs, 3)} − {fmt(ht, 3)})) = {{a}}. The value {fmt(math.sqrt(2 * g * hs))} m/s would be the speed if the car had fallen all the way to the ground, and {fmt(v ** 2)} is v² without the square root.",
    D + "‘Toolkit 2: conservation of mechanical energy’")

L.C("A frictionless pendulum bob is released from rest at its highest point. A bar chart shows K, U and the total E = K + U. Which bar chart describes the bob at the lowest point of the swing?",
    "The K bar is at its tallest, the U bar is at its smallest, and the E bar has the same height as at release.",
    ["The K bar is at its smallest, the U bar is at its tallest, and the E bar is smaller than at release.", "The K bar and the U bar are equal, and the E bar is zero.", "The K bar is at its tallest and the E bar is taller than at release."],
    "At the lowest point the height, and so U, is a minimum, and the speed and K are a maximum. With no friction the total mechanical energy does not change, so the total bar is unchanged. K gains exactly what U loses.",
    D + "‘A bar-chart representation’", "graph")

k, x, mu, m = 800.0, 0.10, 0.25, 1.0
d = 0.5 * k * x ** 2 / (mu * m * g)
L.N(f"A {fmt(m, 2)} kg block is pressed against a spring of force constant {fmt(k, 3)} N/m, compressing it by {fmt(x, 2)} m. It is released and leaves the spring at its natural length onto a rough horizontal surface with μ<sub>k</sub> = {fmt(mu)}. Assume the floor under the spring is smooth. How far does the block slide on the rough surface before stopping?",
    d, "m", [2 * d, 0.5 * k * x ** 2 / mu, d / 2],
    f"Energy ½kx² = {fmt(0.5 * k * x ** 2)} J is stored in the spring. The block leaves with this as kinetic energy, and friction then removes it: μ<sub>k</sub>mgd = ½kx². So d = kx²/(2μ<sub>k</sub>mg) = {{a}}. Leaving out the factor ½ gives {fmt(2 * d)} m, and leaving out g gives {fmt(0.5 * k * x ** 2 / mu)}.",
    D + "‘Your turn: a spring fires a block up a rough incline’ and ‘Toolkit 4’")
