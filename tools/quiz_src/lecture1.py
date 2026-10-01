import math
from common import Lecture, fmt, val

L = Lecture(1, "Vectors")
D = "Lecture 1 deck, slide "
cos = lambda d: math.cos(math.radians(d))
sin = lambda d: math.sin(math.radians(d))
atan = lambda x: math.degrees(math.atan(x))

L.C("Which of the following quantities is a vector?",
    "A displacement of 5 m towards the west",
    ["A temperature of −10 °C", "A mass of 60 kg", "A distance walked of 12 km"],
    "A vector needs a magnitude and a direction. A displacement towards the west has both. Temperature, mass and distance are described completely by a number and a unit, so they are scalars. A negative number, as in −10 °C, does not make a quantity a vector.",
    D + "‘Scalars and vectors’ and ‘Concept check: scalar or vector?’")

L.C("A student says that an energy of −5 J is a vector because it has a minus sign. Which statement is correct?",
    "Energy is a scalar. The minus sign is the sign of a scalar quantity and does not give a direction in space.",
    ["Energy is a vector, because any negative quantity points in the opposite direction.",
     "Energy is a vector only when it is measured in joules.",
     "Energy is a scalar only when its value is positive."],
    "Scalars can be positive, negative or zero. The sign of a scalar, such as −5 J or −10 °C, is not a direction. Only a quantity that needs a direction in space is a vector.",
    D + "‘Concept check: scalar or vector?’", "misconception")

L.C("A runner completes exactly one lap of a circular track of circumference 250 m and stops at the starting line. What are the distance travelled and the magnitude of the displacement?",
    "Distance 250 m, displacement magnitude 0 m",
    ["Distance 0 m, displacement magnitude 250 m", "Distance 250 m, displacement magnitude 250 m", "Distance 125 m, displacement magnitude 125 m"],
    "Distance is the total length of the path, 250 m. Displacement runs from the initial position to the final position. The runner finishes where the lap began, so the displacement is zero.",
    D + "‘Distance and displacement’")

a, b = 3.00, 5.00
R = math.hypot(a, b)
th = atan(b / a)
L.N(f"A hiker walks {fmt(a)} km north and then {fmt(b)} km east. In what direction is the hiker from the starting point, measured as an angle east of north?",
    th, "°", [atan(a / b), 180 - th, 180 - atan(a / b)],
    f"Sketch the two legs head to tail. The angle east of north is measured from the north leg, so tan θ = (east leg)/(north leg) = {fmt(b)}/{fmt(a)}, giving θ = {{a}}. The angle {val(atan(a / b), '°')} is the angle north of east, which is measured from the other leg. The resultant magnitude is {fmt(R)} km.",
    D + "‘Returning to the opening problem’")

L.C("Two displacement vectors have magnitudes 6 m and 9 m. Which value could be the magnitude of their sum?",
    "12 m", ["2 m", "16 m", "20 m"],
    "The magnitude of A + B lies between |A − B| and A + B, so here it lies between 3 m and 15 m. Only 12 m is in that range. A magnitude of 15 m would need the vectors to point the same way.",
    D + "‘Magnitudes do not simply add’ and ‘Toolkit 2: vector triangles’")

L.C("For two vectors A and B, how do A − B and B − A compare?",
    "They have the same magnitude and opposite directions.",
    ["They are equal, because vector addition is commutative.", "They have the same direction but different magnitudes.", "They have different magnitudes and different directions."],
    "Subtraction is not commutative. B − A = −(A − B), so the two results have equal magnitudes and point in opposite directions. Subtraction is addition of the reversed vector, A + (−B).",
    D + "‘Subtracting vectors’", "misconception")

a, b, ang = 4.00, 3.00, 50.0
inner = 180 - ang
R = math.sqrt(a * a + b * b - 2 * a * b * cos(inner))
L.N(f"A cyclist rides {fmt(a)} km east, then {fmt(b)} km at {fmt(ang, 2)}° north of east. What is the magnitude of the resultant displacement?",
    R, "km", [math.hypot(a, b), math.sqrt(a * a + b * b - 2 * a * b * cos(ang)), a + b],
    f"The two legs are not perpendicular, so Pythagoras does not apply. Placed head to tail, the angle inside the triangle between the legs is 180° − {fmt(ang, 2)}° = {fmt(inner, 3)}°. The cosine rule gives R² = {fmt(a)}² + {fmt(b)}² − 2({fmt(a)})({fmt(b)}) cos {fmt(inner, 3)}°, so R = {{a}}. This lies between {fmt(a - b)} km and {fmt(a + b)} km, as the check in Toolkit 2 requires.",
    D + "‘Your turn: when the angle is not 90°’ and ‘Toolkit 2: vector triangles’")

L.N("A vector points 40° west of north. What is its standard angle θ, measured counter-clockwise from the +x axis (east)?",
    130, "°", [50, 140, 220],
    "East is 0° and north is 90°. Starting at north and turning 40° towards west adds 40°, so θ = 90° + 40° = {a}. Always sketch first: the angle “40° west of north” is measured from north, not from east.",
    D + "‘Toolkit 1: directions and angles’", sf=2)

A, ang = 12.0, 35.0
Ay = -A * sin(ang)
L.N(f"A vector of magnitude {fmt(A)} m points {fmt(ang, 2)}\u00b0 below the +x axis. What is its y-component?",
    Ay, "m", [-Ay, -A * cos(ang), A * math.sin(-ang)],
    f"Sketch first: the vector points right and down, so A\u1d67 is negative. With the angle measured from +x, A\u1d67 = A sin \u03b8 = {fmt(A)} sin(\u2212{fmt(ang, 2)}\u00b0) = {{a}}. The value {fmt(-A * cos(ang))} m swaps sine and cosine. The value {fmt(A * math.sin(-ang))} m comes from a calculator set to radians instead of degrees, which a sketch and a sign check would catch.",
    D + "\u2018Predict the signs first\u2019 and \u2018Toolkit 3: components\u2019")

L.C("An angle \u03b2 is measured from the +y axis to a vector of magnitude A, towards +x. What are its components?",
    "A\u2093 = A sin \u03b2 and A\u1d67 = A cos \u03b2",
    ["A\u2093 = A cos \u03b2 and A\u1d67 = A sin \u03b2", "A\u2093 = A tan \u03b2 and A\u1d67 = A", "A\u2093 = A sin \u03b2 and A\u1d67 = A sin \u03b2"],
    "The formulas A cos \u03b8 and A sin \u03b8 hold only when \u03b8 is measured from +x. Here the y-component lies along the side adjacent to \u03b2, so it uses cosine, and the x-component lies opposite \u03b2, so it uses sine. Think \u2018adjacent or opposite?\u2019, not \u2018sine or cosine?\u2019.",
    D + "\u2018Your turn: angles measured from other axes\u2019 and \u2018Toolkit 3: components\u2019", "misconception")

ax, ay = -5.00, -12.0
ref = atan(abs(ay / ax))
theta = 180 + ref
L.N(f"A vector has components A\u2093 = {fmt(ax)} m and A\u1d67 = {fmt(ay)} m. What is its direction \u03b8, measured counter-clockwise from +x, in the range 0\u00b0 to 360\u00b0?",
    theta, "\u00b0", [ref, 180 - ref, 360 - ref],
    f"Both components are negative, so the vector is in quadrant III. The reference angle is tan\u207b\u00b9|{fmt(ay)}/{fmt(ax)}| = {val(ref, '\u00b0')}. In quadrant III \u03b8 = 180\u00b0 + reference = {{a}}. A calculator gives only {val(ref, '\u00b0')} for tan\u207b\u00b9(A\u1d67/A\u2093), which points into quadrant I, so quadrant first and calculation second.",
    D + "\u2018Direction from components: a common error\u2019 and \u2018Toolkit 4\u2019")

A = (3.0, -2.0); B = (-5.0, 6.0)
Rx, Ry = A[0] + B[0], A[1] + B[1]
mag = math.hypot(Rx, Ry)
L.N(f"Vector A has components ({fmt(A[0], 2)}, {fmt(A[1], 2)}) m and vector B has components ({fmt(B[0], 2)}, {fmt(B[1], 2)}) m. What is the magnitude of A + B?",
    mag, "m", [math.hypot(*A) + math.hypot(*B), abs(Rx) + abs(Ry), abs(Rx)],
    f"Add the components: R\u2093 = {fmt(Rx)} m and R\u1d67 = {fmt(Ry)} m. Then R = \u221a(R\u2093\u00b2 + R\u1d67\u00b2) = {{a}}. The value {fmt(math.hypot(*A) + math.hypot(*B))} m adds the magnitudes, which only works for vectors in the same direction. The value {fmt(abs(Rx) + abs(Ry))} m adds the components of the answer instead of combining them.",
    D + "\u2018Adding vectors with components\u2019")

c = (2.0, -3.0, 6.0)
mag = math.sqrt(sum(x * x for x in c))
L.N("What is the magnitude of the vector C = 2\u00ee \u2212 3\u0135 + 6k\u0302?",
    mag, "", [sum(abs(x) for x in c), sum(c), sum(x * x for x in c)],
    f"|C| = \u221a(2\u00b2 + (\u22123)\u00b2 + 6\u00b2) = \u221a(4 + 9 + 36) = \u221a49 = {{a}}. Adding the components, or adding their absolute values, does not give the magnitude. Forgetting the square root gives 49.0.",
    D + "\u2018Unit vectors\u2019 and \u2018The 3D Cartesian system\u2019")

A = (2.0, -3.0, 5.0); B = (4.0, 2.0, -1.0)
dot = sum(x * y for x, y in zip(A, B))
L.N("Find A \u00b7 B for A = 2\u00ee \u2212 3\u0135 + 5k\u0302 and B = 4\u00ee + 2\u0135 \u2212 k\u0302.",
    dot, "", [-dot, 19.0, 7.0],
    f"Multiply matching components and add: A\u00b7B = (2)(4) + (\u22123)(2) + (5)(\u22121) = 8 \u2212 6 \u2212 5 = {{a}}. The result is a scalar, and it is negative here because the angle between the vectors is greater than 90\u00b0.",
    D + "\u2018Dot product from components\u2019 and \u2018Predict the sign of A\u00b7B\u2019")

A, B, phi = 5.0, 4.0, 120.0
dot = A * B * cos(phi)
L.N(f"Two vectors have magnitudes {fmt(A, 2)} m and {fmt(B, 2)} m. The angle between them, with their tails together, is {fmt(phi)}\u00b0. What is A \u00b7 B?",
    dot, "m\u00b2", [-dot, A * B * sin(phi), -A * B * sin(phi)],
    f"A\u00b7B = AB cos \u03c6 = ({fmt(A, 2)})({fmt(B, 2)}) cos {fmt(phi)}\u00b0 = {{a}}. The angle is greater than 90\u00b0, so the dot product must be negative. The projection of one vector on the other points against it. Using sine instead of cosine gives \u00b1{fmt(A * B * sin(phi))} m\u00b2, which is the magnitude of the cross product.",
    D + "\u2018The dot (scalar) product\u2019 and \u2018Toolkit 6: the dot product\u2019")

L.C("What is the result of the cross product \u00ee \u00d7 k\u0302?",
    "\u2212\u0135", ["+\u0135", "+k\u0302", "0"],
    "The cyclic order \u00ee \u2192 \u0135 \u2192 k\u0302 \u2192 \u00ee gives a plus sign, so k\u0302 \u00d7 \u00ee = +\u0135. The order in \u00ee \u00d7 k\u0302 is reversed, so the result is \u2212\u0135. By the right-hand rule, curling the fingers from +x towards +z puts the thumb along \u2212y. The product is zero only for parallel vectors.",
    D + "\u2018Properties of the cross product\u2019")

A, B, phi = 6.0, 3.0, 30.0
cr = A * B * sin(phi)
L.N(f"Two vectors have magnitudes {fmt(A, 2)} m and {fmt(B, 2)} m. The angle between them, tails together, is {fmt(phi)}\u00b0. What is the magnitude of A \u00d7 B?",
    cr, "m\u00b2", [A * B * cos(phi), A * B, A * B / 4],
    f"|A\u00d7B| = AB sin \u03c6 = ({fmt(A, 2)})({fmt(B, 2)}) sin {fmt(phi)}\u00b0 = {{a}}. This is the area of the parallelogram formed by the two vectors. Using cosine gives the wrong quantity, {fmt(A * B * cos(phi))}, and omitting the angle gives the product of the magnitudes, {fmt(A * B)}.",
    D + "\u2018The cross (vector) product: geometry first\u2019")

L.C("Vectors A and B are drawn from a common tail and point in exactly the same direction. What are A \u00b7 B and the magnitude of A \u00d7 B?",
    "A \u00b7 B = AB and |A \u00d7 B| = 0",
    ["A \u00b7 B = 0 and |A \u00d7 B| = AB", "A \u00b7 B = 0 and |A \u00d7 B| = 0", "A \u00b7 B = AB and |A \u00d7 B| = AB"],
    "The angle between the vectors is 0\u00b0. The dot product is AB cos 0\u00b0 = AB, its largest value, and the cross product magnitude is AB sin 0\u00b0 = 0. For perpendicular vectors the roles are reversed: the dot product is zero and the cross product is largest.",
    D + "\u2018Dot product and cross product compared\u2019 and \u2018Toolkit 7\u2019", "graph")

L.C("On a diagram, vector A is drawn pointing east with length 8 m, and vector B is drawn head to tail from the head of A, pointing west with length 3 m. What is the resultant A + B?",
    "5 m, pointing east", ["11 m, pointing east", "5 m, pointing west", "3 m, pointing west"],
    "Head-to-tail addition gives a resultant from the tail of A to the head of B. B points opposite to A and is shorter, so the resultant points east with magnitude 8 m \u2212 3 m = 5 m. Magnitudes add directly only when the vectors point the same way.",
    D + "\u2018Adding vectors graphically: head to tail\u2019", "graph")

F, d, ang = 40.0, 5.0, 60.0
w = F * d * cos(ang)
L.N(f"A crate is pulled {fmt(d, 2)} m along a horizontal floor by a rope that exerts a constant force of {fmt(F, 2)} N at {fmt(ang, 2)}\u00b0 above the horizontal. What is F \u00b7 d, the work done by the rope?",
    w, "J", [F * d * sin(ang), F * d, F * d * math.cos(ang)],
    f"Only the component of the force along the displacement contributes: F\u00b7d = F d cos \u03b8 = ({fmt(F, 2)})({fmt(d, 2)}) cos {fmt(ang, 2)}\u00b0 = {{a}}. Using sine gives the contribution of the vertical component. Ignoring the angle gives the largest possible value, {fmt(F * d)} J. The negative value {fmt(F * d * math.cos(ang))} J comes from a calculator in radian mode.",
    D + "\u2018Integrated problem: pulling a crate\u2019")
