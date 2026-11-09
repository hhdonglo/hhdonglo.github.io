import math
from common import Lecture, fmt, val

L = Lecture(10, "Thermal properties of matter")
D = "Lecture 10 deck, slide "
R = 8.314
kB = 1.381e-23
NA = 6.022e23
cw = 4186.0
Lf, Lv = 3.34e5, 2.256e6

mg, M = 8.0, 4.00
n = mg / M
N = n * NA
L.N(f"How many helium atoms are in {fmt(mg, 2)} g of helium? The molar mass of helium is {fmt(M, 3)} g/mol and N<sub>A</sub> = 6.022×10<sup>23</sup> mol<sup>−1</sup>.",
    N, "", [NA, N / 4, N * 4],
    f"First find the amount: n = m/M = {fmt(mg, 2)}/{fmt(M, 3)} = {fmt(n, 3)} mol. Then N = nN<sub>A</sub> = {{a}}. The value {fmt(NA)} is the number of atoms in one mole. Dividing or multiplying by the molar mass again gives wrong factors of 4.",
    D + "‘Moles and molecules’")

n, T, V = 2.00, 300.0, 0.0500
p = n * R * T / V
L.N(f"What is the pressure of {fmt(n, 3)} mol of an ideal gas at {fmt(T, 3)} K in a container of volume {fmt(V, 3)} m³? Use R = 8.314 J/(mol·K).",
    p, "Pa", [n * R * T / (V * 1000), n * R * (T - 273.15) / V, R * T / V],
    f"Rearrange pV = nRT: p = nRT/V = ({fmt(n, 3)})(8.314)({fmt(T, 3)})/{fmt(V, 3)} = {{a}}. Check the units: J/m³ = Pa. Using the volume in litres without conversion gives a value 1000 times too small, and using a Celsius temperature gives a much lower value. Leaving out n gives {fmt(R * T / V)} Pa.",
    D + "‘Toolkit 2: the ideal-gas equation’ and ‘Lecturer example: a helium tank’")

p1, V1, T1, V2, T2 = 1.00, 3.0, 300.0, 0.50, 450.0
p2 = p1 * V1 * T2 / (V2 * T1)
L.N(f"A fixed amount of ideal gas at {fmt(p1, 3)} atm, {fmt(V1, 2)} L and {fmt(T1, 3)} K is compressed to {fmt(V2, 2)} L and heated to {fmt(T2, 3)} K. What is its final pressure?",
    p2, "atm", [p1 * V1 / V2, p1 * V1 * T1 / (V2 * T2), p1 * V1 / V2 / 2],
    f"For a fixed amount of gas, p₁V₁/T₁ = p₂V₂/T₂, with absolute temperatures. So p₂ = p₁(V₁/V₂)(T₂/T₁) = ({fmt(p1, 3)})({fmt(V1, 2)}/{fmt(V2, 2)})({fmt(T2, 3)}/{fmt(T1, 3)}) = {{a}}. The ratio of volumes alone gives {fmt(p1 * V1 / V2)} atm, which ignores the heating. Inverting the temperature ratio gives {fmt(p1 * V1 * T1 / (V2 * T2))} atm.",
    D + "‘The ratio method for a change of state’ and ‘Lecturer example: compressing air in a pump’")

L.C("A sealed rigid container of gas is heated from 27 °C to 54 °C. By what factor does the pressure of the gas change?",
    "The pressure increases by only about 9 per cent.",
    ["The pressure doubles.", "The pressure increases by 27 per cent.", "The pressure does not change, because the volume is constant."],
    "At constant volume p is proportional to the absolute temperature. T₁ = 300 K and T₂ = 327 K, so p₂/p₁ = 327/300 = 1.09. The ratio of Celsius values, 54/27 = 2, is meaningless because the Celsius scale does not start at absolute zero.",
    D + "‘Concept check: a changing gas’ and ‘Toolkit 1: state variables and units’", "misconception")

L.C("On a pV diagram, a gas follows a path that is a vertical straight line, moving upward. What is constant during the process, and what happens to the temperature?",
    "The volume is constant, and the temperature increases.",
    ["The pressure is constant, and the temperature increases.", "The volume is constant, and the temperature decreases.", "The temperature is constant, and the volume increases."],
    "A vertical path means that V does not change while p increases. For a fixed amount of ideal gas, T = pV/(nR), so T increases in proportion to p. A horizontal path is constant pressure, and a hyperbola pV = constant is an isotherm.",
    D + "‘pV diagrams and isotherms’ and ‘Toolkit 4: reading pV and phase diagrams’", "graph")

L.C("On a pV diagram, state A is at (2p₀, V₀), state B is at (p₀, 2V₀) and state C is at (p₀, V₀). How do the temperatures of the three states compare, for the same amount of ideal gas?",
    "T<sub>A</sub> = T<sub>B</sub>, and both are greater than T<sub>C</sub>.",
    ["T<sub>A</sub> is greater than T<sub>B</sub>, which is greater than T<sub>C</sub>.", "T<sub>B</sub> is the greatest, because its volume is the largest.", "All three temperatures are equal."],
    "For a fixed amount of gas, T is proportional to pV. The products are pV = 2p₀V₀ for A, 2p₀V₀ for B and p₀V₀ for C. So A and B lie on the same isotherm, and C lies on a lower one.",
    D + "‘Lecturer example: which state is hottest?’ and ‘Three states: solution’", "graph")

m, c_ice, Ti, Tf = 0.100, 2100.0, -10.0, 30.0
Q1 = m * c_ice * (0 - Ti)
Q2 = m * Lf
Q3 = m * cw * (Tf - 0)
Q = Q1 + Q2 + Q3
L.N(f"How much heat is needed to take {fmt(m, 3)} kg of ice at {fmt(Ti, 3)} °C to liquid water at {fmt(Tf, 3)} °C at atmospheric pressure? Use c<sub>ice</sub> = 2100 J/(kg·K), c<sub>water</sub> = 4186 J/(kg·K) and L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
    Q, "J", [Q1 + Q3, Q2 + Q3, Q1 + m * Lv + Q3],
    f"Split the process into three steps. Warm the ice to 0 °C: {fmt(Q1)} J. Melt it at 0 °C: mL<sub>f</sub> = {fmt(Q2)} J. Warm the water to {fmt(Tf, 3)} °C: {fmt(Q3)} J. The total is {{a}}. Leaving out the melting step gives {fmt(Q1 + Q3)} J. The melting term is the largest, which is why the temperature stays at 0 °C while the ice melts.",
    D + "‘Toolkit 5: heating curves and latent heat’ and ‘Lecturer example: from ice to warm water’")

P, mi = 500.0, 0.200
t = mi * Lf / P
L.N(f"A heater supplies {fmt(P, 3)} W, all of which goes into melting {fmt(mi, 3)} kg of ice that is already at 0 °C. How long does the ice take to melt? Use L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
    t, "s", [mi * Lv / P, mi * Lf, P / (mi * Lf)],
    f"The energy needed is Q = mL<sub>f</sub> = ({fmt(mi, 3)})(3.34×10⁵) = {fmt(mi * Lf)} J. The heater supplies energy at the rate P, so t = Q/P = {{a}}. Using the heat of vaporisation, {fmt(mi * Lv / P)} s, answers a different question, and the value {fmt(mi * Lf)} is the energy in joules, not a time.",
    D + "‘Your turn: melting and boiling away’")

mi, mw, Tw = 0.050, 0.300, 40.0
Tf = (mw * cw * Tw - mi * Lf) / ((mi + mw) * cw)
L.N(f"{fmt(mi, 2)} kg of ice at 0 °C is added to {fmt(mw, 3)} kg of water at {fmt(Tw, 3)} °C in an insulated container. What is the final temperature once the ice has melted? Use c<sub>water</sub> = 4186 J/(kg·K) and L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
    Tf, "°C", [(mw * Tw) / (mi + mw) * 0 + (0 + Tw) / 2, (mw * cw * Tw) / ((mi + mw) * cw), (mw * cw * Tw - 2 * mi * Lf) / ((mi + mw) * cw)],
    f"The water gives up heat, which first melts the ice and then warms the melted ice from 0 °C: m<sub>w</sub>c<sub>w</sub>(T<sub>w</sub> − T<sub>f</sub>) = m<sub>i</sub>L<sub>f</sub> + m<sub>i</sub>c<sub>w</sub>(T<sub>f</sub> − 0). Solving gives T<sub>f</sub> = {{a}}. Check: the water has enough energy to melt all the ice, since {fmt(mw * cw * Tw)} J exceeds {fmt(mi * Lf)} J. Leaving out the latent heat gives {fmt((mw * cw * Tw) / ((mi + mw) * cw))} °C.",
    D + "‘Toolkit 6: calorimetry with a change of phase’ and ‘Ice added to water: solution’")

L.C("A solid, a liquid and a gas can all coexist in equilibrium at one point on a phase diagram of pressure against temperature. What is this point called?",
    "The triple point",
    ["The critical point", "The boiling point", "The freezing point at atmospheric pressure"],
    "The triple point is the single temperature and pressure at which all three phases of a substance coexist. The critical point is where the distinction between liquid and gas disappears, and it lies at the end of the liquid–vapour curve.",
    D + "‘The phase diagram: pressure against temperature’ and ‘Lecturer example: dry ice and the triple point’")

L.C("A sample of ice is heated steadily and a graph of its temperature against time has a flat section at 0 °C. Where does the energy go during the flat section?",
    "It changes the phase of the sample, increasing the potential energy of the molecules, while the temperature stays constant.",
    ["It is lost to the surroundings, so no heating occurs.", "It raises the temperature, but the thermometer is not sensitive enough to show it.", "It is stored as extra heat that is released when the ice cools."],
    "Adding heat does not always raise the temperature. During melting the energy is used to loosen the bonds between molecules, which raises their potential energy. The average kinetic energy per molecule, and hence the temperature, stays the same until all the ice has melted.",
    D + "‘What happens at a change of phase?’", "misconception")

L.C("Which of the following is an assumption of the kinetic model of an ideal gas?",
    "The molecules collide elastically with the walls and exert no forces on each other except during collisions.",
    ["The molecules attract each other strongly, so the gas can condense.", "The molecules lose kinetic energy on each collision with the walls.", "All the molecules move with exactly the same speed."],
    "The ideal-gas model treats molecules as point-like, with elastic collisions and negligible forces between them except at the moment of collision. The molecules have a distribution of speeds, and the gas keeps its energy because the wall collisions are elastic.",
    D + "‘The kinetic model of an ideal gas’")

T = 400.0
Kav = 1.5 * kB * T
L.N(f"What is the average translational kinetic energy of one molecule of an ideal gas at {fmt(T, 3)} K? Use k = 1.381×10<sup>−23</sup> J/K.",
    Kav, "J", [kB * T, 1.5 * kB * (T - 273.15), 1.5 * R * T],
    f"The average translational kinetic energy per molecule is ½mv²<sub>rms</sub> = (3/2)kT = (3/2)(1.381×10⁻²³)({fmt(T, 3)}) = {{a}}. The value {fmt(kB * T)} J leaves out the 3/2. Using R in place of k gives {fmt(1.5 * R * T)} J, which is the energy per mole, not per molecule.",
    D + "‘Temperature has a molecular meaning’ and ‘Toolkit 7: kinetic theory’")

Mo, T = 0.0320, 350.0
v = math.sqrt(3 * R * T / Mo)
L.N(f"What is the root-mean-square speed of oxygen molecules (molar mass {fmt(Mo * 1000, 3)} g/mol) at {fmt(T, 3)} K?",
    v, "m/s", [math.sqrt(3 * R * T / (Mo * 1000)), math.sqrt(R * T / Mo), math.sqrt(3 * R * (T - 273.15) / Mo)],
    f"v<sub>rms</sub> = √(3RT/M) = √(3(8.314)({fmt(T, 3)})/{fmt(Mo, 3)}) = {{a}}. The molar mass must be in kg/mol, which is {fmt(Mo, 3)} here. Using grams gives {fmt(math.sqrt(3 * R * T / (Mo * 1000)))} m/s, and leaving out the 3 gives {fmt(math.sqrt(R * T / Mo))} m/s.",
    D + "‘Lecturer example: nitrogen and helium at room temperature’ and ‘Toolkit 7: kinetic theory’")

L.C("A sample of helium gas and a sample of nitrogen gas are at the same temperature. Compare the average translational kinetic energy per molecule and the rms speed of the molecules.",
    "The average kinetic energies are equal, and the helium molecules have the greater rms speed.",
    ["The average kinetic energies are equal, and the speeds are equal.", "The nitrogen molecules have the greater average kinetic energy, because they are heavier.", "The helium molecules have the greater average kinetic energy, because they are faster."],
    "The average translational kinetic energy per molecule is (3/2)kT, which depends only on temperature. With equal kinetic energy, the lighter molecules must be faster, since v<sub>rms</sub> = √(3kT/m). Helium is lighter than nitrogen by a factor of 7, so its rms speed is about 2.6 times greater.",
    D + "‘Concept check: two gases at the same temperature’", "misconception")

T1, T2 = 300.0, 1200.0
L.N(f"The temperature of a gas rises from {fmt(T1, 3)} K to {fmt(T2, 3)} K. By what factor does the rms speed of its molecules change?",
    math.sqrt(T2 / T1), "", [T2 / T1, math.sqrt(math.sqrt(T2 / T1)), (T2 / T1) ** 2],
    f"Since v<sub>rms</sub> ∝ √T, the factor is √({fmt(T2, 3)}/{fmt(T1, 3)}) = √4 = {{a}}. The temperature ratio is {fmt(T2 / T1)}, so the kinetic energy increases by 4, but the speed only doubles.",
    D + "‘Why root-mean-square?’ and ‘Toolkit 7: kinetic theory’")

p, V, T = 1.01e5, 1.00, 300.0
Nm = p * V / (kB * T)
L.N(f"Roughly how many molecules are in {fmt(V, 3)} m³ of an ideal gas at a pressure of {fmt(p / 1e5, 3)}×10<sup>5</sup> Pa and a temperature of {fmt(T, 3)} K? Use pV = NkT with k = 1.381×10<sup>−23</sup> J/K.",
    Nm, "", [p * V / (R * T), p * V / (kB * (T - 273.15)), p * V / (kB * T) / 1000],
    f"N = pV/(kT) = ({fmt(p, 3)})({fmt(V, 3)})/((1.381×10⁻²³)({fmt(T, 3)})) = {{a}}. Dividing by R instead of k gives {fmt(p * V / (R * T))}, which is the number of moles, not the number of molecules.",
    D + "‘Moles and molecules’ and ‘Toolkit 2: the ideal-gas equation’")

p1, T1, T2 = 150.0, 290.0, 350.0
p2 = p1 * T2 / T1
L.N(f"A rigid flask of helium is at {fmt(p1, 3)} kPa and {fmt(T1, 3)} K. It is heated to {fmt(T2, 3)} K. What is the new pressure?",
    p2, "kPa", [p1 * T1 / T2, p1 * (T2 - 273.15) / (T1 - 273.15), p1],
    f"For a fixed amount of gas in a rigid container, V is constant, so p₂/p₁ = T₂/T₁. Then p₂ = ({fmt(p1, 3)})({fmt(T2, 3)}/{fmt(T1, 3)}) = {{a}}. Inverting the ratio gives a pressure that would fall on heating, and using Celsius temperatures gives a value that is far too large.",
    D + "‘Integrated problem: a heated flask of helium’ and ‘Integrated problem: lecturer solution’")

L.C("What causes the pressure that a gas exerts on the walls of its container?",
    "Molecules colliding with the walls, each collision changing the molecule’s momentum, so that the average force per unit area is the pressure.",
    ["Molecules repelling each other and pushing against the walls.", "The weight of the gas pressing on the walls.", "The molecules sticking to the walls and pulling on them."],
    "In the kinetic model, a molecule that rebounds elastically from a wall reverses its momentum component perpendicular to the wall. The wall exerts an impulse on the molecule, and the molecule exerts an equal and opposite impulse on the wall. The huge number of collisions per second gives a steady average force per unit area.",
    D + "‘An opening question: where does pressure come from?’ and ‘From one molecule to a pressure’", "misconception")

L.C("Equal masses of hydrogen gas (molar mass 2 g/mol) and oxygen gas (molar mass 32 g/mol) are at the same temperature. Which sample has the greater total translational kinetic energy?",
    "Hydrogen, because it contains 16 times as many molecules, each with the same average kinetic energy.",
    ["Oxygen, because its molecules are heavier.", "They are equal, because the masses are equal and the temperatures are equal.", "Oxygen, because its molecules move faster."],
    "At the same temperature each molecule has the same average translational kinetic energy, (3/2)kT. The total is N(3/2)kT. For equal masses the number of molecules is proportional to 1/M, so hydrogen has 32/2 = 16 times as many molecules, and so 16 times the total energy.",
    D + "‘Concept check: equal masses’", "misconception")
