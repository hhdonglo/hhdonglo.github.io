window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[11] = {
 "lecture": 11,
 "title": "First law of thermodynamics",
 "questions": [
  {
   "id": "L11-01",
   "type": "calc",
   "q": "A gas absorbs 500 J of heat and does 200 J of work on its surroundings. Using the convention ΔU = Q − W, what is the change in its internal energy?",
   "options": [
    "700 J",
    "−300 J",
    "300 J",
    "500 J"
   ],
   "answer": 2,
   "exp": "With heat entering the gas, Q = +500 J. With work done by the gas, W = +200 J. Then ΔU = Q − W = 300 J. Adding the two gives 700 J, which would be correct if the work were done on the gas. The sign convention must be read from the words: absorbed heat and work done by the gas.",
   "ref": "Lecture 11 deck, slide ‘Energy crossing the boundary: signs for Q and W’ and ‘Toolkit 1: system and sign convention’",
   "calc": {
    "value": 300.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-02",
   "type": "calc",
   "q": "A gas is compressed at a constant pressure of 2.0×10<sup>5</sup> Pa from 0.050 m³ to 0.030 m³. What is the work done by the gas?",
   "options": [
    "−4000 J",
    "4000 J",
    "6000 J",
    "10000 J"
   ],
   "answer": 0,
   "exp": "At constant pressure W = pΔV = (2.0×10⁵)(0.030 − 0.050) = −4000 J. The volume decreases, so the work done by the gas is negative. Equivalently, the surroundings do 4000 J of work on the gas. The values 6000 J and 10000 J use a single volume instead of the change.",
   "ref": "Lecture 11 deck, slide ‘Work done by a gas in a volume change’ and ‘Work is an area on the pV diagram’",
   "calc": {
    "value": -4000.000000000001,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-03",
   "type": "graph",
   "q": "On a pV diagram a gas expands along a straight line from p = 3.0×10<sup>5</sup> Pa, V = 2.0 L to p = 1.0×10<sup>5</sup> Pa, V = 6.0 L. What is the work done by the gas? (1 L = 10<sup>−3</sup> m³.)",
   "options": [
    "1200 J",
    "400 J",
    "1800 J",
    "800 J"
   ],
   "answer": 3,
   "exp": "The work is the area under the path. The area is a trapezoid: W = ½(p<sub>a</sub> + p<sub>b</sub>)ΔV = ½(3.0×10<sup>5</sup> + 1.0×10<sup>5</sup>)(0.0040×10⁻³) = 800 J, with the volume converted to m³. The value 1200 J is the larger rectangle under the starting pressure, and 400 J is the smaller one under the final pressure.",
   "ref": "Lecture 11 deck, slide ‘Toolkit 2: work from a pV diagram’ and ‘Lecturer example: a straight-line path’",
   "calc": {
    "value": 800.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-04",
   "type": "concept",
   "q": "A gas is taken from state A to state B along two different paths on a pV diagram. Which quantities have the same value for both paths?",
   "options": [
    "The heat Q only",
    "The change in internal energy ΔU only",
    "The work W only",
    "Q, W and ΔU, because the end states are the same"
   ],
   "answer": 1,
   "exp": "Internal energy is a state function, so ΔU depends only on the initial and final states. Heat and work are not state functions. They are energy transfers whose values depend on the path, which is why the area under the curve differs from one path to another.",
   "ref": "Lecture 11 deck, slide ‘The work depends on the path’ and ‘Same end points, four different works’"
  },
  {
   "id": "L11-05",
   "type": "calc",
   "q": "0.500 mol of an ideal gas at 300 K expands isothermally from 2.0 L to 6.0 L. How much work does the gas do?",
   "options": [
    "595 J",
    "1370 J",
    "3740 J",
    "2490 J"
   ],
   "answer": 1,
   "exp": "For an isothermal process W = nRT ln(V₂/V₁) = (0.500)(8.314)(300) ln(3.0) = 1370 J. The logarithm must be the natural logarithm. Using log₁₀ gives 595 J, and leaving out the logarithm gives 3740 J. Since ΔU = 0 for an ideal gas at constant T, the heat absorbed equals this work.",
   "ref": "Lecture 11 deck, slide ‘Isothermal work of an ideal gas’",
   "calc": {
    "value": 1370.0793851979995,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-06",
   "type": "calc",
   "q": "2.00 mol of a monatomic ideal gas is heated from 300 K to 400 K at constant pressure. How much heat is absorbed? Use R = 8.314 J/(mol·K).",
   "options": [
    "2490 J",
    "1660 J",
    "5820 J",
    "4160 J"
   ],
   "answer": 3,
   "exp": "At constant pressure Q = nC<sub>p</sub>ΔT. For a monatomic gas C<sub>V</sub> = (3/2)R and C<sub>p</sub> = C<sub>V</sub> + R = (5/2)R. So Q = (2.00)(2.5)(8.314)(100) = 4160 J. The value 2490 J is ΔU, which is less than Q because part of Q goes into the work 1660 J done by the expanding gas.",
   "ref": "Lecture 11 deck, slide ‘Heat capacities C<sub>V</sub> and C<sub>p</sub> of an ideal gas’ and ‘Toolkit 5: ideal-gas energy and heat capacities’",
   "calc": {
    "value": 4157.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-07",
   "type": "calc",
   "q": "1.50 mol of a diatomic ideal gas (C<sub>V</sub> = (5/2)R) is heated from 300 K to 340 K at constant volume. What is the change in its internal energy?",
   "options": [
    "1250 J",
    "1750 J",
    "499 J",
    "748 J"
   ],
   "answer": 0,
   "exp": "ΔU = nC<sub>V</sub>ΔT = (1.50)(2.5)(8.314)(40.0) = 1250 J. At constant volume the work is zero, so Q = ΔU. The value 1750 J uses C<sub>p</sub>. For an ideal gas ΔU = nC<sub>V</sub>ΔT holds for any process between these two temperatures.",
   "ref": "Lecture 11 deck, slide ‘Internal energy of an ideal gas’ and ‘Toolkit 5: ideal-gas energy and heat capacities’",
   "calc": {
    "value": 1247.1000000000001,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-08",
   "type": "misconception",
   "q": "An ideal gas expands adiabatically and does work on its surroundings. What happens to its temperature?",
   "options": [
    "It stays constant, because the gas is an ideal gas.",
    "It increases, because the gas does work.",
    "It decreases, because the work is done at the expense of the internal energy.",
    "It stays constant, because no heat enters the gas."
   ],
   "answer": 2,
   "exp": "For an adiabatic process Q = 0, so ΔU = −W. The gas does positive work, so ΔU is negative and, for an ideal gas, the temperature falls. An isothermal expansion needs heat to flow in so that the temperature stays constant, and an adiabatic one does not allow that.",
   "ref": "Lecture 11 deck, slide ‘Concept check: isothermal against adiabatic’ and ‘The adiabatic process’"
  },
  {
   "id": "L11-09",
   "type": "calc",
   "q": "Air at 290 K in a diesel engine cylinder is compressed adiabatically to 1/15 of its original volume. Treat the air as an ideal gas with γ = 1.40. What is the temperature at the end of the compression?",
   "options": [
    "4350 K",
    "290 K",
    "857 K",
    "1120 K"
   ],
   "answer": 2,
   "exp": "For an adiabatic process TV<sup>γ−1</sup> is constant, so T₂ = T₁(V₁/V₂)<sup>γ−1</sup> = (290)(15)<sup>0.40</sup> = 857 K. This is hot enough to ignite the injected fuel without a spark. Using T₂ = T₁ × 15 would be the result for a relation that does not apply, and T₂ = T₁ is the isothermal result.",
   "ref": "Lecture 11 deck, slide ‘Lecturer example: compression in a diesel engine’ and ‘Diesel compression: solution’",
   "calc": {
    "value": 856.7113123282053,
    "unit": "K",
    "sf": 3
   }
  },
  {
   "id": "L11-10",
   "type": "calc",
   "q": "A monatomic ideal gas (γ = 5/3) at 100 kPa is compressed adiabatically to half its volume. What is its final pressure?",
   "options": [
    "317 kPa",
    "200 kPa",
    "159 kPa",
    "264 kPa"
   ],
   "answer": 0,
   "exp": "For an adiabatic process pV<sup>γ</sup> is constant, so p₂ = p₁(V₁/V₂)<sup>γ</sup> = (100)(2)<sup>5/3</sup> = 317 kPa. An isothermal compression to half the volume would only double the pressure, to 200 kPa. The adiabatic pressure is greater because the temperature also rises.",
   "ref": "Lecture 11 deck, slide ‘Toolkit 6: adiabatic scaling’ and ‘Isotherm against adiabat’",
   "calc": {
    "value": 317.48021039363994,
    "unit": "kPa",
    "sf": 3
   }
  },
  {
   "id": "L11-11",
   "type": "calc",
   "q": "0.200 mol of a monatomic ideal gas expands adiabatically and its temperature falls from 400 K to 300 K. How much work does the gas do?",
   "options": [
    "−249 J",
    "416 J",
    "166 J",
    "249 J"
   ],
   "answer": 3,
   "exp": "With Q = 0, W = −ΔU = nC<sub>V</sub>(T₁ − T₂) = (0.200)(1.5)(8.314)(100) = 249 J. The work is positive because the gas does work and its internal energy falls. Using C<sub>p</sub> instead of C<sub>V</sub> gives 416 J, which is the heat needed at constant pressure.",
   "ref": "Lecture 11 deck, slide ‘Your turn: adiabatic expansion of argon’ and ‘Toolkit 5: ideal-gas energy and heat capacities’",
   "calc": {
    "value": 249.42000000000002,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-12",
   "type": "graph",
   "q": "A gas goes round a triangular cycle on a pV diagram in the clockwise direction. The triangle has a pressure range of 2.0×10<sup>5</sup> Pa (its height) and a volume range of 4.0 L (its base). What is the net work done by the gas in one cycle?",
   "options": [
    "800 J",
    "400 J",
    "−400 J",
    "0 J"
   ],
   "answer": 1,
   "exp": "The net work in a cycle is the area enclosed: ½(base)(height) = ½(0.0040 m³)(2.0×10<sup>5</sup> Pa) = 400 J. It is positive for a clockwise cycle, where the expansion occurs at a higher pressure than the compression. A counter-clockwise cycle would give the negative value. The net work is not zero even though ΔU = 0 for the full cycle, because the net heat equals the net work.",
   "ref": "Lecture 11 deck, slide ‘Cycles: net work is the enclosed area’ and ‘Your turn: a triangular cycle’",
   "calc": {
    "value": 400.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-13",
   "type": "calc",
   "q": "In one complete cycle a gas absorbs 600 J of heat and rejects 450 J of heat. What is the net work done by the gas in the cycle?",
   "options": [
    "1050 J",
    "150 J",
    "−150 J",
    "600 J"
   ],
   "answer": 1,
   "exp": "After a complete cycle the gas is back in its initial state, so ΔU = 0 and Q<sub>net</sub> = W<sub>net</sub>. The net heat is 600 − 450 = 150 J, so the work done by the gas is 150 J. The sign is positive, meaning the cycle acts as an engine.",
   "ref": "Lecture 11 deck, slide ‘Cyclic processes’ and ‘Your turn: a counter-clockwise cycle’",
   "calc": {
    "value": 150.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-14",
   "type": "calc",
   "q": "2.00 g of water at 100 °C boils at the constant pressure of 1.013×10<sup>5</sup> Pa. The volume increases from 2.0×10<sup>−6</sup> m³ to 3.40×10<sup>−3</sup> m³. The heat of vaporisation is 2.256×10<sup>6</sup> J/kg. What is the change in internal energy?",
   "options": [
    "4510 J",
    "4860 J",
    "344 J",
    "4170 J"
   ],
   "answer": 3,
   "exp": "The heat absorbed is Q = mL<sub>v</sub> = 4510 J. The work done in pushing the atmosphere back is W = pΔV = 344 J. Then ΔU = Q − W = 4170 J. Most of the energy increases the internal energy, by loosening the bonds between molecules, and a small fraction does work on the surroundings.",
   "ref": "Lecture 11 deck, slide ‘The first law and a change of phase’ and ‘Boiling water: solution’",
   "calc": {
    "value": 4167.7826000000005,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-15",
   "type": "graph",
   "q": "Starting from the same point on a pV diagram, an ideal gas expands to twice its volume once isothermally and once adiabatically. Which statement about the two curves is correct?",
   "options": [
    "The adiabatic curve falls more steeply, so it ends at a lower pressure and a lower temperature.",
    "The adiabatic curve falls less steeply, so it ends at a higher pressure.",
    "The two curves coincide, because both are expansions.",
    "The adiabatic curve is horizontal, because no heat is exchanged."
   ],
   "answer": 0,
   "exp": "On the isotherm pV is constant, while on the adiabat pV<sup>γ</sup> is constant with γ > 1. The adiabat therefore falls more steeply. During the adiabatic expansion the gas does work at the expense of its internal energy, so the temperature drops, while on the isotherm heat flows in to keep T constant.",
   "ref": "Lecture 11 deck, slide ‘Isotherm against adiabat’ and ‘Concept check: compression to half the volume’"
  },
  {
   "id": "L11-16",
   "type": "calc",
   "q": "What is the molar heat capacity at constant pressure, C<sub>p</sub>, of a diatomic ideal gas whose molecules can rotate but do not vibrate? Use R = 8.314 J/(mol·K).",
   "options": [
    "20.8 J/(mol·K)",
    "8.31 J/(mol·K)",
    "29.1 J/(mol·K)",
    "37.4 J/(mol·K)"
   ],
   "answer": 2,
   "exp": "Such a molecule has f = 5 degrees of freedom (three translational and two rotational), so C<sub>V</sub> = (f/2)R = (5/2)R. Then C<sub>p</sub> = C<sub>V</sub> + R = (7/2)R = 29.1 J/(mol·K). The value (5/2)R = 20.8 J/(mol·K) is C<sub>V</sub>, and R by itself is the difference C<sub>p</sub> − C<sub>V</sub>.",
   "ref": "Lecture 11 deck, slide ‘Equipartition and degrees of freedom’ and ‘Toolkit 5: ideal-gas energy and heat capacities’",
   "calc": {
    "value": 29.099,
    "unit": "J/(mol·K)",
    "sf": 3
   }
  },
  {
   "id": "L11-17",
   "type": "calc",
   "q": "0.250 mol of an ideal gas at 320 K is compressed isothermally to one fifth of its original volume. How much heat flows into the gas? A negative answer means heat flows out.",
   "options": [
    "1070 J",
    "0 J",
    "−1070 J",
    "−465 J"
   ],
   "answer": 2,
   "exp": "For an isothermal process ΔU = 0, so Q = W = nRT ln(V₂/V₁) = (0.250)(8.314)(320) ln(1/5.0) = −1070 J. The work done by the gas is negative because it is compressed, so the heat flows out of the gas to the surroundings. The value 0 J would be the heat for an adiabatic process, where the temperature would rise.",
   "ref": "Lecture 11 deck, slide ‘Your turn: an isothermal compression’ and ‘Toolkit 4: recognising the process’",
   "calc": {
    "value": -1070.4693443181689,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-18",
   "type": "concept",
   "q": "A gas in a perfectly insulated cylinder is compressed quickly by a piston. Which statement is correct?",
   "options": [
    "Q = 0, the work done by the gas is negative, and the internal energy and temperature of the gas rise.",
    "Q = 0, the work done by the gas is positive, and the temperature falls.",
    "ΔU = 0, because the cylinder is insulated.",
    "Heat flows out of the gas, so the temperature falls."
   ],
   "answer": 0,
   "exp": "The insulation makes the process adiabatic, Q = 0, so ΔU = −W. The piston does work on the gas, so W is negative and ΔU is positive. The extra energy raises the molecules’ kinetic energy, and the temperature increases. This is the principle of a diesel engine and of a bicycle pump warming up.",
   "ref": "Lecture 11 deck, slide ‘Concept check: isothermal against adiabatic’ and ‘Link to Lecture 10: the pump’"
  },
  {
   "id": "L11-19",
   "type": "calc",
   "q": "In one step of a process, a gas gives out 80.0 J of heat, so Q = −80.0 J, and its internal energy falls by 200 J. What is the work done by the gas in this step?",
   "options": [
    "−120 J",
    "−280 J",
    "280 J",
    "120 J"
   ],
   "answer": 3,
   "exp": "Rearrange the first law, ΔU = Q − W, to W = Q − ΔU = (−80.0) − (−200) = 120 J. The work is positive, so the gas does work on its surroundings. The energy for it comes from the internal energy, 200 J, minus the 80.0 J that was lost as heat. The sum Q + ΔU = −280 J does not follow from the first law.",
   "ref": "Lecture 11 deck, slide ‘Toolkit 3: the energy ledger’ and ‘Integrated problem: the ledger’",
   "calc": {
    "value": 120.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L11-20",
   "type": "calc",
   "q": "A monatomic ideal gas has C<sub>V</sub> = (3/2)R. What is the ratio γ = C<sub>p</sub>/C<sub>V</sub>?",
   "options": [
    "1.40",
    "1.67",
    "0.600",
    "2.50"
   ],
   "answer": 1,
   "exp": "For an ideal gas C<sub>p</sub> = C<sub>V</sub> + R, so γ = (5/2)R/(3/2)R = 5/3 = 1.67. The value 1.40 is for a diatomic gas, γ = 7/5. The ratio C<sub>p</sub>/C<sub>V</sub> is always greater than 1, so the inverse 0.600 cannot be correct. The ratio γ sets the exponent in the adiabatic relations pV<sup>γ</sup> = constant and TV<sup>γ−1</sup> = constant.",
   "ref": "Lecture 11 deck, slide ‘Heat capacities C<sub>V</sub> and C<sub>p</sub> of an ideal gas’ and ‘Measured molar heat capacities’",
   "calc": {
    "value": 1.6666666666666667,
    "unit": "",
    "sf": 3
   }
  }
 ]
};
