import math
from common import Lecture, fmt, val

L = Lecture(0, "Orientation and physical quantities")
D = "Introduction tutorial sheet, "
S = "Introduction supplement, "
H = "Introduction handout, "

L.C("Which statement is the best definition of a physical quantity?",
    "A measurable property of a system or phenomenon that can be expressed by a numerical value and a unit.",
    ["Any number that appears in a physics equation.", "A property that can be calculated but never measured.", "A measured number, written without a unit, that is accurate to three significant figures."],
    "A physical quantity has two parts: a numerical value and a unit. A length of 1.85 m is a physical quantity; the number 1.85 on its own is not. Quantities can be measured directly or found from other measured quantities.",
    H + "definition of a physical quantity")

L.C("A student reports the length of a bench as 1.85. What is missing from this answer?",
    "The unit. The number alone does not say whether the length is in metres, centimetres or feet.",
    ["The direction, because every length is a vector.", "A factor of 10, so that the answer is in scientific notation.", "Nothing, because the unit is understood from the context."],
    "A physical quantity is a numerical value together with a unit. Without the unit the number has no physical meaning. Length is a scalar, and scientific notation is a choice of style, not a requirement.",
    H + "physical quantities and units", "misconception")

L.C("A measurement is reported as 10.12 ± 0.02 cm. What does the ± 0.02 cm describe?",
    "The uncertainty: an estimate of the range within which the true value is expected to lie.",
    ["The error: the exact difference between the measured and the true value.", "The mistake that the experimenter made when reading the instrument.", "The precision, which is always equal to the number of digits shown."],
    "Uncertainty is an estimate of the range in which the true value is expected to lie. Error is measured value minus true value, and it is usually unknown because the true value is unknown. An error is not a mistake.",
    H + "error and uncertainty", "misconception")

L.C("Which statement about error and uncertainty is correct?",
    "Error is the difference between the measured value and the true value; uncertainty is our estimate of how large that difference might be.",
    ["Error and uncertainty are two names for the same quantity.", "Error is always known exactly; uncertainty is always unknown.", "Error means the experimenter has made a mistake; uncertainty means the instrument is broken."],
    "The two ideas are separate. We usually do not know the true value, so we cannot know the error exactly. We report an uncertainty instead. A mistake, such as misreading a scale, is a different thing from an error.",
    S + "error, uncertainty and mistakes", "misconception")

L.C("Which statement describes precision?",
    "How closely repeated measurements agree with one another.",
    ["How close a measured value is to the true value.", "The number of units used in the answer.", "The size of the mistake in a single reading."],
    "Precision describes the spread of repeated measurements. Accuracy is how close a value is likely to be to the true value. A set of readings can agree closely with one another and still all be wrong by the same amount.",
    D + "problem A8")

L.C("A digital clock shows the time to the second, repeats its readings consistently, but runs 5 minutes slow. Its readings are",
    "precise but not accurate.",
    ["both precise and accurate.", "accurate but not precise.", "neither precise nor accurate."],
    "The readings are consistent, so the clock is precise. They are wrong by about 5 minutes, so it is not accurate. A good instrument is both precise and accurate.",
    D + "part C, question C5")

L.C("The number 0.04050 has how many significant figures?",
    "4",
    ["2", "3", "5"],
    "Leading zeros only locate the decimal point and do not count. The significant figures are 4, 0, 5 and 0, and the last zero counts because it comes after the decimal point and after a non-zero digit.",
    D + "problem A6")

L.C("A rectangle is 3.2 cm by 1.25 cm. Its area, with the correct number of significant figures, is",
    "4.0 cm<sup>2</sup>",
    ["4 cm<sup>2</sup>", "4.00 cm<sup>2</sup>", "4.000 cm<sup>2</sup>"],
    "3.2 × 1.25 = 4.00 on the calculator. In a product the result has as many significant figures as the factor with the fewest. The factor 3.2 has two, so the area is 4.0 cm<sup>2</sup>.",
    D + "part C, question C3")

L.C("What is 18.52 + 4.6, with the correct number of significant figures?",
    "23.1",
    ["23.12", "23", "23.120"],
    "In addition and subtraction the position of the last reliable digit decides. The number 4.6 is known to one decimal place, so the sum is given to one decimal place: 23.1. Counting significant figures is the rule for products and quotients.",
    D + "problem A6")

L.C("In A = πd<sup>2</sup>/4, the diameter is d = 2.91 mm. How do the 4 and the exponent 2 affect the number of significant figures in A?",
    "They do not. They are exact numbers, so the three figures in d decide the result.",
    ["They reduce the result to one significant figure.", "They add one figure, so A has four significant figures.", "They reduce the result to two significant figures."],
    "Pure numbers that come from the formula, such as the 4 and the exponent 2, are exact and do not limit the figures. Only the measured value d with three significant figures does, so A = 6.65 mm<sup>2</sup>.",
    D + "problem A7", "misconception")

L.C("Which equation is dimensionally inconsistent? Here x is a length, v a speed, t a time and a an acceleration.",
    "v = at<sup>2</sup>",
    ["v = v<sub>0</sub> + at", "v<sup>2</sup> = v<sub>0</sub><sup>2</sup> + 2ax", "x = vt"],
    "The units of at<sup>2</sup> are (m/s<sup>2</sup>)(s<sup>2</sup>) = m, which is a length, but v is a speed in m/s. Terms in an equation can be equated or added only if they have the same units.",
    D + "problem A5 and part C, question C6")

L.C("A student finds that an equation is dimensionally consistent. What can be concluded?",
    "The equation may be correct, but it could still be wrong by a pure number such as a factor of 2.",
    ["The equation is certainly correct.", "The equation is certainly wrong.", "The equation must contain only quantities measured in SI units."],
    "Consistent units are necessary but not sufficient. For example, x = v<sub>0</sub>t + at<sup>2</sup> has consistent units yet is wrong by a factor of 2 in the last term, which should be (1/2)at<sup>2</sup>.",
    D + "problem A5", "misconception")

L.C("What is the SI base unit of mass?",
    "The kilogram",
    ["The gram", "The newton", "The tonne"],
    "In the SI the base unit of mass is the kilogram, even though the name already contains a prefix. The gram is a derived multiple, the newton is the unit of force, and the tonne is a non-SI unit.",
    S + "SI base units")

# ---------- numerical questions ----------
v = 54.0
L.N(f"A cyclist travels at {fmt(v, 3)} km/h. What is her speed in m/s?",
    v / 3.6, "m/s", [v * 3.6, v / 3600, v * 1000 / 60],
    "Use 1 km = 1000 m and 1 h = 3600 s: v = 54.0 × (1000 m)/(3600 s) = {a}. Dividing km/h by 3.6 gives m/s. The larger number in km/h is the check on the direction of the conversion.",
    D + "problem A1 and part C, question C1")

V = 2.5e3
L.N(f"A tank holds {fmt(V, 2)} cm<sup>3</sup>. What is its volume in m<sup>3</sup>?",
    V * 1e-6, "m<sup>3</sup>", [V * 1e-2, V * 1e-3, V * 1e-9],
    "1 cm = 10<sup>−2</sup> m, so 1 cm<sup>3</sup> = (10<sup>−2</sup> m)<sup>3</sup> = 10<sup>−6</sup> m<sup>3</sup>. Then V = 2.5×10<sup>3</sup> × 10<sup>−6</sup> m<sup>3</sup> = {a}.",
    D + "problem A3", sf=2)

t_ns = 450.0
L.N(f"A light pulse lasts {fmt(t_ns, 3)} ns. What is this duration in seconds?",
    t_ns * 1e-9, "s", [t_ns * 1e-6, t_ns * 1e-3, t_ns * 1e-12],
    "The prefix nano means 10<sup>−9</sup>, so 450 ns = 450 × 10<sup>−9</sup> s = {a}. The micro prefix (10<sup>−6</sup>) and the milli prefix (10<sup>−3</sup>) give much larger values.",
    S + "SI prefixes")

d = 2.91
L.N(f"A micrometer caliper gives the diameter of a wire as ({fmt(d, 3)} ± 0.01) mm. What is the cross-sectional area A = πd<sup>2</sup>/4, with the correct number of significant figures?",
    math.pi * d * d / 4, "mm<sup>2</sup>", [d * d, math.pi * d * d, math.pi * d * d / 2],
    "A = π(2.91 mm)<sup>2</sup>/4 = 6.651 mm<sup>2</sup> on the calculator. The measured diameter has three significant figures, so A = {a}.",
    D + "problem A7")

frac = 0.01 / d * 100
L.N(f"The diameter of a wire is ({fmt(d, 3)} ± 0.01) mm. What is the percent uncertainty in the diameter?",
    frac, "%", [1.0, 3.0, 0.03],
    "Fractional uncertainty = 0.01 mm / 2.91 mm = 0.0034. The percent uncertainty is 100 times this, which is {a} to one significant figure. The percent figure tells how large the uncertainty is compared with the measured value.",
    D + "problem A7", sf=1)

m, a_, b_, c_ = 1.20e3, 2.50, 4.0, 12.35
rho = m / (a_ * b_ * c_)
L.N("A metal block measures 2.50 cm by 4.0 cm by 12.35 cm and has mass 1.20 × 10<sup>3</sup> g. What is its density in g/cm<sup>3</sup>, with the correct number of significant figures?",
    rho, "g/cm<sup>3</sup>", [rho * 10, rho / 10, rho * 100],
    "V = 2.50 × 4.0 × 12.35 = 123.5 cm<sup>3</sup> and ρ = m/V = 1.20×10<sup>3</sup> g / 123.5 cm<sup>3</sup> = {a}. The factor 4.0 has two significant figures, so the answer has two. In SI units this is 9.7×10<sup>3</sup> kg/m<sup>3</sup>.",
    D + "problem A10", sf=2)

N = 70 * 60 * 24 * 365 * 70
L.N("Estimate the number of heartbeats in a lifetime of 70 years at 70 beats per minute. Give the answer to one significant figure.",
    N, "", [N / 100, N * 10, N / 1000],
    "Beats per year = 70 × 60 × 24 × 365 = 3.7 × 10<sup>7</sup>. Over 70 years this gives about {a}. Changing the rate to 60 or 80 beats per minute changes the result by about 15%, which does not change the power of ten.",
    D + "problem A9", sf=1)
