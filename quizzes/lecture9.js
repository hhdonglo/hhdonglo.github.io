window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[9] = {
 "lecture": 9,
 "title": "Temperature and heat",
 "questions": [
  {
   "id": "L9-01",
   "type": "misconception",
   "q": "Which statement about heat is correct?",
   "options": [
    "Heat is the temperature of an object.",
    "Heat is the thermal energy stored inside an object.",
    "Heat is energy that is transferred between objects because of a temperature difference.",
    "Heat is a substance that flows from a hotter object into a colder one and is conserved."
   ],
   "answer": 2,
   "exp": "Heat is energy in transit, Q, not a property that an object contains. Temperature is a property of the state of an object. Energy stored in the molecules is internal energy. Once the energy has been transferred it is no longer called heat.",
   "ref": "Lecture 9 deck, slide ‘Temperature is not heat’ and ‘Systems and states’"
  },
  {
   "id": "L9-02",
   "type": "concept",
   "q": "Object A and object B are each in thermal equilibrium with object C, but A and B are not in contact. What does the zeroth law of thermodynamics say about A and B?",
   "options": [
    "A and B are in thermal equilibrium with each other, so they have the same temperature.",
    "A and B must have different temperatures, because they are separate objects.",
    "Nothing can be said until A and B are placed in contact.",
    "A and B must contain equal amounts of heat."
   ],
   "answer": 0,
   "exp": "The zeroth law says that if two systems are each in thermal equilibrium with a third, they are in thermal equilibrium with each other. This is what makes temperature a well-defined property and a thermometer, the third system, meaningful.",
   "ref": "Lecture 9 deck, slide ‘The zeroth law’"
  },
  {
   "id": "L9-03",
   "type": "calc",
   "q": "A recipe gives an oven temperature of 350 °F. What is this temperature on the Celsius scale?",
   "options": [
    "318 °C",
    "194 °C",
    "662 °C",
    "177 °C"
   ],
   "answer": 3,
   "exp": "T<sub>C</sub> = (5/9)(T<sub>F</sub> − 32) = (5/9)(350 − 32) = 177 °C. Subtracting 32 only, or multiplying by 5/9 only, skips one step of the conversion. The value 662 converts in the wrong direction.",
   "ref": "Lecture 9 deck, slide ‘Temperature scales’ and ‘Toolkit 1: temperature scales and conversions’",
   "calc": {
    "value": 176.66666666666666,
    "unit": "°C",
    "sf": 3
   }
  },
  {
   "id": "L9-04",
   "type": "calc",
   "q": "On a very cold day the temperature is −40 °C. What is this temperature in kelvin? Use T = T<sub>C</sub> + 273.15 and give the answer to three significant figures.",
   "options": [
    "313 K",
    "233 K",
    "273 K",
    "40.0 K"
   ],
   "answer": 1,
   "exp": "T = T<sub>C</sub> + 273.15 = (−40) + 273.15 = 233 K. Kelvin temperatures are measured from absolute zero, so they are never negative. Adding 40 instead of subtracting it, or ignoring the Celsius value, gives wrong answers.",
   "ref": "Lecture 9 deck, slide ‘Temperature scales’",
   "calc": {
    "value": 233.14999999999998,
    "unit": "K",
    "sf": 3
   }
  },
  {
   "id": "L9-05",
   "type": "calc",
   "q": "An aluminium rod is 2.50 m long at a certain temperature. Its coefficient of linear expansion is 2.4×10<sup>−5</sup> K<sup>−1</sup>. By how much does it lengthen when its temperature rises by 80 K? Give the answer in millimetres.",
   "options": [
    "9.60 mm",
    "4.80 mm",
    "2.40 mm",
    "48.0 mm"
   ],
   "answer": 1,
   "exp": "ΔL = αL₀ΔT = (2.4×10<sup>−5</sup> K⁻¹)(2.50 m)(80 K) = 0.00480 m = 4.80 mm. Check the size: ΔL/L₀ = 0.0019, a small fraction, as expected. Using 2α gives the area coefficient, and the other wrong values come from slips in the power of ten or in the factor.",
   "ref": "Lecture 9 deck, slide ‘Thermal expansion’ and ‘Toolkit 2: thermal expansion’",
   "calc": {
    "value": 4.800000000000001,
    "unit": "mm",
    "sf": 3
   }
  },
  {
   "id": "L9-06",
   "type": "calc",
   "q": "A steel rail cannot expand because it is fixed rigidly at both ends. It is heated by 30 K. The coefficient of linear expansion is 1.2×10<sup>−5</sup> K<sup>−1</sup> and Young’s modulus is 2.0×10<sup>11</sup> Pa. What is the thermal stress in the rail, in megapascals?",
   "options": [
    "720 MPa",
    "7.20 MPa",
    "2.40 MPa",
    "72.0 MPa"
   ],
   "answer": 3,
   "exp": "If the expansion is prevented, the stress is F/A = Yα ΔT = (2.0×10¹¹)(1.2×10⁻⁵)(30) = 7.20×10<sup>7</sup> Pa = 72.0 MPa. This is why rails are laid with gaps or with allowance for expansion. Slips in the power of ten, or leaving out ΔT, give the other values.",
   "ref": "Lecture 9 deck, slide ‘Toolkit 2: thermal expansion’ and ‘Lecturer example: a steel rail’",
   "calc": {
    "value": 72.0,
    "unit": "MPa",
    "sf": 3
   }
  },
  {
   "id": "L9-07",
   "type": "misconception",
   "q": "A flat steel washer has a circular hole in its centre. The washer is heated uniformly. What happens to the diameter of the hole?",
   "options": [
    "It increases, as if the hole were a disc made of the same material.",
    "It decreases, because the metal expands into the hole.",
    "It stays the same, because the hole contains no material.",
    "It increases only if the washer is thin."
   ],
   "answer": 0,
   "exp": "Every length in the plate, including the distance across the hole, scales by the same factor 1 + αΔT. The hole expands exactly as a disc of the same material would. A common error is to think that the metal grows inward.",
   "ref": "Lecture 9 deck, slide ‘Does a hole expand or shrink?’"
  },
  {
   "id": "L9-08",
   "type": "calc",
   "q": "A fuel tank is filled to the brim with 40.0 L of gasoline. The coefficient of volume expansion of gasoline is 9.5×10<sup>−4</sup> K<sup>−1</sup>. If the tank itself does not expand, how much gasoline overflows when the temperature rises by 18 K?",
   "options": [
    "0.228 L",
    "0.0684 L",
    "0.684 L",
    "6.84 L"
   ],
   "answer": 2,
   "exp": "ΔV = βV₀ΔT = (9.5×10<sup>−4</sup> K⁻¹)(40.0 L)(18 K) = 0.684 L. Use the volume coefficient β for a volume, not the linear coefficient. For a solid β ≈ 3α, which would give about a third of the value for the same material.",
   "ref": "Lecture 9 deck, slide ‘Your turn: a full fuel tank’",
   "calc": {
    "value": 0.6839999999999999,
    "unit": "L",
    "sf": 3
   }
  },
  {
   "id": "L9-09",
   "type": "calc",
   "q": "How much heat is needed to raise the temperature of 1.50 kg of water from 20.0 °C to 80.0 °C? The specific heat of water is 4186 J/(kg·K).",
   "options": [
    "6280 J",
    "3.77×10<sup>8</sup> J",
    "3.77×10<sup>5</sup> J",
    "5.02×10<sup>5</sup> J"
   ],
   "answer": 2,
   "exp": "Q = mcΔT = (1.50)(4186)(60.0) = 3.77×10<sup>5</sup> J. A temperature difference in °C equals the same difference in K. The value 6280 J is only mc, which is the energy needed per kelvin. Using the mass in grams gives a value 1000 times too large.",
   "ref": "Lecture 9 deck, slide ‘Heat and the change in temperature’ and ‘Toolkit 3: heat and specific heat’",
   "calc": {
    "value": 376740.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L9-10",
   "type": "calc",
   "q": "A 0.300 kg copper block (specific heat 390 J/(kg·K)) at 120 °C is dropped into 0.400 kg of water at 20.0 °C in an insulated container. What is the final equilibrium temperature? Neglect the container.",
   "options": [
    "26.5 °C",
    "70.0 °C",
    "62.9 °C",
    "113 °C"
   ],
   "answer": 0,
   "exp": "No heat leaves the system, so the heat lost by the copper equals the heat gained by the water: m<sub>c</sub>c<sub>c</sub>(T<sub>c</sub> − T<sub>f</sub>) = m<sub>w</sub>c<sub>w</sub>(T<sub>f</sub> − T<sub>w</sub>). Then T<sub>f</sub> = (m<sub>c</sub>c<sub>c</sub>T<sub>c</sub> + m<sub>w</sub>c<sub>w</sub>T<sub>w</sub>)/(m<sub>c</sub>c<sub>c</sub> + m<sub>w</sub>c<sub>w</sub>) = 26.5 °C. Water has a much larger heat capacity, so the final temperature is close to the water’s starting temperature. The simple average 70.0 °C ignores the heat capacities.",
   "ref": "Lecture 9 deck, slide ‘Calorimetry: energy conservation for heat’ and ‘Lecturer example: a hot metal in water’",
   "calc": {
    "value": 26.531204644412192,
    "unit": "°C",
    "sf": 3
   }
  },
  {
   "id": "L9-11",
   "type": "concept",
   "q": "Equal amounts of heat are supplied to a 1 kg block of copper (specific heat 390 J/(kg·K)) and 1 kg of water (4186 J/(kg·K)), both starting at the same temperature. Which has the greater temperature rise?",
   "options": [
    "The water, because it has the larger specific heat",
    "Both rise by the same amount, because the masses are equal",
    "The water, because heat flows more easily into liquids",
    "The copper, because it has the smaller specific heat"
   ],
   "answer": 3,
   "exp": "From Q = mcΔT, ΔT = Q/(mc). For equal Q and m, a smaller c gives a larger ΔT. The copper rises by about 11 times as much as the water. The specific heat is the energy needed per kilogram per kelvin.",
   "ref": "Lecture 9 deck, slide ‘Toolkit 3: heat and specific heat’"
  },
  {
   "id": "L9-12",
   "type": "calc",
   "q": "A brick wall has area 12.0 m², thickness 0.20 m and thermal conductivity 0.80 W/(m·K). The inside surface is at 22 °C and the outside surface is at 2 °C. What is the rate of heat conduction through the wall?",
   "options": [
    "192 W",
    "960 W",
    "9.60 W",
    "38.4 W"
   ],
   "answer": 1,
   "exp": "H = kAΔT/L = (0.80)(12.0)(20)/(0.20) = 960 W. The thickness is in the denominator, since a thicker wall conducts less. The value 192 W leaves out the division by L. The value 38.4 W multiplies by L.",
   "ref": "Lecture 9 deck, slide ‘Conduction’ and ‘Toolkit 5: conduction’",
   "calc": {
    "value": 960.0000000000001,
    "unit": "W",
    "sf": 3
   }
  },
  {
   "id": "L9-13",
   "type": "calc",
   "q": "Two bars of equal length and cross-section are joined end to end. The first has k = 200 W/(m·K) and its free end is held at 90 °C. The second has k = 50.0 W/(m·K) and its free end is held at 10 °C. In steady state, what is the temperature at the joint?",
   "options": [
    "50.0 °C",
    "74.0 °C",
    "26.0 °C",
    "42.0 °C"
   ],
   "answer": 1,
   "exp": "In steady state the heat current is the same through both bars: k₁A(T<sub>H</sub> − T<sub>i</sub>)/L = k₂A(T<sub>i</sub> − T<sub>C</sub>)/L. The area and length cancel, so T<sub>i</sub> = (k₁T<sub>H</sub> + k₂T<sub>C</sub>)/(k₁ + k₂) = 74.0 °C. The joint is closer to the hot end because the first bar is the better conductor, so less temperature drop is needed across it. The simple average 50.0 °C would hold only if k₁ = k₂.",
   "ref": "Lecture 9 deck, slide ‘Lecturer example: two bars in series’ and ‘Two bars in series: solution’",
   "calc": {
    "value": 74.0,
    "unit": "°C",
    "sf": 3
   }
  },
  {
   "id": "L9-14",
   "type": "misconception",
   "q": "A metal handle and a wooden handle are both at room temperature. The metal one feels colder when you touch it. Why?",
   "options": [
    "Metal is at a lower temperature than the wood.",
    "Metal contains less heat than wood.",
    "Wood is a better conductor, so it takes heat from your hand more slowly.",
    "Metal has a much larger thermal conductivity, so it carries heat away from your hand faster."
   ],
   "answer": 3,
   "exp": "Both objects are at the same temperature. Your skin is warmer, and what you feel is the rate at which heat leaves your hand. This rate is proportional to the thermal conductivity, which is far greater for metal. The sensation measures the heat current, not the temperature of the object.",
   "ref": "Lecture 9 deck, slide ‘Concept check: why does metal feel colder?’"
  },
  {
   "id": "L9-15",
   "type": "concept",
   "q": "The absolute temperature of a hot object is doubled. By what factor does the power it radiates change, if its surface area and emissivity stay the same?",
   "options": [
    "It increases by a factor of 16.",
    "It increases by a factor of 2.",
    "It increases by a factor of 4.",
    "It increases by a factor of 8."
   ],
   "answer": 0,
   "exp": "The radiated power is H = eσAT⁴, which is proportional to the fourth power of the absolute temperature. Doubling T multiplies H by 2⁴ = 16. This is why temperatures in the formula must be in kelvin.",
   "ref": "Lecture 9 deck, slide ‘Radiation’ and ‘Toolkit 6: radiation’"
  },
  {
   "id": "L9-16",
   "type": "calc",
   "q": "Take the skin of a person to be a body with emissivity 0.97, surface area 1.8 m² and temperature 305 K. Use σ = 5.67×10<sup>−8</sup> W/(m²·K<sup>4</sup>). What power does the skin radiate?",
   "options": [
    "0.102 W",
    "883 W",
    "857 W",
    "2.81 W"
   ],
   "answer": 2,
   "exp": "H = eσAT⁴ = (0.97)(5.67×10⁻⁸)(1.8)(305)⁴ = 857 W. The temperature must be in kelvin. Using the Celsius value, 31.9 °C, gives 0.102 W. In practice the person also absorbs radiation from the surroundings, so the net loss is much smaller.",
   "ref": "Lecture 9 deck, slide ‘Lecturer example: radiation from a person’ and ‘Toolkit 6: radiation’",
   "calc": {
    "value": 856.6958353038749,
    "unit": "W",
    "sf": 3
   }
  },
  {
   "id": "L9-17",
   "type": "calc",
   "q": "A copper rod of length 0.60 m and cross-section 4.0 cm² (k = 385 W/(m·K)) has one end at 100 °C and the other end at 0 °C. All the heat it conducts melts ice at 0 °C. How long does it take to melt 0.010 kg of ice? Use L<sub>f</sub> = 3.34×10<sup>5</sup> J/kg and neglect losses.",
   "options": [
    "85700 s",
    "3340 s",
    "130 s",
    "0.00768 s"
   ],
   "answer": 2,
   "exp": "The rate of heat flow is H = kAΔT/L = 25.7 W. The energy needed is Q = mL<sub>f</sub> = 3340 J. Time is energy divided by rate: t = Q/H = 130 s. Dividing the other way round, or multiplying, gives a quantity that does not have the dimensions of time.",
   "ref": "Lecture 9 deck, slide ‘Toolkit 7: rates and energy’ and ‘Integrated problem: heating water through a rod’",
   "calc": {
    "value": 130.1298701298701,
    "unit": "s",
    "sf": 3
   }
  },
  {
   "id": "L9-18",
   "type": "concept",
   "q": "The Sun’s heat reaches the Earth across the vacuum of space. Which mode of heat transfer is responsible?",
   "options": [
    "Radiation, because electromagnetic waves can travel through a vacuum",
    "Conduction, because the heat is passed from atom to atom",
    "Convection, because the heat is carried by moving material",
    "None, because heat cannot cross a vacuum"
   ],
   "answer": 0,
   "exp": "Conduction and convection need matter. Radiation is carried by electromagnetic waves, so it needs no medium. All objects radiate, and the amount depends on the fourth power of the absolute temperature.",
   "ref": "Lecture 9 deck, slide ‘Three ways heat moves’ and ‘Radiation’"
  },
  {
   "id": "L9-19",
   "type": "calc",
   "q": "The temperature of a liquid rises by 18.0 Fahrenheit degrees. By how many kelvin does it rise?",
   "options": [
    "18.0 K",
    "−7.78 K",
    "291 K",
    "10.0 K"
   ],
   "answer": 3,
   "exp": "A temperature difference converts with the factor 5/9 only, since the offset of 32 cancels in a difference: ΔT = (5/9)(18.0) = 10.0 K. A Celsius degree and a kelvin are the same size, and a Fahrenheit degree is 5/9 as large. The offsets 32 and 273.15 apply to temperatures, not to differences.",
   "ref": "Lecture 9 deck, slide ‘Toolkit 1: temperature scales and conversions’",
   "calc": {
    "value": 10.0,
    "unit": "K",
    "sf": 3
   }
  },
  {
   "id": "L9-20",
   "type": "misconception",
   "q": "Block A has a large mass and is at 30 °C. Block B has a small mass and is at 80 °C. They are placed in contact and isolated from their surroundings. In which direction does heat flow at first?",
   "options": [
    "From A to B, because A contains more thermal energy",
    "From B to A, because B is at the higher temperature",
    "From A to B, because A has the larger mass",
    "No heat flows, because the blocks have different masses"
   ],
   "answer": 1,
   "exp": "The direction of heat transfer is set by the temperature difference, from higher to lower temperature, not by the amount of energy stored or the mass. The large block can hold more thermal energy and still be the colder one. Heat flows until the two reach a common temperature.",
   "ref": "Lecture 9 deck, slide ‘Temperature is not heat’ and ‘Thermal equilibrium and walls’"
  }
 ]
};
