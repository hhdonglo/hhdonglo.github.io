import math
from common import Lecture, fmt, val

L = Lecture(12, "Second law of thermodynamics")
D = "Lecture 12 deck, slide "
R = 8.314
Lf = 3.34e5

L.C("Which of the following is an irreversible process?",
    "A cup of hot coffee cooling to room temperature",
    ["A frictionless pendulum swinging in a vacuum", "An ideal spring oscillating without damping", "A gas expanding very slowly while staying in equilibrium with its surroundings"],
    "A process is irreversible if it cannot be undone without leaving a change in the surroundings. Heat flowing across a finite temperature difference, as in the coffee, is a standard example. The other three are idealised as reversible, and each one would look possible if the film were run backwards.",
    D + "‘Reversible and irreversible processes’ and ‘Toolkit 1: reversible or irreversible?’")

m = 0.200
Q = m * Lf
T = 273.15
L.N(f"{fmt(m, 3)} kg of ice melts completely at 0 °C (273.15 K). The latent heat of fusion is 3.34×10<sup>5</sup> J/kg. What is the entropy change of the ice, now water?",
    Q / T, "J/K", [Lf / T, Q, -Q / T],
    f"The melting occurs at constant temperature, so ΔS = Q/T = mL<sub>f</sub>/T = ({fmt(m, 3)})(3.34×10⁵)/273.15 = {{a}}. The value is positive because the molecules have more ways to be arranged in the liquid. Leaving out the mass gives {fmt(Lf / T)} J/K, and the heat Q = {fmt(Q)} J is not an entropy.",
    D + "‘The entropy rule’ and ‘Lecturer example: melting ice’")

Q, Th, Tc = 1000.0, 400.0, 300.0
dS = Q / Tc - Q / Th
L.N(f"A heat flow of {fmt(Q, 4)} J passes directly from a large reservoir at {fmt(Th, 3)} K to a large reservoir at {fmt(Tc, 3)} K. What is the total entropy change of the two reservoirs?",
    dS, "J/K", [0, -dS, Q / Tc + Q / Th],
    f"The hot reservoir loses entropy: ΔS<sub>H</sub> = −{fmt(Q, 4)}/{fmt(Th, 3)} = {fmt(-Q / Th)} J/K. The cold reservoir gains ΔS<sub>C</sub> = +{fmt(Q, 4)}/{fmt(Tc, 3)} = {fmt(Q / Tc)} J/K. The total is {{a}}. It is positive, which is why heat flows spontaneously from hot to cold and never the other way. A zero would mean a reversible process.",
    D + "‘System plus surroundings: the total’ and ‘Lecturer example: heat flows from hot to cold’")

L.C("Water freezes in a freezer, so the entropy of the water decreases. Does this violate the second law of thermodynamics?",
    "No. The entropy of the water decreases, but the entropy of the surroundings increases by more, so the total increases.",
    ["Yes. The entropy of any system can never decrease.", "No. The entropy of the water does not change when it freezes.", "Yes, unless the freezer is perfectly insulated."],
    "The second law applies to the total entropy of the system plus its surroundings. The freezer rejects more than enough heat to the room, whose entropy rises by more than the water’s falls. The entropy of a part of the universe can decrease so long as the total does not.",
    D + "‘System plus surroundings: the total’ and ‘Toolkit 3: entropy bookkeeping’", "misconception")

n = 1.00
dS = n * R * math.log(2)
L.N(f"{fmt(n, 3)} mol of an ideal gas expands freely, with no heat exchanged and no work done, into a vacuum until its volume has doubled. What is the entropy change of the gas? Use R = 8.314 J/(mol·K).",
    dS, "J/K", [0, R, n * R * math.log10(2)],
    f"Entropy is a state function, so ΔS can be found along any reversible path joining the same states. An isothermal reversible expansion gives ΔS = nR ln(V₂/V₁) = ({fmt(n, 3)})(8.314) ln 2 = {{a}}. It is not zero just because Q = 0 in the free expansion, because the free expansion is irreversible and Q/T applies only along a reversible path.",
    D + "‘Lecturer example: expansion, reversible or free’ and ‘Expansion: solution’")

Qh, Qc = 800.0, 500.0
e = (Qh - Qc) / Qh
L.N(f"A heat engine takes {fmt(Qh, 3)} J from a hot reservoir and rejects {fmt(Qc, 3)} J to a cold reservoir in each cycle. What is its thermal efficiency?",
    e * 100, "%", [Qc / Qh * 100, Qh / Qc * 100, (Qh - Qc) / Qc * 100],
    f"The work per cycle is W = Q<sub>H</sub> − Q<sub>C</sub> = {fmt(Qh - Qc)} J. The efficiency is e = W/Q<sub>H</sub> = {fmt(Qh - Qc)}/{fmt(Qh, 3)} = {{a}}. The value {fmt(Qc / Qh * 100)}% is the fraction of the heat that is wasted. An efficiency above 100%, such as {fmt(Qh / Qc * 100)}%, is impossible for an engine.",
    D + "‘The heat engine’ and ‘Toolkit 4: energy flow in an engine’")

eff, Pe = 0.35, 700.0
Qhs = Pe / eff
Qcs = Qhs - Pe
L.N(f"A power station has a thermal efficiency of {fmt(eff * 100, 2)}% and produces {fmt(Pe, 3)} MW of electrical power. At what rate does it reject heat to the environment?",
    Qcs, "MW", [Qhs, Pe, eff * Pe],
    f"The rate of heat input is Q<sub>H</sub> = P/e = {fmt(Pe, 3)}/{fmt(eff, 2)} = {fmt(Qhs)} MW. Energy is conserved, so the rejected heat is Q<sub>C</sub> = Q<sub>H</sub> − P = {{a}}. Most of the energy input is wasted, and it must go somewhere, usually into cooling water or the air.",
    D + "‘Your turn: a power station’")

r, gam = 9.0, 1.40
eo = 1 - r ** (1 - gam)
L.N(f"What is the ideal efficiency of an Otto cycle with a compression ratio r = {fmt(r, 2)}, for air with γ = {fmt(gam, 3)}? Give the answer as a percentage.",
    eo * 100, "%", [r ** (1 - gam) * 100, (1 - 1 / r) * 100, 100 / r],
    f"The Otto efficiency is e = 1 − 1/r<sup>γ−1</sup> = 1 − 1/({fmt(r, 2)})<sup>0.40</sup> = {{a}}. The value {fmt(r ** (1 - gam) * 100)}% is the fraction of heat rejected. The expression 1 − 1/r gives {fmt((1 - 1 / r) * 100)}%, which overstates the efficiency because it leaves out the exponent γ − 1.",
    D + "‘Otto cycle: the efficiency’ and ‘Lecturer example: an Otto engine’")

L.C("In an ideal Otto cycle with γ fixed, what happens to the efficiency when the compression ratio is increased?",
    "The efficiency increases, because e = 1 − 1/r<sup>γ−1</sup> increases with r.",
    ["The efficiency decreases, because the gas must do more work on the piston.", "The efficiency does not change, because it depends only on the temperatures.", "The efficiency increases until it reaches exactly 100%."],
    "The efficiency e = 1 − r<sup>1−γ</sup> rises as r increases, but it never reaches 100%. Real engines are limited by the knocking of petrol engines and by the strength and friction of the cylinder, which is why diesel engines, with large compression ratios, are more efficient.",
    D + "‘Concept check: the compression ratio’")

Qc_, Wc = 600.0, 150.0
K = Qc_ / Wc
L.N(f"A refrigerator removes {fmt(Qc_, 3)} J of heat from its interior in each cycle, using {fmt(Wc, 3)} J of electrical work. What is its coefficient of performance?",
    K, "", [Wc / Qc_, (Qc_ + Wc) / Wc, Qc_ / (Qc_ + Wc)],
    f"For a refrigerator K = Q<sub>C</sub>/|W| = {fmt(Qc_, 3)}/{fmt(Wc, 3)} = {{a}}. It is useful to have a value above 1: more heat is removed than the work supplied. The value {fmt((Qc_ + Wc) / Wc)} is Q<sub>H</sub>/|W|, which is the figure for a heat pump, and {fmt(Qc_ / (Qc_ + Wc))} is Q<sub>C</sub>/Q<sub>H</sub>.",
    D + "‘Toolkit 6: refrigerators and heat pumps’ and ‘Lecturer example: a refrigerator’")

Kac, Pel = 3.5, 1.2
Qr = Kac * Pel
L.N(f"An air conditioner has a coefficient of performance of {fmt(Kac, 2)} and uses {fmt(Pel, 2)} kW of electrical power. At what rate does it discharge heat to the outside air?",
    Qr + Pel, "kW", [Qr, Pel, 2 * Qr],
    f"The rate of heat removal from the room is Q<sub>C</sub> = KP = ({fmt(Kac, 2)})({fmt(Pel, 2)}) = {fmt(Qr)} kW. The heat discharged outside is Q<sub>H</sub> = Q<sub>C</sub> + P = {{a}}. The discharge is larger than the heat removed, because the electrical work also ends up as heat outdoors.",
    D + "‘Your turn: an air conditioner’")

L.C("A refrigerator is running with its door left open in a closed, insulated room. What happens to the temperature of the room?",
    "The room becomes warmer, because the electrical work done by the compressor ends up as heat in the room.",
    ["The room becomes cooler, because the refrigerator removes heat from the air.", "The temperature of the room stays the same, because the refrigerator only moves heat.", "The room becomes cooler at first and then returns to its original temperature."],
    "The refrigerator removes heat Q<sub>C</sub> from one part of the room and discharges Q<sub>H</sub> = Q<sub>C</sub> + |W| into another part of the same room. The net effect on the room is the addition of the work |W|, so the room warms.",
    D + "‘Concept check: the open refrigerator door’", "misconception")

L.C("Which of the following devices is forbidden by the second law of thermodynamics?",
    "A cyclic engine that takes heat from a single reservoir and converts all of it into work",
    ["A cyclic engine that takes heat from a hot reservoir, does work and rejects some heat to a cold reservoir", "A refrigerator that uses electrical work to move heat from a cold interior to a warm room", "A machine that converts all of its input work into heat"],
    "The engine statement of the second law says that no cyclic engine can convert heat completely into work, so some heat must be rejected to a colder reservoir. The other three are allowed. Converting work completely into heat, as friction does, is possible, but the reverse is not.",
    D + "‘The second law: three statements’ and ‘The two forbidden devices’")

Th, Tc = 500.0, 320.0
ec = 1 - Tc / Th
L.N(f"What is the maximum possible efficiency of any heat engine operating between reservoirs at {fmt(Th, 3)} K and {fmt(Tc, 3)} K? Give the answer as a percentage.",
    ec * 100, "%", [Tc / Th * 100, (Th - Tc) / Tc * 100, (1 - (Tc - 273.15) / (Th - 273.15)) * 100],
    f"The Carnot efficiency is e = 1 − T<sub>C</sub>/T<sub>H</sub>, with temperatures in kelvin. Here e = 1 − {fmt(Tc, 3)}/{fmt(Th, 3)} = {{a}}. The value {fmt(Tc / Th * 100)}% is T<sub>C</sub>/T<sub>H</sub>, the fraction that must be rejected. Using Celsius temperatures gives {fmt((1 - (Tc - 273.15) / (Th - 273.15)) * 100)}%, which is wrong because the formula needs absolute temperatures.",
    D + "‘The Carnot cycle: the efficiency’ and ‘Toolkit 7: the Carnot limit’")

Th, Tc, Qh = 700.0, 300.0, 1200.0
Wm = (1 - Tc / Th) * Qh
L.N(f"A Carnot engine operates between {fmt(Th, 3)} K and {fmt(Tc, 3)} K and absorbs {fmt(Qh, 4)} J from the hot reservoir in each cycle. How much work does it do per cycle?",
    Wm, "J", [Qh * Tc / Th, Qh, Qh * (Th - Tc) / Th * Tc / Th * 2],
    f"The efficiency is e = 1 − T<sub>C</sub>/T<sub>H</sub> = 1 − {fmt(Tc, 3)}/{fmt(Th, 3)} = {fmt(1 - Tc / Th)}. The work is W = eQ<sub>H</sub> = {{a}}. The value {fmt(Qh * Tc / Th)} J is the heat rejected, Q<sub>C</sub> = Q<sub>H</sub> − W, and {fmt(Qh)} J would be the result for an engine with no heat rejected.",
    D + "‘Lecturer example: limits in practice’ and ‘Toolkit 7: the Carnot limit’")

L.C("An inventor claims an engine that operates between reservoirs at 500 K and 300 K, absorbs 1000 J of heat per cycle and delivers 450 J of work per cycle. Is the claim possible?",
    "No. The Carnot limit for these temperatures is 40%, which allows at most 400 J of work, so 450 J is impossible.",
    ["Yes. The efficiency is 45%, which is less than 100%, so it is allowed.", "Yes. The efficiency is 45%, which is more than the 40% of a Carnot engine, so it is better than a Carnot engine and therefore allowed.", "It cannot be decided without knowing the working substance."],
    "The best efficiency possible between 500 K and 300 K is 1 − 300/500 = 0.40. The claimed efficiency, 450/1000 = 0.45, exceeds it. No engine can do better than a Carnot engine operating between the same reservoirs. The claim would also give a negative total entropy change.",
    D + "‘Lecturer example: an inventor’s claim’ and ‘Your turn: allowed or not?’")

L.C("A Carnot engine operates between 600 K and 300 K. Which change would increase its efficiency more: raising the hot reservoir by 50 K, or lowering the cold reservoir by 50 K?",
    "Lowering the cold reservoir by 50 K, because the efficiency is then 1 − 250/600 = 58%, compared with 1 − 300/650 = 54%.",
    ["Raising the hot reservoir by 50 K, because 650 K is a large temperature.", "Both changes give the same improvement, because the temperature difference changes by 50 K in each case.", "Neither, because the efficiency is fixed by the working substance."],
    "The efficiency is e = 1 − T<sub>C</sub>/T<sub>H</sub>. Lowering T<sub>C</sub> by 50 K gives e = 0.583. Raising T<sub>H</sub> by 50 K gives e = 0.538. Both changes alter the temperature difference by 50 K, but the efficiency depends on the ratio T<sub>C</sub>/T<sub>H</sub>. Since T<sub>C</sub> is smaller than T<sub>H</sub>, a 50 K change in T<sub>C</sub> alters the ratio more than the same change in T<sub>H</sub>.",
    D + "‘Concept check: where to improve a Carnot engine’")

Qh, Qc, Th, Tc = 800.0, 500.0, 600.0, 300.0
dS = Qc / Tc - Qh / Th
L.N(f"In each cycle an engine takes {fmt(Qh, 3)} J from a reservoir at {fmt(Th, 3)} K and rejects {fmt(Qc, 3)} J to a reservoir at {fmt(Tc, 3)} K. What is the total entropy change of the two reservoirs per cycle?",
    dS, "J/K", [Qc / Tc + Qh / Th, -dS, 0],
    f"The hot reservoir loses {fmt(Qh, 3)}/{fmt(Th, 3)} = {fmt(Qh / Th)} J/K and the cold reservoir gains {fmt(Qc, 3)}/{fmt(Tc, 3)} = {fmt(Qc / Tc)} J/K. The total is {{a}}. The engine returns to its initial state each cycle, so only the reservoirs change. A positive total means the engine is allowed. Reversible Carnot operation would give zero, and a negative total would be impossible.",
    D + "‘Entropy and the Carnot limit’")

Th, Tc, Qout = 450.0, 300.0, 210.0
Wd, Qh = 90.0, 300.0
eact = Wd / Qh
ecar = 1 - Tc / Th
L.N(f"An engine operates between {fmt(Th, 3)} K and {fmt(Tc, 3)} K. In each cycle it does {fmt(Wd, 3)} J of work and rejects {fmt(Qout, 3)} J of heat. What fraction of the Carnot efficiency does it achieve?",
    eact / ecar, "", [eact, ecar, ecar / eact],
    f"The heat absorbed is Q<sub>H</sub> = W + Q<sub>C</sub> = {fmt(Wd, 3)} + {fmt(Qout, 3)} = {fmt(Qh, 3)} J, so e = {fmt(Wd, 3)}/{fmt(Qh, 3)} = {fmt(eact)}. The Carnot limit is 1 − {fmt(Tc, 3)}/{fmt(Th, 3)} = {fmt(ecar)}. The ratio is e/e<sub>Carnot</sub> = {{a}}. The engine is allowed, since the ratio is below 1, and it is close to the best possible performance. A ratio above 1 would be impossible.",
    D + "‘Integrated problem: decide what physics applies’ and ‘Integrated problem: lecturer solution’")

Th, Tc = 295.0, 255.0
Kmax = Tc / (Th - Tc)
L.N(f"A freezer at {fmt(Tc, 3)} K is in a room at {fmt(Th, 3)} K. What is the largest possible coefficient of performance of any refrigerator working between these temperatures?",
    Kmax, "", [(Th - Tc) / Tc, Th / (Th - Tc), Th / Tc],
    f"The best refrigerator is a reversed Carnot engine, for which K<sub>max</sub> = T<sub>C</sub>/(T<sub>H</sub> − T<sub>C</sub>) = {fmt(Tc, 3)}/({fmt(Th, 3)} − {fmt(Tc, 3)}) = {{a}}. The value {fmt(Th / (Th - Tc))} is T<sub>H</sub>/(T<sub>H</sub> − T<sub>C</sub>), the limit for a heat pump. A smaller temperature difference allows a much larger coefficient of performance.",
    D + "‘Toolkit 6: refrigerators and heat pumps’ and ‘Extension (unassessed): the heat pump’")
