import math
from common import Lecture, fmt, val

L = Lecture(9, "Temperature and heat")
D = "Lecture 9 deck, slide "
cw = 4186.0
sigma = 5.67e-8

L.C("Which statement about heat is correct?",
    "Heat is energy that is transferred between objects because of a temperature difference.",
    ["Heat is the temperature of an object.", "Heat is the thermal energy stored inside an object.", "Heat is a substance that flows from a hotter object into a colder one and is conserved."],
    "Heat is energy in transit, Q, not a property that an object contains. Temperature is a property of the state of an object. Energy stored in the molecules is internal energy. Once the energy has been transferred it is no longer called heat.",
    D + "‘Temperature is not heat’ and ‘Systems and states’", "misconception")

L.C("Object A and object B are each in thermal equilibrium with object C, but A and B are not in contact. What does the zeroth law of thermodynamics say about A and B?",
    "A and B are in thermal equilibrium with each other, so they have the same temperature.",
    ["A and B must have different temperatures, because they are separate objects.", "Nothing can be said until A and B are placed in contact.", "A and B must contain equal amounts of heat."],
    "The zeroth law says that if two systems are each in thermal equilibrium with a third, they are in thermal equilibrium with each other. This is what makes temperature a well-defined property and a thermometer, the third system, meaningful.",
    D + "‘The zeroth law’")

TF = 350.0
TC = (TF - 32) * 5 / 9
L.N(f"A recipe gives an oven temperature of {fmt(TF, 3)} °F. What is this temperature on the Celsius scale?",
    TC, "°C", [TF - 32, TF * 5 / 9, TF * 9 / 5 + 32],
    f"T<sub>C</sub> = (5/9)(T<sub>F</sub> − 32) = (5/9)({fmt(TF, 3)} − 32) = {{a}}. Subtracting 32 only, or multiplying by 5/9 only, skips one step of the conversion. The value {fmt(TF * 9 / 5 + 32)} converts in the wrong direction.",
    D + "‘Temperature scales’ and ‘Toolkit 1: temperature scales and conversions’")

TcC = -40.0
L.N(f"On a very cold day the temperature is {fmt(TcC, 2)} °C. What is this temperature in kelvin? Use T = T<sub>C</sub> + 273.15 and give the answer to three significant figures.",
    TcC + 273.15, "K", [273.15 - TcC, 273.15, abs(TcC)],
    f"T = T<sub>C</sub> + 273.15 = ({fmt(TcC, 2)}) + 273.15 = {{a}}. Kelvin temperatures are measured from absolute zero, so they are never negative. Adding 40 instead of subtracting it, or ignoring the Celsius value, gives wrong answers.",
    D + "‘Temperature scales’")

al, L0, dT = 2.4e-5, 2.50, 80.0
dL = al * L0 * dT * 1000
L.N(f"An aluminium rod is {fmt(L0, 3)} m long at a certain temperature. Its coefficient of linear expansion is {fmt(al * 1e5, 2)}×10<sup>−5</sup> K<sup>−1</sup>. By how much does it lengthen when its temperature rises by {fmt(dT, 2)} K? Give the answer in millimetres.",
    dL, "mm", [2 * dL, dL / 2, dL * 10],
    f"ΔL = αL₀ΔT = ({fmt(al, 2)} K⁻¹)({fmt(L0, 3)} m)({fmt(dT, 2)} K) = {fmt(dL / 1000)} m = {{a}}. Check the size: ΔL/L₀ = {fmt(al * dT, 2)}, a small fraction, as expected. Using 2α gives the area coefficient, and the other wrong values come from slips in the power of ten or in the factor.",
    D + "‘Thermal expansion’ and ‘Toolkit 2: thermal expansion’")

Y, al, dT = 2.0e11, 1.2e-5, 30.0
st = Y * al * dT / 1e6
L.N(f"A steel rail cannot expand because it is fixed rigidly at both ends. It is heated by {fmt(dT, 2)} K. The coefficient of linear expansion is {fmt(al * 1e5, 2)}×10<sup>−5</sup> K<sup>−1</sup> and Young’s modulus is {fmt(Y / 1e11, 2)}×10<sup>11</sup> Pa. What is the thermal stress in the rail, in megapascals?",
    st, "MPa", [st * 10, st / 10, st / 30],
    f"If the expansion is prevented, the stress is F/A = Yα ΔT = ({fmt(Y / 1e11, 2)}×10¹¹)({fmt(al * 1e5, 2)}×10⁻⁵)({fmt(dT, 2)}) = {fmt(Y * al * dT)} Pa = {{a}}. This is why rails are laid with gaps or with allowance for expansion. Slips in the power of ten, or leaving out ΔT, give the other values.",
    D + "‘Toolkit 2: thermal expansion’ and ‘Lecturer example: a steel rail’")

L.C("A flat steel washer has a circular hole in its centre. The washer is heated uniformly. What happens to the diameter of the hole?",
    "It increases, as if the hole were a disc made of the same material.",
    ["It decreases, because the metal expands into the hole.", "It stays the same, because the hole contains no material.", "It increases only if the washer is thin."],
    "Every length in the plate, including the distance across the hole, scales by the same factor 1 + αΔT. The hole expands exactly as a disc of the same material would. A common error is to think that the metal grows inward.",
    D + "‘Does a hole expand or shrink?’", "misconception")

b, V0, dT = 9.5e-4, 40.0, 18.0
dV = b * V0 * dT
L.N(f"A fuel tank is filled to the brim with {fmt(V0, 3)} L of gasoline. The coefficient of volume expansion of gasoline is {fmt(b * 1e4, 2)}×10<sup>−4</sup> K<sup>−1</sup>. If the tank itself does not expand, how much gasoline overflows when the temperature rises by {fmt(dT, 2)} K?",
    dV, "L", [dV / 3, dV / 10, dV * 10],
    f"ΔV = βV₀ΔT = ({fmt(b, 2)} K⁻¹)({fmt(V0, 3)} L)({fmt(dT, 2)} K) = {{a}}. Use the volume coefficient β for a volume, not the linear coefficient. For a solid β ≈ 3α, which would give about a third of the value for the same material.",
    D + "‘Your turn: a full fuel tank’")

m, T1, T2 = 1.50, 20.0, 80.0
Q = m * cw * (T2 - T1)
L.N(f"How much heat is needed to raise the temperature of {fmt(m, 3)} kg of water from {fmt(T1, 3)} °C to {fmt(T2, 3)} °C? The specific heat of water is 4186 J/(kg·K).",
    Q, "J", [m * cw, m * 1000 * cw * (T2 - T1), m * cw * T2],
    f"Q = mcΔT = ({fmt(m, 3)})(4186)({fmt(T2 - T1, 3)}) = {{a}}. A temperature difference in °C equals the same difference in K. The value {fmt(m * cw)} J is only mc, which is the energy needed per kelvin. Using the mass in grams gives a value 1000 times too large.",
    D + "‘Heat and the change in temperature’ and ‘Toolkit 3: heat and specific heat’")

mc_, cc, Tc = 0.300, 390.0, 120.0
mw, Tw = 0.400, 20.0
Tf = (mc_ * cc * Tc + mw * cw * Tw) / (mc_ * cc + mw * cw)
L.N(f"A {fmt(mc_, 3)} kg copper block (specific heat {fmt(cc, 3)} J/(kg·K)) at {fmt(Tc, 3)} °C is dropped into {fmt(mw, 3)} kg of water at {fmt(Tw, 3)} °C in an insulated container. What is the final equilibrium temperature? Neglect the container.",
    Tf, "°C", [(Tc + Tw) / 2, (mc_ * Tc + mw * Tw) / (mc_ + mw), (mw * cw * Tc + mc_ * cc * Tw) / (mc_ * cc + mw * cw)],
    f"No heat leaves the system, so the heat lost by the copper equals the heat gained by the water: m<sub>c</sub>c<sub>c</sub>(T<sub>c</sub> − T<sub>f</sub>) = m<sub>w</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>w</sub>). Then T<sub>f</sub> = (m<sub>c</sub>c<sub>c</sub>T<sub>c</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub>)/(m<sub>c</sub>c<sub>c</sub> + m<sub>w</sub>c<sub>w</sub>) = {{a}}. Water has a much larger heat capacity, so the final temperature is close to the water’s starting temperature. The simple average {fmt((Tc + Tw) / 2)} °C ignores the heat capacities.",
    D + "‘Calorimetry: energy conservation for heat’ and ‘Lecturer example: a hot metal in water’")

L.C("Equal amounts of heat are supplied to a 1 kg block of copper (specific heat 390 J/(kg·K)) and 1 kg of water (4186 J/(kg·K)), both starting at the same temperature. Which has the greater temperature rise?",
    "The copper, because it has the smaller specific heat",
    ["The water, because it has the larger specific heat", "Both rise by the same amount, because the masses are equal", "The water, because heat flows more easily into liquids"],
    "From Q = mcΔT, ΔT = Q/(mc). For equal Q and m, a smaller c gives a larger ΔT. The copper rises by about 11 times as much as the water. The specific heat is the energy needed per kilogram per kelvin.",
    D + "‘Toolkit 3: heat and specific heat’")

k, A, Lw, dTw = 0.80, 12.0, 0.20, 20.0
H = k * A * dTw / Lw
L.N(f"A brick wall has area {fmt(A, 3)} m², thickness {fmt(Lw, 2)} m and thermal conductivity {fmt(k, 2)} W/(m·K). The inside surface is at 22 °C and the outside surface is at 2 °C. What is the rate of heat conduction through the wall?",
    H, "W", [k * A * dTw, k * A * dTw * 0.01 / Lw, k * A * dTw * Lw],
    f"H = kAΔT/L = ({fmt(k, 2)})({fmt(A, 3)})({fmt(dTw, 2)})/({fmt(Lw, 2)}) = {{a}}. The thickness is in the denominator, since a thicker wall conducts less. The value {fmt(k * A * dTw)} W leaves out the division by L. The value {fmt(k * A * dTw * Lw)} W multiplies by L.",
    D + "‘Conduction’ and ‘Toolkit 5: conduction’")

k1, k2, Th, Tc = 200.0, 50.0, 90.0, 10.0
Ti = (k1 * Th + k2 * Tc) / (k1 + k2)
L.N(f"Two bars of equal length and cross-section are joined end to end. The first has k = {fmt(k1, 3)} W/(m·K) and its free end is held at {fmt(Th, 2)} °C. The second has k = {fmt(k2, 3)} W/(m·K) and its free end is held at {fmt(Tc, 2)} °C. In steady state, what is the temperature at the joint?",
    Ti, "°C", [(Th + Tc) / 2, (k2 * Th + k1 * Tc) / (k1 + k2), Tc + (Th - Tc) * k2 / (k1 + k2) * 2],
    f"In steady state the heat current is the same through both bars: k₁A(T<sub>H</sub> − T<sub>i</sub>)/L = k₂A(T<sub>i</sub> − T<sub>C</sub>)/L. The area and length cancel, so T<sub>i</sub> = (k₁T<sub>H</sub> + k₂T<sub>C</sub>)/(k₁ + k₂) = {{a}}. The joint is closer to the hot end because the first bar is the better conductor, so less temperature drop is needed across it. The simple average {fmt((Th + Tc) / 2)} °C would hold only if k₁ = k₂.",
    D + "‘Lecturer example: two bars in series’ and ‘Two bars in series: solution’")

L.C("A metal handle and a wooden handle are both at room temperature. The metal one feels colder when you touch it. Why?",
    "Metal has a much larger thermal conductivity, so it carries heat away from your hand faster.",
    ["Metal is at a lower temperature than the wood.", "Metal contains less heat than wood.", "Wood is a better conductor, so it takes heat from your hand more slowly."],
    "Both objects are at the same temperature. Your skin is warmer, and what you feel is the rate at which heat leaves your hand. This rate is proportional to the thermal conductivity, which is far greater for metal. The sensation measures the heat current, not the temperature of the object.",
    D + "‘Concept check: why does metal feel colder?’", "misconception")

L.C("The absolute temperature of a hot object is doubled. By what factor does the power it radiates change, if its surface area and emissivity stay the same?",
    "It increases by a factor of 16.",
    ["It increases by a factor of 2.", "It increases by a factor of 4.", "It increases by a factor of 8."],
    "The radiated power is H = eσAT⁴, which is proportional to the fourth power of the absolute temperature. Doubling T multiplies H by 2⁴ = 16. This is why temperatures in the formula must be in kelvin.",
    D + "‘Radiation’ and ‘Toolkit 6: radiation’")

e, A, T = 0.97, 1.8, 305.0
H = e * sigma * A * T ** 4
L.N(f"Take the skin of a person to be a body with emissivity {fmt(e, 2)}, surface area {fmt(A, 2)} m² and temperature {fmt(T, 3)} K. Use σ = 5.67×10<sup>−8</sup> W/(m²·K<sup>4</sup>). What power does the skin radiate?",
    H, "W", [e * sigma * A * (T - 273.15) ** 4, sigma * A * T ** 4, e * sigma * A * T ** 3],
    f"H = eσAT⁴ = ({fmt(e, 2)})(5.67×10⁻⁸)({fmt(A, 2)})({fmt(T, 3)})⁴ = {{a}}. The temperature must be in kelvin. Using the Celsius value, {fmt(T - 273.15)} °C, gives {fmt(e * sigma * A * (T - 273.15) ** 4)} W. In practice the person also absorbs radiation from the surroundings, so the net loss is much smaller.",
    D + "‘Lecturer example: radiation from a person’ and ‘Toolkit 6: radiation’")

k, A, Lr, dT = 385.0, 4.0e-4, 0.60, 100.0
H = k * A * dT / Lr
mi, Lf = 0.010, 3.34e5
t = mi * Lf / H
L.N(f"A copper rod of length {fmt(Lr, 2)} m and cross-section {fmt(A * 1e4, 2)} cm² (k = {fmt(k, 3)} W/(m·K)) has one end at 100 °C and the other end at 0 °C. All the heat it conducts melts ice at 0 °C. How long does it take to melt {fmt(mi, 2)} kg of ice? Use L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg and neglect losses.",
    t, "s", [mi * Lf * H, mi * Lf, H / (mi * Lf)],
    f"The rate of heat flow is H = kAΔT/L = {fmt(H)} W. The energy needed is Q = mL<sub>f</sub> = {fmt(mi * Lf)} J. Time is energy divided by rate: t = Q/H = {{a}}. Dividing the other way round, or multiplying, gives a quantity that does not have the dimensions of time.",
    D + "‘Toolkit 7: rates and energy’ and ‘Integrated problem: heating water through a rod’")

L.C("The Sun’s heat reaches the Earth across the vacuum of space. Which mode of heat transfer is responsible?",
    "Radiation, because electromagnetic waves can travel through a vacuum",
    ["Conduction, because the heat is passed from atom to atom", "Convection, because the heat is carried by moving material", "None, because heat cannot cross a vacuum"],
    "Conduction and convection need matter. Radiation is carried by electromagnetic waves, so it needs no medium. All objects radiate, and the amount depends on the fourth power of the absolute temperature.",
    D + "‘Three ways heat moves’ and ‘Radiation’")

dF = 18.0
L.N(f"The temperature of a liquid rises by {fmt(dF, 3)} Fahrenheit degrees. By how many kelvin does it rise?",
    dF * 5 / 9, "K", [dF, (dF - 32) * 5 / 9, dF + 273.15],
    f"A temperature difference converts with the factor 5/9 only, since the offset of 32 cancels in a difference: ΔT = (5/9)({fmt(dF, 3)}) = {{a}}. A Celsius degree and a kelvin are the same size, and a Fahrenheit degree is 5/9 as large. The offsets 32 and 273.15 apply to temperatures, not to differences.",
    D + "‘Toolkit 1: temperature scales and conversions’")

L.C("Block A has a large mass and is at 30 °C. Block B has a small mass and is at 80 °C. They are placed in contact and isolated from their surroundings. In which direction does heat flow at first?",
    "From B to A, because B is at the higher temperature",
    ["From A to B, because A contains more thermal energy", "From A to B, because A has the larger mass", "No heat flows, because the blocks have different masses"],
    "The direction of heat transfer is set by the temperature difference, from higher to lower temperature, not by the amount of energy stored or the mass. The large block can hold more thermal energy and still be the colder one. Heat flows until the two reach a common temperature.",
    D + "‘Temperature is not heat’ and ‘Thermal equilibrium and walls’", "misconception")
