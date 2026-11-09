import math
from common import Lecture, fmt, val

L = Lecture(3, "Newton’s laws")
D = "Lecture 3 deck, slide "
g = 9.80
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))
tan = lambda d: math.tan(math.radians(d))
atan = lambda x: math.degrees(math.atan(x))

L.C("A hockey puck slides at constant velocity across horizontal ice, and friction is negligible. Which statement about the horizontal forces on the puck is correct?",
    "No horizontal force is needed. The net horizontal force is zero.",
    ["A constant forward force is needed to keep the puck moving.", "A forward force, left over from the push that started it, keeps the puck moving.", "A forward force that slowly decreases is acting on the puck."],
    "By Newton’s first law, an object moves at constant velocity when the net force on it is zero. A force is needed to change the velocity, not to maintain it. A push that has ended no longer acts on the puck.",
    D + "‘Newton’s first law’ and ‘Concept check: is the net force zero?’", "misconception")

L.C("An astronaut of mass 80 kg travels from Earth to the Moon, where the free-fall acceleration is about one sixth of that on Earth. What happens to the astronaut’s mass and weight?",
    "The mass stays at 80 kg and the weight becomes about one sixth of its value on Earth.",
    ["The mass becomes about one sixth of 80 kg and the weight does not change.", "Both the mass and the weight become about one sixth of their values on Earth.", "Neither the mass nor the weight changes."],
    "Mass measures the amount of matter and resistance to acceleration, so it does not depend on location. Weight is the gravitational force, w = mg, and it changes with the local value of g.",
    D + "‘Mass and weight’")

m, gm = 65.0, 1.62
L.N(f"An astronaut of mass {fmt(m)} kg stands on the Moon, where g = {fmt(gm)} m/s². What is the astronaut’s weight on the Moon?",
    m * gm, "N", [m * g, m / gm, m],
    f"Weight is w = mg = ({fmt(m)} kg)({fmt(gm)} m/s²) = {{a}}. The value {fmt(m * g)} N is the weight on Earth. Dividing the mass by g gives {fmt(m / gm)}, which has the wrong units for a force. The mass itself is {fmt(m)} kg, which is not a weight.",
    D + "‘Mass and weight’")

F1, F2, F3 = 30.0, 40.0, 20.0
Rn = math.hypot(F1 - F3, F2)
L.N(f"Three horizontal forces act on a crate: {fmt(F1)} N east, {fmt(F2)} N north and {fmt(F3)} N west. What is the magnitude of the net force?",
    Rn, "N", [F1 + F2 + F3, math.hypot(F1, F2), math.hypot(F1 + F3, F2)],
    f"Use components with east as +x and north as +y: ΣF<sub>x</sub> = {fmt(F1)} − {fmt(F3)} = {fmt(F1 - F3)} N and ΣF<sub>y</sub> = {fmt(F2)} N. The magnitude is √({fmt(F1 - F3)}² + {fmt(F2)}²) = {{a}}. Adding magnitudes, or ignoring the westward force, gives wrong values. The sketch shows the west force reduces the east component.",
    D + "‘Net force: superposition’ and ‘Net force: solution’")

L.C("A book rests on a horizontal table. Which set of forces belongs on the free-body diagram of the book?",
    "The weight of the book acting down and the normal force from the table acting up, equal in magnitude",
    ["The weight, the normal force and a ‘force of rest’ that keeps the book still", "The weight, the normal force and the force of the book on the table", "The weight of the book only, because the table is not moving"],
    "A free-body diagram shows only forces acting on the chosen object, one arrow for each. The book is acted on by gravity (down) and by the table (normal force, up). Because the acceleration is zero, the two forces balance. The force of the book on the table acts on the table, so it does not belong on this diagram.",
    D + "‘Toolkit 1: free-body diagrams’ and ‘Build it together: a book on a table’", "graph")

mc, Fn = 1200.0, 3000.0
L.N(f"A car of mass {fmt(mc, 4)} kg is acted on by a net forward force of {fmt(Fn, 4)} N. What is its acceleration?",
    Fn / mc, "m/s²", [mc / Fn, Fn / (mc * g), Fn * mc],
    f"Newton’s second law gives a = ΣF/m = ({fmt(Fn, 4)} N)/({fmt(mc, 4)} kg) = {{a}}, in the direction of the net force. Inverting the ratio gives {fmt(mc / Fn)}. Using the weight mg in place of the mass gives {fmt(Fn / (mc * g))}. Multiplying gives a quantity with the wrong units.",
    D + "‘Newton’s second law’ and ‘Toolkit 3: applying ΣF = ma’")

L.C("A car is moving east and slowing down. In which direction is the net force on the car?",
    "West, opposite to the velocity",
    ["East, in the direction of the motion", "There is no net force, because the car is still moving", "Downward, because of the weight of the car"],
    "The net force has the direction of the acceleration, not of the velocity. A car slowing down while moving east has an acceleration towards the west, so the net force points west. Motion does not have to be in the direction of the net force.",
    D + "‘Newton’s second law’", "misconception")

mlamp, th = 8.00, 25.0
T = mlamp * g / (2 * sin(th))
L.N(f"A lamp of mass {fmt(mlamp)} kg hangs at rest from two identical cables. Each cable makes an angle of {fmt(th, 2)}° above the horizontal. What is the tension in each cable?",
    T, "N", [mlamp * g / 2, mlamp * g / (2 * cos(th)), mlamp * g],
    f"The lamp is in equilibrium, so the vertical forces balance: 2T sin {fmt(th, 2)}° = mg = {fmt(mlamp * g)} N, giving T = {{a}}. The tension is larger than half the weight because each cable pulls at a shallow angle, so only part of it acts upward. Using cosine, or taking T = mg/2, would be correct only for other geometries.",
    D + "‘Equilibrium: the special case a = 0’ and ‘A hanging lamp: solution’")

L.C("The Earth pulls down on a book on a table with a force of 5 N. Which force is the third-law partner of this force?",
    "The book pulls up on the Earth with a force of 5 N.",
    ["The table pushes up on the book with a force of 5 N.", "The table pushes down on the floor with a force of 5 N.", "There is no partner force, because the book is not moving."],
    "Third-law pairs act on two different objects and are the same kind of force. The Earth pulls on the book, so the partner is the book pulling on the Earth. The upward push of the table also has magnitude 5 N here, but it acts on the same object as the weight and is a different kind of force. It balances the weight but is not its partner.",
    D + "‘Toolkit 4: third-law pairs’ and ‘Concept check: pairs for the book on the table’", "misconception")

L.C("A small car collides head-on with a heavy truck. How does the magnitude of the force of the car on the truck compare with the force of the truck on the car, during the collision?",
    "The two forces are equal in magnitude and opposite in direction.",
    ["The truck exerts the larger force, because it is heavier.", "The car exerts the larger force, because it is the one that is damaged more.", "The forces are equal only if the car and the truck have the same mass."],
    "Newton’s third law holds for every interaction: the forces have equal magnitude and opposite directions, whatever the masses. The car is affected more because the same force on a smaller mass gives a larger acceleration, a = F/m.",
    D + "‘Newton’s third law’ and ‘Concept check: a horse and a cart’", "misconception")

m1, m2 = 3.00, 5.00
aa = m2 * g / (m1 + m2)
L.N(f"A {fmt(m1)} kg block sits on a frictionless horizontal table. A light string over a frictionless pulley connects it to a hanging {fmt(m2)} kg mass. Once released, what is the acceleration of the blocks?",
    aa, "m/s²", [g, m2 * g / m1, m1 * g / (m1 + m2)],
    f"Treat the pair as one system moving along the string: the net force along the motion is the weight of the hanging mass, m₂g, and the mass being accelerated is m₁ + m₂. Then a = m₂g/(m₁ + m₂) = {{a}}. The acceleration is less than g because the hanging mass must also accelerate the block. Swapping the masses gives {fmt(m1 * g / (m1 + m2))}.",
    D + "‘Toolkit 5: connected objects’ and ‘Block, pulley and hanging mass: solution’")

L.N(f"For the same system, a {fmt(m1)} kg block on a frictionless table is joined by a light string over a frictionless pulley to a hanging {fmt(m2)} kg mass. What is the tension in the string?",
    m1 * aa, "N", [m2 * g, m1 * g, m2 * g / 2],
    f"Apply ΣF = ma to the block on the table: the only horizontal force is the tension, so T = m₁a = ({fmt(m1)} kg)({fmt(aa)} m/s²) = {{a}}. The tension is less than the weight of the hanging mass, {fmt(m2 * g)} N, because that mass is accelerating downward. Setting T equal to m₂g would be correct only if the system were at rest.",
    D + "‘Toolkit 5: connected objects’ and ‘Block, pulley and hanging mass: solution’")

mk, mu = 40.0, 0.30
Fpush = mu * mk * g
L.N(f"A {fmt(mk)} kg crate is pushed across a horizontal floor at constant velocity. The coefficient of kinetic friction is {fmt(mu)}. What horizontal force must be applied to the crate?",
    Fpush, "N", [mk * g, mu * mk, 0],
    f"Constant velocity means zero acceleration, so the applied force equals the kinetic friction force. With n = mg on a horizontal floor, f<sub>k</sub> = μ<sub>k</sub>n = ({fmt(mu)})({fmt(mk)})({fmt(g)}) = {{a}}. A force of 0 N would only keep the crate at rest or let it slow down. The value {fmt(mk * g)} N is the weight, which would be the friction force only if μ<sub>k</sub> were 1.",
    D + "‘Toolkit 6: friction and the normal force’ and ‘Lecturer example: pushing a crate’")

mcrate, mus, Fap = 30.0, 0.60, 50.0
L.N(f"A {fmt(mcrate)} kg crate rests on a rough horizontal floor with μ<sub>s</sub> = {fmt(mus)}. A horizontal push of {fmt(Fap)} N does not move it. What is the magnitude of the static friction force?",
    Fap, "N", [mus * mcrate * g, 0, mcrate * g],
    f"The crate stays at rest, so the net force is zero and the static friction force equals the push, {{a}}. The formula f<sub>s</sub> = μ<sub>s</sub>n gives only the largest possible static friction, {fmt(mus * mcrate * g)} N, which would be reached when the crate is about to slip. Static friction adjusts to the applied force up to that limit.",
    D + "‘Strongest misconception of the week’ and ‘Static and kinetic friction’", typ="misconception")

th = 35.0
L.N(f"A block slides down a frictionless incline that makes an angle of {fmt(th, 2)}° with the horizontal. What is the magnitude of its acceleration?",
    g * sin(th), "m/s²", [g * cos(th), g, g * tan(th)],
    f"Choose x down the slope. The weight component along the slope is mg sin θ and the normal force balances mg cos θ, so a = g sin θ = (9.80)(sin {fmt(th, 2)}°) = {{a}}. The acceleration is less than g and is independent of the mass. Using cosine gives the component of g perpendicular to the slope.",
    D + "‘An inclined plane: choosing axes’ and ‘Sliding down an incline: solution’")

th, mu = 25.0, 0.20
aincl = g * (sin(th) - mu * cos(th))
L.N(f"A block slides down an incline of {fmt(th, 2)}° with a coefficient of kinetic friction of {fmt(mu)}. What is its acceleration down the slope?",
    aincl, "m/s²", [g * sin(th), g * (sin(th) + mu * cos(th)), mu * g * cos(th)],
    f"Down the slope: mg sin θ − μ<sub>k</sub>n = ma, with n = mg cos θ. So a = g(sin θ − μ<sub>k</sub> cos θ) = {{a}}. Friction acts up the slope because the block moves down it, so it is subtracted. The value {fmt(g * sin(th))} m/s² ignores friction, and {fmt(g * (sin(th) + mu * cos(th)))} m/s² has friction pointing the wrong way.",
    D + "‘Lecturer example: sliding down an incline’ and ‘Toolkit 6: friction and the normal force’")

mcar, vc, Rc = 900.0, 12.0, 40.0
Fc = mcar * vc ** 2 / Rc
L.N(f"A {fmt(mcar, 3)} kg car rounds a flat circular bend of radius {fmt(Rc, 2)} m at a steady {fmt(vc, 2)} m/s. What horizontal force must the road exert on the car?",
    Fc, "N", [mcar * vc ** 2, mcar * vc / Rc, mcar * g],
    f"The net force must supply the centripetal acceleration: F = mv²/R = ({fmt(mcar, 3)})({fmt(vc, 2)})²/{fmt(Rc, 2)} = {{a}}, directed towards the centre of the bend. The value {fmt(mcar * g)} N is the weight, which is vertical. Leaving out the division by R, or squaring only part of the expression, gives wrong values.",
    D + "‘Toolkit 7: circular dynamics’ and ‘Lecturer example: a flat curve’")

mus, Rc = 0.80, 60.0
vmax = math.sqrt(mus * g * Rc)
L.N(f"A car travels round a flat circular bend of radius {fmt(Rc, 2)} m. The coefficient of static friction between the tyres and the road is {fmt(mus)}. What is the greatest speed at which the car can take the bend without skidding?",
    vmax, "m/s", [mus * g * Rc, mus * g, math.sqrt(2 * mus * g * Rc)],
    f"At the limit, static friction at its maximum supplies the centripetal force: μ<sub>s</sub>mg = mv²/R. The mass cancels, so v = √(μ<sub>s</sub>gR) = {{a}}. The value {fmt(mus * g * Rc)} is v² without the square root.",
    D + "‘Toolkit 7: circular dynamics’ and ‘A flat curve: solution’")

L.C("A car turns left on a flat road. Which horizontal force provides the centripetal acceleration of the car?",
    "Static friction from the road on the tyres, directed towards the centre of the turn",
    ["A centrifugal force, directed away from the centre of the turn", "The force of the engine, directed along the motion of the car", "A force of inertia that balances the friction"],
    "Centripetal means ‘towards the centre’. It is the name for the role played by a real force, here static friction. A centrifugal force does not act on the car in an inertial frame. The car’s tendency to go straight is inertia, not a force.",
    D + "‘Misconception: centrifugal force’", "misconception")

L.C("A person stands on a bathroom scale in a lift that is accelerating upward. How does the scale reading compare with the weight mg of the person?",
    "The reading is greater than mg.",
    ["The reading is equal to mg.", "The reading is less than mg.", "The reading is zero."],
    "The scale reads the normal force n. Taking up as positive, n − mg = ma with a > 0, so n = m(g + a), which is greater than mg. The normal force does not always equal the weight. It equals mg only when the vertical acceleration is zero.",
    D + "‘Toolkit 6: friction and the normal force’")
