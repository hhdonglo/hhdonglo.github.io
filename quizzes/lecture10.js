window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[10] = {
 "lecture": 10,
 "title": "Thermal properties of matter",
 "questions": [
  {
   "id": "L10-01",
   "type": "calc",
   "q": "How many helium atoms are in 8.0 g of helium? The molar mass of helium is 4.00 g/mol and N<sub>A</sub> = 6.022×10<sup>23</sup> mol<sup>−1</sup>.",
   "options": [
    "6.02×10<sup>23</sup>",
    "3.01×10<sup>23</sup>",
    "1.20×10<sup>24</sup>",
    "4.82×10<sup>24</sup>"
   ],
   "answer": 2,
   "exp": "First find the amount: n = m/M = 8.0/4.00 = 2.00 mol. Then N = nN<sub>A</sub> = 1.20×10<sup>24</sup>. The value 6.02×10<sup>23</sup> is the number of atoms in one mole. Dividing or multiplying by the molar mass again gives wrong factors of 4.",
   "ref": "Lecture 10 deck, slide ‘Moles and molecules’",
   "calc": {
    "value": 1.2044e+24,
    "unit": "",
    "sf": 3
   }
  },
  {
   "id": "L10-02",
   "type": "calc",
   "q": "What is the pressure of 2.00 mol of an ideal gas at 300 K in a container of volume 0.0500 m³? Use R = 8.314 J/(mol·K).",
   "options": [
    "99800 Pa",
    "99.8 Pa",
    "8930 Pa",
    "49900 Pa"
   ],
   "answer": 0,
   "exp": "Rearrange pV = nRT: p = nRT/V = (2.00)(8.314)(300)/0.0500 = 99800 Pa. Check the units: J/m³ = Pa. Using the volume in litres without conversion gives a value 1000 times too small, and using a Celsius temperature gives a much lower value. Leaving out n gives 49900 Pa.",
   "ref": "Lecture 10 deck, slide ‘Toolkit 2: the ideal-gas equation’ and ‘Lecturer example: a helium tank’",
   "calc": {
    "value": 99767.99999999999,
    "unit": "Pa",
    "sf": 3
   }
  },
  {
   "id": "L10-03",
   "type": "calc",
   "q": "A fixed amount of ideal gas at 1.00 atm, 3.0 L and 300 K is compressed to 0.50 L and heated to 450 K. What is its final pressure?",
   "options": [
    "6.00 atm",
    "4.00 atm",
    "3.00 atm",
    "9.00 atm"
   ],
   "answer": 3,
   "exp": "For a fixed amount of gas, p₁V₁/T₁ = p₂V₂/T₂, with absolute temperatures. So p₂ = p₁(V₁/V₂)(T₂/T₁) = (1.00)(3.0/0.50)(450/300) = 9.00 atm. The ratio of volumes alone gives 6.00 atm, which ignores the heating. Inverting the temperature ratio gives 4.00 atm.",
   "ref": "Lecture 10 deck, slide ‘The ratio method for a change of state’ and ‘Lecturer example: compressing air in a pump’",
   "calc": {
    "value": 9.0,
    "unit": "atm",
    "sf": 3
   }
  },
  {
   "id": "L10-04",
   "type": "misconception",
   "q": "A sealed rigid container of gas is heated from 27 °C to 54 °C. By what factor does the pressure of the gas change?",
   "options": [
    "The pressure doubles.",
    "The pressure increases by only about 9 per cent.",
    "The pressure increases by 27 per cent.",
    "The pressure does not change, because the volume is constant."
   ],
   "answer": 1,
   "exp": "At constant volume p is proportional to the absolute temperature. T₁ = 300 K and T₂ = 327 K, so p₂/p₁ = 327/300 = 1.09. The ratio of Celsius values, 54/27 = 2, is meaningless because the Celsius scale does not start at absolute zero.",
   "ref": "Lecture 10 deck, slide ‘Concept check: a changing gas’ and ‘Toolkit 1: state variables and units’"
  },
  {
   "id": "L10-05",
   "type": "graph",
   "q": "On a pV diagram, a gas follows a path that is a vertical straight line, moving upward. What is constant during the process, and what happens to the temperature?",
   "options": [
    "The pressure is constant, and the temperature increases.",
    "The volume is constant, and the temperature increases.",
    "The volume is constant, and the temperature decreases.",
    "The temperature is constant, and the volume increases."
   ],
   "answer": 1,
   "exp": "A vertical path means that V does not change while p increases. For a fixed amount of ideal gas, T = pV/(nR), so T increases in proportion to p. A horizontal path is constant pressure, and a hyperbola pV = constant is an isotherm.",
   "ref": "Lecture 10 deck, slide ‘pV diagrams and isotherms’ and ‘Toolkit 4: reading pV and phase diagrams’"
  },
  {
   "id": "L10-06",
   "type": "graph",
   "q": "On a pV diagram, state A is at (2p₀, V₀), state B is at (p₀, 2V₀) and state C is at (p₀, V₀). How do the temperatures of the three states compare, for the same amount of ideal gas?",
   "options": [
    "T<sub>A</sub> is greater than T<sub>B</sub>, which is greater than T<sub>C</sub>.",
    "T<sub>B</sub> is the greatest, because its volume is the largest.",
    "All three temperatures are equal.",
    "T<sub>A</sub> = T<sub>B</sub>, and both are greater than T<sub>C</sub>."
   ],
   "answer": 3,
   "exp": "For a fixed amount of gas, T is proportional to pV. The products are pV = 2p₀V₀ for A, 2p₀V₀ for B and p₀V₀ for C. So A and B lie on the same isotherm, and C lies on a lower one.",
   "ref": "Lecture 10 deck, slide ‘Lecturer example: which state is hottest?’ and ‘Three states: solution’"
  },
  {
   "id": "L10-07",
   "type": "calc",
   "q": "How much heat is needed to take 0.100 kg of ice at −10.0 °C to liquid water at 30.0 °C at atmospheric pressure? Use c<sub>ice</sub> = 2100 J/(kg·K), c<sub>water</sub> = 4186 J/(kg·K) and L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
   "options": [
    "48100 J",
    "14700 J",
    "46000 J",
    "2.40×10<sup>5</sup> J"
   ],
   "answer": 0,
   "exp": "Split the process into three steps. Warm the ice to 0 °C: 2100 J. Melt it at 0 °C: mL<sub>f</sub> = 33400 J. Warm the water to 30.0 °C: 12600 J. The total is 48100 J. Leaving out the melting step gives 14700 J. The melting term is the largest, which is why the temperature stays at 0 °C while the ice melts.",
   "ref": "Lecture 10 deck, slide ‘Toolkit 5: heating curves and latent heat’ and ‘Lecturer example: from ice to warm water’",
   "calc": {
    "value": 48058.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L10-08",
   "type": "calc",
   "q": "A heater supplies 500 W, all of which goes into melting 0.200 kg of ice that is already at 0 °C. How long does the ice take to melt? Use L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
   "options": [
    "902 s",
    "66800 s",
    "134 s",
    "0.00749 s"
   ],
   "answer": 2,
   "exp": "The energy needed is Q = mL<sub>f</sub> = (0.200)(3.34×10⁵) = 66800 J. The heater supplies energy at the rate P, so t = Q/P = 134 s. Using the heat of vaporisation, 902 s, answers a different question, and the value 66800 is the energy in joules, not a time.",
   "ref": "Lecture 10 deck, slide ‘Your turn: melting and boiling away’",
   "calc": {
    "value": 133.6,
    "unit": "s",
    "sf": 3
   }
  },
  {
   "id": "L10-09",
   "type": "calc",
   "q": "0.050 kg of ice at 0 °C is added to 0.300 kg of water at 40.0 °C in an insulated container. What is the final temperature once the ice has melted? Use c<sub>water</sub> = 4186 J/(kg·K) and L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg.",
   "options": [
    "20.0 °C",
    "34.3 °C",
    "22.9 °C",
    "11.5 °C"
   ],
   "answer": 2,
   "exp": "The water gives up heat, which first melts the ice and then warms the melted ice from 0 °C: m<sub>w</sub>c<sub>w</sub>(T<sub>w</sub> − T<sub>f</sub>) = m<sub>i</sub>L<sub>f</sub> + m<sub>i</sub>c<sub>w</sub>(T<sub>f</sub> − 0). Solving gives T<sub>f</sub> = 22.9 °C. Check: the water has enough energy to melt all the ice, since 50200 J exceeds 16700 J. Leaving out the latent heat gives 34.3 °C.",
   "ref": "Lecture 10 deck, slide ‘Toolkit 6: calorimetry with a change of phase’ and ‘Ice added to water: solution’",
   "calc": {
    "value": 22.88717493686438,
    "unit": "°C",
    "sf": 3
   }
  },
  {
   "id": "L10-10",
   "type": "concept",
   "q": "A solid, a liquid and a gas can all coexist in equilibrium at one point on a phase diagram of pressure against temperature. What is this point called?",
   "options": [
    "The triple point",
    "The critical point",
    "The boiling point",
    "The freezing point at atmospheric pressure"
   ],
   "answer": 0,
   "exp": "The triple point is the single temperature and pressure at which all three phases of a substance coexist. The critical point is where the distinction between liquid and gas disappears, and it lies at the end of the liquid–vapour curve.",
   "ref": "Lecture 10 deck, slide ‘The phase diagram: pressure against temperature’ and ‘Lecturer example: dry ice and the triple point’"
  },
  {
   "id": "L10-11",
   "type": "misconception",
   "q": "A sample of ice is heated steadily and a graph of its temperature against time has a flat section at 0 °C. Where does the energy go during the flat section?",
   "options": [
    "It is lost to the surroundings, so no heating occurs.",
    "It raises the temperature, but the thermometer is not sensitive enough to show it.",
    "It is stored as extra heat that is released when the ice cools.",
    "It changes the phase of the sample, increasing the potential energy of the molecules, while the temperature stays constant."
   ],
   "answer": 3,
   "exp": "Adding heat does not always raise the temperature. During melting the energy is used to loosen the bonds between molecules, which raises their potential energy. The average kinetic energy per molecule, and hence the temperature, stays the same until all the ice has melted.",
   "ref": "Lecture 10 deck, slide ‘What happens at a change of phase?’"
  },
  {
   "id": "L10-12",
   "type": "concept",
   "q": "Which of the following is an assumption of the kinetic model of an ideal gas?",
   "options": [
    "The molecules attract each other strongly, so the gas can condense.",
    "The molecules collide elastically with the walls and exert no forces on each other except during collisions.",
    "The molecules lose kinetic energy on each collision with the walls.",
    "All the molecules move with exactly the same speed."
   ],
   "answer": 1,
   "exp": "The ideal-gas model treats molecules as point-like, with elastic collisions and negligible forces between them except at the moment of collision. The molecules have a distribution of speeds, and the gas keeps its energy because the wall collisions are elastic.",
   "ref": "Lecture 10 deck, slide ‘The kinetic model of an ideal gas’"
  },
  {
   "id": "L10-13",
   "type": "calc",
   "q": "What is the average translational kinetic energy of one molecule of an ideal gas at 400 K? Use k = 1.381×10<sup>−23</sup> J/K.",
   "options": [
    "5.52×10<sup>−21</sup> J",
    "8.29×10<sup>−21</sup> J",
    "2.63×10<sup>−21</sup> J",
    "4990 J"
   ],
   "answer": 1,
   "exp": "The average translational kinetic energy per molecule is ½mv²<sub>rms</sub> = (3/2)kT = (3/2)(1.381×10⁻²³)(400) = 8.29×10<sup>−21</sup> J. The value 5.52×10<sup>−21</sup> J leaves out the 3/2. Using R in place of k gives 4990 J, which is the energy per mole, not per molecule.",
   "ref": "Lecture 10 deck, slide ‘Temperature has a molecular meaning’ and ‘Toolkit 7: kinetic theory’",
   "calc": {
    "value": 8.286e-21,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L10-14",
   "type": "calc",
   "q": "What is the root-mean-square speed of oxygen molecules (molar mass 32.0 g/mol) at 350 K?",
   "options": [
    "16.5 m/s",
    "302 m/s",
    "245 m/s",
    "522 m/s"
   ],
   "answer": 3,
   "exp": "v<sub>rms</sub> = √(3RT/M) = √(3(8.314)(350)/0.0320) = 522 m/s. The molar mass must be in kg/mol, which is 0.0320 here. Using grams gives 16.5 m/s, and leaving out the 3 gives 302 m/s.",
   "ref": "Lecture 10 deck, slide ‘Lecturer example: nitrogen and helium at room temperature’ and ‘Toolkit 7: kinetic theory’",
   "calc": {
    "value": 522.3055858403201,
    "unit": "m/s",
    "sf": 3
   }
  },
  {
   "id": "L10-15",
   "type": "misconception",
   "q": "A sample of helium gas and a sample of nitrogen gas are at the same temperature. Compare the average translational kinetic energy per molecule and the rms speed of the molecules.",
   "options": [
    "The average kinetic energies are equal, and the helium molecules have the greater rms speed.",
    "The average kinetic energies are equal, and the speeds are equal.",
    "The nitrogen molecules have the greater average kinetic energy, because they are heavier.",
    "The helium molecules have the greater average kinetic energy, because they are faster."
   ],
   "answer": 0,
   "exp": "The average translational kinetic energy per molecule is (3/2)kT, which depends only on temperature. With equal kinetic energy, the lighter molecules must be faster, since v<sub>rms</sub> = √(3kT/m). Helium is lighter than nitrogen by a factor of 7, so its rms speed is about 2.6 times greater.",
   "ref": "Lecture 10 deck, slide ‘Concept check: two gases at the same temperature’"
  },
  {
   "id": "L10-16",
   "type": "calc",
   "q": "The temperature of a gas rises from 300 K to 1200 K. By what factor does the rms speed of its molecules change?",
   "options": [
    "4.00",
    "1.41",
    "2.00",
    "16.0"
   ],
   "answer": 2,
   "exp": "Since v<sub>rms</sub> ∝ √T, the factor is √(1200/300) = √4 = 2.00. The temperature ratio is 4.00, so the kinetic energy increases by 4, but the speed only doubles.",
   "ref": "Lecture 10 deck, slide ‘Why root-mean-square?’ and ‘Toolkit 7: kinetic theory’",
   "calc": {
    "value": 2.0,
    "unit": "",
    "sf": 3
   }
  },
  {
   "id": "L10-17",
   "type": "calc",
   "q": "Roughly how many molecules are in 1.00 m³ of an ideal gas at a pressure of 1.01×10<sup>5</sup> Pa and a temperature of 300 K? Use pV = NkT with k = 1.381×10<sup>−23</sup> J/K.",
   "options": [
    "40.5",
    "2.72×10<sup>26</sup>",
    "2.44×10<sup>25</sup>",
    "2.44×10<sup>22</sup>"
   ],
   "answer": 2,
   "exp": "N = pV/(kT) = (1.01×10<sup>5</sup>)(1.00)/((1.381×10⁻²³)(300)) = 2.44×10<sup>25</sup>. Dividing by R instead of k gives 40.5, which is the number of moles, not the number of molecules.",
   "ref": "Lecture 10 deck, slide ‘Moles and molecules’ and ‘Toolkit 2: the ideal-gas equation’",
   "calc": {
    "value": 2.4378469707941107e+25,
    "unit": "",
    "sf": 3
   }
  },
  {
   "id": "L10-18",
   "type": "calc",
   "q": "A rigid flask of helium is at 150 kPa and 290 K. It is heated to 350 K. What is the new pressure?",
   "options": [
    "181 kPa",
    "124 kPa",
    "684 kPa",
    "150 kPa"
   ],
   "answer": 0,
   "exp": "For a fixed amount of gas in a rigid container, V is constant, so p₂/p₁ = T₂/T₁. Then p₂ = (150)(350/290) = 181 kPa. Inverting the ratio gives a pressure that would fall on heating, and using Celsius temperatures gives a value that is far too large.",
   "ref": "Lecture 10 deck, slide ‘Integrated problem: a heated flask of helium’ and ‘Integrated problem: lecturer solution’",
   "calc": {
    "value": 181.0344827586207,
    "unit": "kPa",
    "sf": 3
   }
  },
  {
   "id": "L10-19",
   "type": "misconception",
   "q": "What causes the pressure that a gas exerts on the walls of its container?",
   "options": [
    "Molecules repelling each other and pushing against the walls.",
    "The weight of the gas pressing on the walls.",
    "The molecules sticking to the walls and pulling on them.",
    "Molecules colliding with the walls, each collision changing the molecule’s momentum, so that the average force per unit area is the pressure."
   ],
   "answer": 3,
   "exp": "In the kinetic model, a molecule that rebounds elastically from a wall reverses its momentum component perpendicular to the wall. The wall exerts an impulse on the molecule, and the molecule exerts an equal and opposite impulse on the wall. The huge number of collisions per second gives a steady average force per unit area.",
   "ref": "Lecture 10 deck, slide ‘An opening question: where does pressure come from?’ and ‘From one molecule to a pressure’"
  },
  {
   "id": "L10-20",
   "type": "misconception",
   "q": "Equal masses of hydrogen gas (molar mass 2 g/mol) and oxygen gas (molar mass 32 g/mol) are at the same temperature. Which sample has the greater total translational kinetic energy?",
   "options": [
    "Oxygen, because its molecules are heavier.",
    "Hydrogen, because it contains 16 times as many molecules, each with the same average kinetic energy.",
    "They are equal, because the masses are equal and the temperatures are equal.",
    "Oxygen, because its molecules move faster."
   ],
   "answer": 1,
   "exp": "At the same temperature each molecule has the same average translational kinetic energy, (3/2)kT. The total is N(3/2)kT. For equal masses the number of molecules is proportional to 1/M, so hydrogen has 32/2 = 16 times as many molecules, and so 16 times the total energy.",
   "ref": "Lecture 10 deck, slide ‘Concept check: equal masses’"
  }
 ]
};
