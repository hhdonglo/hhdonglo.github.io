import math
from common import Lecture, fmt, val

L = Lecture(11, "First law of thermodynamics")
D = "Lecture 11 deck, slide "
R = 8.314
Lv = 2.256e6

Q, W = 500.0, 200.0
L.N(f"A gas absorbs {fmt(Q, 3)} J of heat and does {fmt(W, 3)} J of work on its surroundings. Using the convention ΔU = Q − W, what is the change in its internal energy?",
    Q - W, "J", [Q + W, -(Q - W), Q],
    f"With heat entering the gas, Q = +{fmt(Q, 3)} J. With work done by the gas, W = +{fmt(W, 3)} J. Then ΔU = Q − W = {{a}}. Adding the two gives {fmt(Q + W)} J, which would be correct if the work were done on the gas. The sign convention must be read from the words: absorbed heat and work done by the gas.",
    D + "‘Energy crossing the boundary: signs for Q and W’ and ‘Toolkit 1: system and sign convention’")

p, V1, V2 = 2.0e5, 0.050, 0.030
W = p * (V2 - V1)
L.N(f"A gas is compressed at a constant pressure of {fmt(p / 1e5, 2)}×10<sup>5</sup> Pa from {fmt(V1, 2)} m³ to {fmt(V2, 2)} m³. What is the work done by the gas?",
    W, "J", [-W, p * V2, p * V1],
    f"At constant pressure W = pΔV = ({fmt(p / 1e5, 2)}×10⁵)({fmt(V2, 2)} − {fmt(V1, 2)}) = {{a}}. The volume decreases, so the work done by the gas is negative. Equivalently, the surroundings do {fmt(-W)} J of work on the gas. The values {fmt(p * V2)} J and {fmt(p * V1)} J use a single volume instead of the change.",
    D + "‘Work done by a gas in a volume change’ and ‘Work is an area on the pV diagram’")

pa, pb, Va, Vb = 3.0e5, 1.0e5, 2.0e-3, 6.0e-3
W = 0.5 * (pa + pb) * (Vb - Va)
L.N(f"On a pV diagram a gas expands along a straight line from p = {fmt(pa / 1e5, 2)}×10<sup>5</sup> Pa, V = {fmt(Va * 1000, 2)} L to p = {fmt(pb / 1e5, 2)}×10<sup>5</sup> Pa, V = {fmt(Vb * 1000, 2)} L. What is the work done by the gas? (1 L = 10<sup>−3</sup> m³.)",
    W, "J", [pa * (Vb - Va), pb * (Vb - Va), pa * Vb],
    f"The work is the area under the path. The area is a trapezoid: W = ½(p<sub>a</sub> + p<sub>b</sub>)ΔV = ½({fmt(pa, 2)} + {fmt(pb, 2)})({fmt(Vb - Va, 2)}×10⁻³) = {{a}}, with the volume converted to m³. The value {fmt(pa * (Vb - Va))} J is the larger rectangle under the starting pressure, and {fmt(pb * (Vb - Va))} J is the smaller one under the final pressure.",
    D + "‘Toolkit 2: work from a pV diagram’ and ‘Lecturer example: a straight-line path’", typ="graph")

L.C("A gas is taken from state A to state B along two different paths on a pV diagram. Which quantities have the same value for both paths?",
    "The change in internal energy ΔU only",
    ["The heat Q only", "The work W only", "Q, W and ΔU, because the end states are the same"],
    "Internal energy is a state function, so ΔU depends only on the initial and final states. Heat and work are not state functions. They are energy transfers whose values depend on the path, which is why the area under the curve differs from one path to another.",
    D + "‘The work depends on the path’ and ‘Same end points, four different works’")

n, T, Va, Vb = 0.500, 300.0, 2.0, 6.0
W = n * R * T * math.log(Vb / Va)
L.N(f"{fmt(n, 3)} mol of an ideal gas at {fmt(T, 3)} K expands isothermally from {fmt(Va, 2)} L to {fmt(Vb, 2)} L. How much work does the gas do?",
    W, "J", [n * R * T * math.log10(Vb / Va), n * R * T * Vb / Va, n * R * T * (Vb - Va) / Va],
    f"For an isothermal process W = nRT ln(V₂/V₁) = ({fmt(n, 3)})(8.314)({fmt(T, 3)}) ln({fmt(Vb / Va, 2)}) = {{a}}. The logarithm must be the natural logarithm. Using log₁₀ gives {fmt(n * R * T * math.log10(Vb / Va))} J, and leaving out the logarithm gives {fmt(n * R * T * Vb / Va)} J. Since ΔU = 0 for an ideal gas at constant T, the heat absorbed equals this work.",
    D + "‘Isothermal work of an ideal gas’")

n, T1, T2 = 2.00, 300.0, 400.0
Cp = 2.5 * R
Q = n * Cp * (T2 - T1)
L.N(f"{fmt(n, 3)} mol of a monatomic ideal gas is heated from {fmt(T1, 3)} K to {fmt(T2, 3)} K at constant pressure. How much heat is absorbed? Use R = 8.314 J/(mol·K).",
    Q, "J", [n * 1.5 * R * (T2 - T1), n * R * (T2 - T1), n * 3.5 * R * (T2 - T1)],
    f"At constant pressure Q = nC<sub>p</sub>ΔT. For a monatomic gas C<sub>V</sub> = (3/2)R and C<sub>p</sub> = C<sub>V</sub> + R = (5/2)R. So Q = ({fmt(n, 3)})(2.5)(8.314)({fmt(T2 - T1, 3)}) = {{a}}. The value {fmt(n * 1.5 * R * (T2 - T1))} J is ΔU, which is less than Q because part of Q goes into the work {fmt(n * R * (T2 - T1))} J done by the expanding gas.",
    D + "‘Heat capacities C<sub>V</sub> and C<sub>p</sub> of an ideal gas’ and ‘Toolkit 5: ideal-gas energy and heat capacities’")

n, T1, T2 = 1.50, 300.0, 340.0
dU = n * 2.5 * R * (T2 - T1)
L.N(f"{fmt(n, 3)} mol of a diatomic ideal gas (C<sub>V</sub> = (5/2)R) is heated from {fmt(T1, 3)} K to {fmt(T2, 3)} K at constant volume. What is the change in its internal energy?",
    dU, "J", [n * 3.5 * R * (T2 - T1), n * R * (T2 - T1), n * 1.5 * R * (T2 - T1)],
    f"ΔU = nC<sub>V</sub>ΔT = ({fmt(n, 3)})(2.5)(8.314)({fmt(T2 - T1, 3)}) = {{a}}. At constant volume the work is zero, so Q = ΔU. The value {fmt(n * 3.5 * R * (T2 - T1))} J uses C<sub>p</sub>. For an ideal gas ΔU = nC<sub>V</sub>ΔT holds for any process between these two temperatures.",
    D + "‘Internal energy of an ideal gas’ and ‘Toolkit 5: ideal-gas energy and heat capacities’")

L.C("An ideal gas expands adiabatically and does work on its surroundings. What happens to its temperature?",
    "It decreases, because the work is done at the expense of the internal energy.",
    ["It stays constant, because the gas is an ideal gas.", "It increases, because the gas does work.", "It stays constant, because no heat enters the gas."],
    "For an adiabatic process Q = 0, so ΔU = −W. The gas does positive work, so ΔU is negative and, for an ideal gas, the temperature falls. An isothermal expansion needs heat to flow in so that the temperature stays constant, and an adiabatic one does not allow that.",
    D + "‘Concept check: isothermal against adiabatic’ and ‘The adiabatic process’", "misconception")

T1, r, gam = 290.0, 15.0, 1.40
T2 = T1 * r ** (gam - 1)
L.N(f"Air at {fmt(T1, 3)} K in a diesel engine cylinder is compressed adiabatically to 1/{fmt(r, 2)} of its original volume. Treat the air as an ideal gas with γ = {fmt(gam, 3)}. What is the temperature at the end of the compression?",
    T2, "K", [T1 * r, T1, T1 * math.sqrt(r)],
    f"For an adiabatic process TV<sup>γ−1</sup> is constant, so T₂ = T₁(V₁/V₂)<sup>γ−1</sup> = ({fmt(T1, 3)})({fmt(r, 2)})<sup>0.40</sup> = {{a}}. This is hot enough to ignite the injected fuel without a spark. Using T₂ = T₁ × {fmt(r, 2)} would be the result for a relation that does not apply, and T₂ = T₁ is the isothermal result.",
    D + "‘Lecturer example: compression in a diesel engine’ and ‘Diesel compression: solution’")

p1, gam = 100.0, 5 / 3
p2 = p1 * 2 ** gam
L.N(f"A monatomic ideal gas (γ = 5/3) at {fmt(p1, 3)} kPa is compressed adiabatically to half its volume. What is its final pressure?",
    p2, "kPa", [p1 * 2, p1 * 2 ** (gam - 1), p1 * 2 ** 1.4],
    f"For an adiabatic process pV<sup>γ</sup> is constant, so p₂ = p₁(V₁/V₂)<sup>γ</sup> = ({fmt(p1, 3)})(2)<sup>5/3</sup> = {{a}}. An isothermal compression to half the volume would only double the pressure, to {fmt(p1 * 2)} kPa. The adiabatic pressure is greater because the temperature also rises.",
    D + "‘Toolkit 6: adiabatic scaling’ and ‘Isotherm against adiabat’")

n, Ta, Tb = 0.200, 400.0, 300.0
W = n * 1.5 * R * (Ta - Tb)
L.N(f"{fmt(n, 3)} mol of a monatomic ideal gas expands adiabatically and its temperature falls from {fmt(Ta, 3)} K to {fmt(Tb, 3)} K. How much work does the gas do?",
    W, "J", [-W, n * 2.5 * R * (Ta - Tb), n * R * (Ta - Tb)],
    f"With Q = 0, W = −ΔU = nC<sub>V</sub>(T₁ − T₂) = ({fmt(n, 3)})(1.5)(8.314)({fmt(Ta - Tb, 3)}) = {{a}}. The work is positive because the gas does work and its internal energy falls. Using C<sub>p</sub> instead of C<sub>V</sub> gives {fmt(n * 2.5 * R * (Ta - Tb))} J, which is the heat needed at constant pressure.",
    D + "‘Your turn: adiabatic expansion of argon’ and ‘Toolkit 5: ideal-gas energy and heat capacities’")

dp, dV = 2.0e5, 4.0e-3
Wc = 0.5 * dp * dV
L.N(f"A gas goes round a triangular cycle on a pV diagram in the clockwise direction. The triangle has a pressure range of {fmt(dp / 1e5, 2)}×10<sup>5</sup> Pa (its height) and a volume range of {fmt(dV * 1000, 2)} L (its base). What is the net work done by the gas in one cycle?",
    Wc, "J", [dp * dV, -Wc, 0],
    f"The net work in a cycle is the area enclosed: ½(base)(height) = ½({fmt(dV, 2)} m³)({fmt(dp, 2)} Pa) = {{a}}. It is positive for a clockwise cycle, where the expansion occurs at a higher pressure than the compression. A counter-clockwise cycle would give the negative value. The net work is not zero even though ΔU = 0 for the full cycle, because the net heat equals the net work.",
    D + "‘Cycles: net work is the enclosed area’ and ‘Your turn: a triangular cycle’", typ="graph")

Qh, Qc = 600.0, 450.0
L.N(f"In one complete cycle a gas absorbs {fmt(Qh, 3)} J of heat and rejects {fmt(Qc, 3)} J of heat. What is the net work done by the gas in the cycle?",
    Qh - Qc, "J", [Qh + Qc, -(Qh - Qc), Qh],
    f"After a complete cycle the gas is back in its initial state, so ΔU = 0 and Q<sub>net</sub> = W<sub>net</sub>. The net heat is {fmt(Qh, 3)} − {fmt(Qc, 3)} = {{a}}, so the work done by the gas is {{a}}. The sign is positive, meaning the cycle acts as an engine.",
    D + "‘Cyclic processes’ and ‘Your turn: a counter-clockwise cycle’")

m, pp, Vsteam, Vwater = 2.00e-3, 1.013e5, 3.40e-3, 2.0e-6
Qb = m * Lv
Wb = pp * (Vsteam - Vwater)
L.N(f"{fmt(m * 1000, 3)} g of water at 100 °C boils at the constant pressure of 1.013×10<sup>5</sup> Pa. The volume increases from 2.0×10<sup>−6</sup> m³ to 3.40×10<sup>−3</sup> m³. The heat of vaporisation is 2.256×10<sup>6</sup> J/kg. What is the change in internal energy?",
    Qb - Wb, "J", [Qb, Qb + Wb, Wb],
    f"The heat absorbed is Q = mL<sub>v</sub> = {fmt(Qb)} J. The work done in pushing the atmosphere back is W = pΔV = {fmt(Wb)} J. Then ΔU = Q − W = {{a}}. Most of the energy increases the internal energy, by loosening the bonds between molecules, and a small fraction does work on the surroundings.",
    D + "‘The first law and a change of phase’ and ‘Boiling water: solution’")

L.C("Starting from the same point on a pV diagram, an ideal gas expands to twice its volume once isothermally and once adiabatically. Which statement about the two curves is correct?",
    "The adiabatic curve falls more steeply, so it ends at a lower pressure and a lower temperature.",
    ["The adiabatic curve falls less steeply, so it ends at a higher pressure.", "The two curves coincide, because both are expansions.", "The adiabatic curve is horizontal, because no heat is exchanged."],
    "On the isotherm pV is constant, while on the adiabat pV<sup>γ</sup> is constant with γ > 1. The adiabat therefore falls more steeply. During the adiabatic expansion the gas does work at the expense of its internal energy, so the temperature drops, while on the isotherm heat flows in to keep T constant.",
    D + "‘Isotherm against adiabat’ and ‘Concept check: compression to half the volume’", "graph")

L.N("What is the molar heat capacity at constant pressure, C<sub>p</sub>, of a diatomic ideal gas whose molecules can rotate but do not vibrate? Use R = 8.314 J/(mol·K).",
    3.5 * R, "J/(mol·K)", [2.5 * R, R, 4.5 * R],
    "Such a molecule has f = 5 degrees of freedom (three translational and two rotational), so C<sub>V</sub> = (f/2)R = (5/2)R. Then C<sub>p</sub> = C<sub>V</sub> + R = (7/2)R = {a}. The value (5/2)R = 20.8 J/(mol·K) is C<sub>V</sub>, and R by itself is the difference C<sub>p</sub> − C<sub>V</sub>.",
    D + "‘Equipartition and degrees of freedom’ and ‘Toolkit 5: ideal-gas energy and heat capacities’")

n, T, ratio = 0.250, 320.0, 5.0
Qiso = n * R * T * math.log(1 / ratio)
L.N(f"{fmt(n, 3)} mol of an ideal gas at {fmt(T, 3)} K is compressed isothermally to one fifth of its original volume. How much heat flows into the gas? A negative answer means heat flows out.",
    Qiso, "J", [-Qiso, 0, n * R * T * math.log10(1 / ratio)],
    f"For an isothermal process ΔU = 0, so Q = W = nRT ln(V₂/V₁) = ({fmt(n, 3)})(8.314)({fmt(T, 3)}) ln(1/{fmt(ratio, 2)}) = {{a}}. The work done by the gas is negative because it is compressed, so the heat flows out of the gas to the surroundings. The value 0 J would be the heat for an adiabatic process, where the temperature would rise.",
    D + "‘Your turn: an isothermal compression’ and ‘Toolkit 4: recognising the process’")

L.C("A gas in a perfectly insulated cylinder is compressed quickly by a piston. Which statement is correct?",
    "Q = 0, the work done by the gas is negative, and the internal energy and temperature of the gas rise.",
    ["Q = 0, the work done by the gas is positive, and the temperature falls.", "ΔU = 0, because the cylinder is insulated.", "Heat flows out of the gas, so the temperature falls."],
    "The insulation makes the process adiabatic, Q = 0, so ΔU = −W. The piston does work on the gas, so W is negative and ΔU is positive. The extra energy raises the molecules’ kinetic energy, and the temperature increases. This is the principle of a diesel engine and of a bicycle pump warming up.",
    D + "‘Concept check: isothermal against adiabatic’ and ‘Link to Lecture 10: the pump’")

Qbc, dUbc = -80.0, -200.0
Wbc = Qbc - dUbc
L.N(f"In one step of a process, a gas gives out {fmt(-Qbc, 3)} J of heat, so Q = {fmt(Qbc, 3)} J, and its internal energy falls by {fmt(-dUbc, 3)} J. What is the work done by the gas in this step?",
    Wbc, "J", [-Wbc, Qbc + dUbc, abs(Qbc) + abs(dUbc)],
    f"Rearrange the first law, ΔU = Q − W, to W = Q − ΔU = ({fmt(Qbc, 3)}) − ({fmt(dUbc, 3)}) = {{a}}. The work is positive, so the gas does work on its surroundings. The energy for it comes from the internal energy, {fmt(-dUbc)} J, minus the {fmt(-Qbc)} J that was lost as heat. The sum Q + ΔU = {fmt(Qbc + dUbc)} J does not follow from the first law.",
    D + "‘Toolkit 3: the energy ledger’ and ‘Integrated problem: the ledger’")

gm = (1.5 * R + R) / (1.5 * R)
L.N("A monatomic ideal gas has C<sub>V</sub> = (3/2)R. What is the ratio γ = C<sub>p</sub>/C<sub>V</sub>?",
    gm, "", [1.4, 1 / gm, 2.5],
    "For an ideal gas C<sub>p</sub> = C<sub>V</sub> + R, so γ = (5/2)R/(3/2)R = 5/3 = {a}. The value 1.40 is for a diatomic gas, γ = 7/5. The ratio C<sub>p</sub>/C<sub>V</sub> is always greater than 1, so the inverse 0.600 cannot be correct. The ratio γ sets the exponent in the adiabatic relations pV<sup>γ</sup> = constant and TV<sup>γ−1</sup> = constant.",
    D + "‘Heat capacities C<sub>V</sub> and C<sub>p</sub> of an ideal gas’ and ‘Measured molar heat capacities’")
