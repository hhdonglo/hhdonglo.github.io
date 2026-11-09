import math
from common import Lecture, fmt, val

L = Lecture(7, "Impulse and momentum")
D = "Lecture 7 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))
U = "kg·m/s"

m, v = 0.057, 45.0
L.N(f"A tennis ball of mass {fmt(m, 2)} kg moves at {fmt(v, 3)} m/s. What is the magnitude of its momentum?",
    m * v, U, [0.5 * m * v, 0.5 * m * v ** 2, v / m],
    f"Momentum is p = mv = ({fmt(m, 2)} kg)({fmt(v, 3)} m/s) = {{a}}. The value {fmt(0.5 * m * v ** 2)} is the kinetic energy in joules, which has a different unit. Momentum has no factor ½ and no square, and the ratio v/m has no meaning here.",
    D + "‘Momentum’ and ‘Toolkit 1: momentum and impulse’")

L.C("Which statement about momentum is correct?",
    "Momentum is a vector, and it points in the direction of the velocity.",
    ["Momentum is a scalar, because it is mass times speed.", "Momentum is a vector, and it points in the direction of the net force.", "Momentum is a scalar that is always positive."],
    "Momentum p = mv is the product of a scalar and the velocity vector, so it is a vector in the direction of the velocity. Kinetic energy is the corresponding scalar. When momentum is conserved, every component is conserved separately.",
    D + "‘Momentum’")

m, v1, v2 = 0.40, 12.0, 9.0
J = m * (v2 + v1)
L.N(f"A {fmt(m, 2)} kg ball hits a wall at {fmt(v1, 3)} m/s, perpendicular to the wall, and rebounds along the same line at {fmt(v2, 3)} m/s. What is the magnitude of the impulse the wall exerts on the ball?",
    J, U, [m * (v1 - v2), 0.5 * J, m * v2],
    f"Take the direction away from the wall as positive. The velocity changes from −{fmt(v1, 3)} m/s to +{fmt(v2, 3)} m/s, so J = Δp = m(v₂ − v₁) = ({fmt(m, 2)})({fmt(v2, 3)} + {fmt(v1, 3)}) = {{a}}. The velocity reverses, so the two speeds add. Subtracting the speeds, which gives {fmt(m * (v1 - v2))}, treats the ball as if it did not reverse.",
    D + "‘Lecturer example: a ball hits a wall’ and ‘A ball hits a wall: solution’")

Jv, dt = 8.40, 6.0e-3
L.N(f"During a collision a ball receives an impulse of magnitude {fmt(Jv, 3)} kg·m/s in a contact time of {fmt(dt * 1000, 2)} ms. What is the average force on the ball?",
    Jv / dt, "N", [Jv * dt, Jv, Jv / (dt * 1000)],
    f"By the impulse–momentum theorem, J = F<sub>av</sub>Δt, so F<sub>av</sub> = J/Δt = ({fmt(Jv, 3)})/({fmt(dt, 2)} s) = {{a}}. Remember to convert milliseconds to seconds. Multiplying gives {fmt(Jv * dt)}, and using {fmt(dt * 1000, 2)} as if it were in seconds gives {fmt(Jv / (dt * 1000))} N.",
    D + "‘Impulse and the impulse–momentum theorem’")

L.C("Why do airbags and crumple zones reduce the injury to a driver in a collision?",
    "They increase the time over which the momentum changes, so the average force is smaller.",
    ["They reduce the change in momentum of the driver, so less impulse is needed.", "They reduce the mass of the driver, so the force is smaller.", "They increase the average force, which stops the driver sooner."],
    "The driver’s momentum must change from its initial value to zero in either case, so the impulse is the same. From J = F<sub>av</sub>Δt, a longer stopping time Δt gives a smaller average force on the driver.",
    D + "‘Concept check: why do airbags and crumple zones work?’")

Fmax, T = 800.0, 0.020
J = 0.5 * Fmax * T
L.N(f"On a force–time graph, a collision force rises in a straight line from zero to {fmt(Fmax, 3)} N and then falls in a straight line back to zero. The force acts for a total time of {fmt(T * 1000, 2)} ms. What is the impulse?",
    J, "N·s", [Fmax * T, 0.25 * Fmax * T, Fmax],
    f"The impulse is the area under the F–t graph. The graph is a triangle of height {fmt(Fmax, 3)} N and base {fmt(T, 2)} s, so J = ½(base)(height) = ½({fmt(T, 2)})({fmt(Fmax, 3)}) = {{a}}. Using base times height gives the area of the rectangle, {fmt(Fmax * T)} N·s, which overestimates it.",
    D + "‘Impulse from a force–time graph’", typ="graph")

ms, mb, vb = 60.0, 2.0, 8.0
vr = mb * vb / ms
L.N(f"A skater of mass {fmt(ms, 3)} kg stands at rest on ice and throws a {fmt(mb, 2)} kg ball forward at {fmt(vb, 2)} m/s. What is the recoil speed of the skater? Neglect friction.",
    vr, "m/s", [mb * vb / (ms + mb), vb, mb / ms],
    f"There is no external horizontal force, so the total momentum stays zero: 0 = m<sub>b</sub>v<sub>b</sub> − m<sub>s</sub>v<sub>s</sub>. So v<sub>s</sub> = m<sub>b</sub>v<sub>b</sub>/m<sub>s</sub> = ({fmt(mb, 2)})({fmt(vb, 2)})/{fmt(ms, 3)} = {{a}}, in the direction opposite to the ball. The value {fmt(mb * vb / (ms + mb))} uses the combined mass, which is wrong because the ball is thrown and the skater does not carry it afterwards.",
    D + "‘Lecturer example: recoil’ and ‘Toolkit 3: conserving momentum’")

m1, v1, m2, v2 = 0.50, 3.0, 0.75, -1.0
vf = (m1 * v1 + m2 * v2) / (m1 + m2)
L.N(f"A {fmt(m1, 2)} kg glider moving at {fmt(v1, 2)} m/s collides head-on with a {fmt(m2, 2)} kg glider moving at {fmt(abs(v2), 2)} m/s in the opposite direction. They stick together. What is their common velocity, taking the direction of the first glider as positive?",
    vf, "m/s", [(v1 + v2) / 2, (m1 * v1 + m2 * abs(v2)) / (m1 + m2), vf * 1.25],
    f"Momentum is conserved: m₁v₁ + m₂v₂ = (m₁ + m₂)v. With signs, ({fmt(m1, 2)})({fmt(v1, 2)}) + ({fmt(m2, 2)})({fmt(v2, 2)}) = ({fmt(m1 + m2, 3)})v, so v = {{a}}. The positive sign means the pair moves in the original direction of the first glider. Averaging the velocities, or dropping the negative sign of v₂, gives wrong values.",
    D + "‘Lecturer example: gliders that stick together’ and ‘Toolkit 4: collisions in one dimension’")

Ki = 0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2
Kf = 0.5 * (m1 + m2) * vf ** 2
L.N(f"For the two gliders in the previous problem ({fmt(m1, 2)} kg at {fmt(v1, 2)} m/s and {fmt(m2, 2)} kg at {fmt(abs(v2), 2)} m/s in the opposite direction, sticking together), how much kinetic energy is lost in the collision?",
    Ki - Kf, "J", [Ki, Kf, 0],
    f"Before: ½({fmt(m1, 2)})({fmt(v1, 2)})² + ½({fmt(m2, 2)})({fmt(abs(v2), 2)})² = {fmt(Ki)} J. After: ½({fmt(m1 + m2, 3)})({fmt(vf, 3)})² = {fmt(Kf)} J. The loss is {{a}}. Momentum is conserved in the collision, but kinetic energy is not, because the gliders deform and stick together. A loss of 0 J would mean an elastic collision.",
    D + "‘Collisions: elastic and inelastic’ and ‘Gliders that stick together: solution’")

L.C("Two gliders on a frictionless track collide and stick together. Which quantity is conserved in the collision?",
    "The total momentum, but not the total kinetic energy",
    ["The total kinetic energy, but not the total momentum", "Both the total momentum and the total kinetic energy", "Neither, because the collision is inelastic"],
    "Momentum is conserved in any collision of an isolated system, because the internal forces are equal and opposite. Kinetic energy is conserved only in elastic collisions. A collision in which the objects stick together loses the largest possible fraction of kinetic energy but conserves momentum.",
    D + "‘Collisions: elastic and inelastic’", "misconception")

m1, m2, v1 = 3.0, 1.0, 8.0
v2f = 2 * m1 * v1 / (m1 + m2)
L.N(f"A {fmt(m1, 2)} kg cart moving at {fmt(v1, 2)} m/s makes an elastic head-on collision with a {fmt(m2, 2)} kg cart at rest. What is the velocity of the {fmt(m2, 2)} kg cart after the collision?",
    v2f, "m/s", [v1, (m1 - m2) / (m1 + m2) * v1, 2 * v2f],
    f"For an elastic collision with the target at rest, v₂′ = 2m₁v₁/(m₁ + m₂) = 2({fmt(m1, 2)})({fmt(v1, 2)})/({fmt(m1 + m2, 2)}) = {{a}}. The lighter cart ends up faster than the heavier one that struck it. The value {fmt((m1 - m2) / (m1 + m2) * v1)} m/s is the velocity of the first cart after the collision, v₁′. As a check, momentum: ({fmt(m1, 2)})({fmt(v1, 2)}) = ({fmt(m1, 2)})({fmt((m1 - m2) / (m1 + m2) * v1)}) + ({fmt(m2, 2)})({fmt(v2f)}).",
    D + "‘Elastic collisions in one dimension’ and ‘Special cases of an elastic collision’")

L.C("A small ball collides elastically and head-on with a much more massive object that is at rest. What happens to the small ball?",
    "It rebounds with almost the same speed, in the opposite direction.",
    ["It stops, and the massive object moves off with the ball’s speed.", "It continues forward at about half its original speed.", "It sticks to the massive object."],
    "For an elastic collision with a stationary target, v₁′ = (m₁ − m₂)v₁/(m₁ + m₂). When m₂ is much larger than m₁ this tends to −v₁, so the ball bounces back with nearly its original speed, as a ball bounces off a wall. The massive object barely moves, so it takes away almost no kinetic energy.",
    D + "‘Special cases of an elastic collision’")

mA, vA = 0.50, 6.0
vA2, th = 3.0, 60.0
vBx = vA - vA2 * cos(th)
vBy = -vA2 * sin(th)
vB = math.hypot(vBx, vBy)
L.N(f"A {fmt(mA, 2)} kg ball moving at {fmt(vA, 2)} m/s in the +x direction strikes an identical {fmt(mA, 2)} kg ball at rest. After the collision the first ball moves at {fmt(vA2, 2)} m/s at {fmt(th, 2)}° above the +x axis. What is the speed of the second ball?",
    vB, "m/s", [vBx, abs(vBy), vA2],
    f"The balls have equal mass, so conserve each momentum component per unit mass. x: {fmt(vA, 2)} = {fmt(vA2, 2)} cos {fmt(th, 2)}° + v<sub>Bx</sub>, so v<sub>Bx</sub> = {fmt(vBx)} m/s. y: 0 = {fmt(vA2, 2)} sin {fmt(th, 2)}° + v<sub>By</sub>, so v<sub>By</sub> = {fmt(vBy)} m/s, downward. The speed is √(v<sub>Bx</sub>² + v<sub>By</sub>²) = {{a}}. The x-component alone, {fmt(vBx)}, is not the speed.",
    D + "‘Toolkit 5: collisions in two dimensions’ and ‘A glancing collision: solution’")

h1, h2 = 1.50, 0.90
e = math.sqrt(h2 / h1)
L.N(f"A ball dropped from {fmt(h1, 3)} m onto a hard floor rebounds to a height of {fmt(h2, 2)} m. What is the coefficient of restitution for the collision?",
    e, "", [h2 / h1, h1 / h2, (h2 / h1) ** 2],
    f"The speed just before impact is √(2gh₁) and just after is √(2gh₂), so e = v<sub>sep</sub>/v<sub>app</sub> = √(h₂/h₁) = √({fmt(h2, 2)}/{fmt(h1, 3)}) = {{a}}. The ratio of heights, {fmt(h2 / h1)}, is not e, because heights are proportional to the squares of the speeds. A value above 1, such as {fmt(h1 / h2)}, is impossible for e.",
    D + "‘The coefficient of restitution’ and ‘Toolkit 6: restitution and relative velocity’")

m1, v1, m2, v2, e = 4.0, 5.0, 2.0, 1.0, 0.60
p = m1 * v1 + m2 * v2
v1f = (p - m2 * e * (v1 - v2)) / (m1 + m2)
v2f = v1f + e * (v1 - v2)
v1_el = (p - m2 * (v1 - v2)) / (m1 + m2)
v_ine = p / (m1 + m2)
L.N(f"A {fmt(m1, 2)} kg cart moving at {fmt(v1, 2)} m/s overtakes and hits a {fmt(m2, 2)} kg cart moving at {fmt(v2, 2)} m/s in the same direction. The coefficient of restitution is {fmt(e, 2)}. What is the velocity of the {fmt(m1, 2)} kg cart after the collision?",
    v1f, "m/s", [v1_el, v_ine, v2f],
    f"Use two equations. Momentum: {fmt(m1, 2)}v₁′ + {fmt(m2, 2)}v₂′ = {fmt(p, 3)} kg·m/s. Restitution: v₂′ − v₁′ = e(v₁ − v₂) = ({fmt(e, 2)})({fmt(v1 - v2, 2)}) = {fmt(e * (v1 - v2))} m/s. Solving gives v₁′ = {{a}} and v₂′ = {fmt(v2f)} m/s. The value {fmt(v1_el)} m/s is what e = 1 would give, and {fmt(v_ine)} m/s is the common velocity if they stuck together (e = 0).",
    D + "‘Toolkit 6: restitution and relative velocity’ and ‘Lecturer example: a bouncing ball and a glider’")

mb_, M, h = 0.020, 1.50, 0.12
u = math.sqrt(2 * g * h)
vbul = (mb_ + M) / mb_ * u
L.N(f"A {fmt(mb_, 2)} kg bullet is fired horizontally into a {fmt(M, 3)} kg block hanging from strings. The bullet embeds in the block and the block swings up to a maximum height of {fmt(h, 2)} m. What was the speed of the bullet? Use g = 9.80 m/s².",
    vbul, "m/s", [u, (mb_ + M) / mb_ * u ** 2, 0.5 * vbul],
    f"Stage 1, the collision: momentum is conserved, m<sub>b</sub>v = (m<sub>b</sub> + M)u. Stage 2, the swing: mechanical energy is conserved, ½(m<sub>b</sub> + M)u² = (m<sub>b</sub> + M)gh, so u = √(2gh) = {fmt(u)} m/s. Then v = (m<sub>b</sub> + M)u/m<sub>b</sub> = {{a}}. The speed {fmt(u)} m/s is only the speed of the block just after the impact.",
    D + "‘Collision, then energy: the ballistic pendulum’ and ‘Lecturer example: measuring a bullet’s speed’")

L.C("In a ballistic pendulum, a bullet embeds in a block that then swings upward. Which quantity is conserved during the collision of the bullet and the block, and which during the swing?",
    "Momentum during the collision, and mechanical energy during the swing",
    ["Mechanical energy during the collision, and momentum during the swing", "Momentum during both the collision and the swing", "Mechanical energy during both the collision and the swing"],
    "The collision is very short and the strings’ tension is vertical, so horizontal momentum is conserved. But kinetic energy is lost as the bullet embeds. During the swing, gravity is the only force that does work and the tension does none, so mechanical energy is conserved while the momentum changes. Splitting the problem into two stages is the key idea.",
    D + "‘Toolkit 7: two-stage problems’ and ‘Collision, then energy: the ballistic pendulum’")

m1, m2, dist = 60.0, 40.0, 5.0
xcm = m2 * dist / (m1 + m2)
L.N(f"Two skaters stand {fmt(dist, 2)} m apart on frictionless ice. Their masses are {fmt(m1, 3)} kg and {fmt(m2, 3)} kg. They pull themselves together along a rope. How far from the starting position of the {fmt(m1, 3)} kg skater do they meet?",
    xcm, "m", [m1 * dist / (m1 + m2), dist / 2, dist - dist / 2 * 0.4],
    f"There is no external horizontal force, so the centre of mass does not move, and the skaters meet there. Measured from the heavier skater, x<sub>cm</sub> = m₂d/(m₁ + m₂) = ({fmt(m2, 3)})({fmt(dist, 2)})/{fmt(m1 + m2, 4)} = {{a}}. The heavier skater moves less. The midpoint, {fmt(dist / 2)} m, would be correct only if the masses were equal.",
    D + "‘Centre of mass: an introduction’ and ‘Lecturer example: a tug-of-war on ice’")

L.C("A rifle initially at rest fires a bullet horizontally and recoils. Compared with the bullet, how do the rifle’s momentum and kinetic energy compare, in magnitude?",
    "The momenta are equal in magnitude, and the rifle has much less kinetic energy than the bullet.",
    ["The momenta are equal in magnitude, and the rifle has more kinetic energy than the bullet.", "The rifle has more momentum and the same kinetic energy.", "Both momentum and kinetic energy are equal in magnitude."],
    "The total momentum was zero, so the two momenta are equal and opposite. Kinetic energy is K = p²/(2m). For equal p, the object with the smaller mass, the bullet, has the larger kinetic energy. The extra energy comes from the chemical energy of the propellant.",
    D + "‘Lecturer example: recoil’ and ‘Toolkit 3: conserving momentum’", "misconception")

mb_, vbul, M, mu = 0.020, 300.0, 1.98, 0.30
u = mb_ * vbul / (mb_ + M)
d = u ** 2 / (2 * mu * g)
L.N(f"A {fmt(mb_, 2)} kg bullet moving at {fmt(vbul, 3)} m/s embeds in a {fmt(M, 3)} kg block resting on a rough floor with μ<sub>k</sub> = {fmt(mu, 2)}. How far does the block slide before it stops?",
    d, "m", [2 * d, d / 2, vbul ** 2 / (2 * mu * g)],
    f"Stage 1, the collision: momentum is conserved, so u = m<sub>b</sub>v/(m<sub>b</sub> + M) = {fmt(u)} m/s. Stage 2, the slide: friction removes the kinetic energy, μ<sub>k</sub>(m<sub>b</sub> + M)gd = ½(m<sub>b</sub> + M)u², so d = u²/(2μ<sub>k</sub>g) = {{a}}. Applying the energy equation with the bullet’s speed of {fmt(vbul, 3)} m/s, which skips the collision, gives {fmt(vbul ** 2 / (2 * mu * g))} m.",
    D + "‘Integrated problem: a bullet in a block on a rough floor’ and ‘Integrated problem: lecturer solution’")
