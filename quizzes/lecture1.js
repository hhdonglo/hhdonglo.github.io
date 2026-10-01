window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[1] = {
 "lecture": 1,
 "title": "Vectors",
 "questions": [
  {
   "id": "L1-01",
   "type": "concept",
   "q": "Which of the following quantities is a vector?",
   "options": [
    "A temperature of −10 °C",
    "A mass of 60 kg",
    "A displacement of 5 m towards the west",
    "A distance walked of 12 km"
   ],
   "answer": 2,
   "exp": "A vector needs a magnitude and a direction. A displacement towards the west has both. Temperature, mass and distance are described completely by a number and a unit, so they are scalars. A negative number, as in −10 °C, does not make a quantity a vector.",
   "ref": "Lecture 1 deck, slide ‘Scalars and vectors’ and ‘Concept check: scalar or vector?’"
  },
  {
   "id": "L1-02",
   "type": "misconception",
   "q": "A student says that an energy of −5 J is a vector because it has a minus sign. Which statement is correct?",
   "options": [
    "Energy is a scalar. The minus sign is the sign of a scalar quantity and does not give a direction in space.",
    "Energy is a vector, because any negative quantity points in the opposite direction.",
    "Energy is a vector only when it is measured in joules.",
    "Energy is a scalar only when its value is positive."
   ],
   "answer": 0,
   "exp": "Scalars can be positive, negative or zero. The sign of a scalar, such as −5 J or −10 °C, is not a direction. Only a quantity that needs a direction in space is a vector.",
   "ref": "Lecture 1 deck, slide ‘Concept check: scalar or vector?’"
  },
  {
   "id": "L1-03",
   "type": "concept",
   "q": "A runner completes exactly one lap of a circular track of circumference 250 m and stops at the starting line. What are the distance travelled and the magnitude of the displacement?",
   "options": [
    "Distance 0 m, displacement magnitude 250 m",
    "Distance 250 m, displacement magnitude 250 m",
    "Distance 125 m, displacement magnitude 125 m",
    "Distance 250 m, displacement magnitude 0 m"
   ],
   "answer": 3,
   "exp": "Distance is the total length of the path, 250 m. Displacement runs from the initial position to the final position. The runner finishes where the lap began, so the displacement is zero.",
   "ref": "Lecture 1 deck, slide ‘Distance and displacement’"
  },
  {
   "id": "L1-04",
   "type": "calc",
   "q": "A hiker walks 3.00 km north and then 5.00 km east. In what direction is the hiker from the starting point, measured as an angle east of north?",
   "options": [
    "31.0°",
    "59.0°",
    "121°",
    "149°"
   ],
   "answer": 1,
   "exp": "Sketch the two legs head to tail. The angle east of north is measured from the north leg, so tan θ = (east leg)/(north leg) = 5.00/3.00, giving θ = 59.0°. The angle 31.0° is the angle north of east, which is measured from the other leg. The resultant magnitude is 5.83 km.",
   "ref": "Lecture 1 deck, slide ‘Returning to the opening problem’",
   "calc": {
    "value": 59.03624346792648,
    "unit": "°",
    "sf": 3
   }
  },
  {
   "id": "L1-05",
   "type": "concept",
   "q": "Two displacement vectors have magnitudes 6 m and 9 m. Which value could be the magnitude of their sum?",
   "options": [
    "2 m",
    "12 m",
    "16 m",
    "20 m"
   ],
   "answer": 1,
   "exp": "The magnitude of A + B lies between |A − B| and A + B, so here it lies between 3 m and 15 m. Only 12 m is in that range. A magnitude of 15 m would need the vectors to point the same way.",
   "ref": "Lecture 1 deck, slide ‘Magnitudes do not simply add’ and ‘Toolkit 2: vector triangles’"
  },
  {
   "id": "L1-06",
   "type": "misconception",
   "q": "For two vectors A and B, how do A − B and B − A compare?",
   "options": [
    "They are equal, because vector addition is commutative.",
    "They have the same direction but different magnitudes.",
    "They have different magnitudes and different directions.",
    "They have the same magnitude and opposite directions."
   ],
   "answer": 3,
   "exp": "Subtraction is not commutative. B − A = −(A − B), so the two results have equal magnitudes and point in opposite directions. Subtraction is addition of the reversed vector, A + (−B).",
   "ref": "Lecture 1 deck, slide ‘Subtracting vectors’"
  },
  {
   "id": "L1-07",
   "type": "calc",
   "q": "A cyclist rides 4.00 km east, then 3.00 km at 50° north of east. What is the magnitude of the resultant displacement?",
   "options": [
    "6.36 km",
    "5.00 km",
    "3.09 km",
    "7.00 km"
   ],
   "answer": 0,
   "exp": "The two legs are not perpendicular, so Pythagoras does not apply. Placed head to tail, the angle inside the triangle between the legs is 180° − 50° = 130°. The cosine rule gives R² = 4.00² + 3.00² − 2(4.00)(3.00) cos 130°, so R = 6.36 km. This lies between 1.00 km and 7.00 km, as the check in Toolkit 2 requires.",
   "ref": "Lecture 1 deck, slide ‘Your turn: when the angle is not 90°’ and ‘Toolkit 2: vector triangles’",
   "calc": {
    "value": 6.358215365373915,
    "unit": "km",
    "sf": 3
   }
  },
  {
   "id": "L1-08",
   "type": "calc",
   "q": "A vector points 40° west of north. What is its standard angle θ, measured counter-clockwise from the +x axis (east)?",
   "options": [
    "50°",
    "140°",
    "130°",
    "220°"
   ],
   "answer": 2,
   "exp": "East is 0° and north is 90°. Starting at north and turning 40° towards west adds 40°, so θ = 90° + 40° = 130°. Always sketch first: the angle “40° west of north” is measured from north, not from east.",
   "ref": "Lecture 1 deck, slide ‘Toolkit 1: directions and angles’",
   "calc": {
    "value": 130,
    "unit": "°",
    "sf": 2
   }
  },
  {
   "id": "L1-09",
   "type": "calc",
   "q": "A vector of magnitude 12.0 m points 35° below the +x axis. What is its y-component?",
   "options": [
    "6.88 m",
    "−9.83 m",
    "−6.88 m",
    "5.14 m"
   ],
   "answer": 2,
   "exp": "Sketch first: the vector points right and down, so Aᵧ is negative. With the angle measured from +x, Aᵧ = A sin θ = 12.0 sin(−35°) = −6.88 m. The value −9.83 m swaps sine and cosine. The value 5.14 m comes from a calculator set to radians instead of degrees, which a sketch and a sign check would catch.",
   "ref": "Lecture 1 deck, slide ‘Predict the signs first’ and ‘Toolkit 3: components’",
   "calc": {
    "value": -6.882917236212553,
    "unit": "m",
    "sf": 3
   }
  },
  {
   "id": "L1-10",
   "type": "misconception",
   "q": "An angle β is measured from the +y axis to a vector of magnitude A, towards +x. What are its components?",
   "options": [
    "Aₓ = A sin β and Aᵧ = A cos β",
    "Aₓ = A cos β and Aᵧ = A sin β",
    "Aₓ = A tan β and Aᵧ = A",
    "Aₓ = A sin β and Aᵧ = A sin β"
   ],
   "answer": 0,
   "exp": "The formulas A cos θ and A sin θ hold only when θ is measured from +x. Here the y-component lies along the side adjacent to β, so it uses cosine, and the x-component lies opposite β, so it uses sine. Think ‘adjacent or opposite?’, not ‘sine or cosine?’.",
   "ref": "Lecture 1 deck, slide ‘Your turn: angles measured from other axes’ and ‘Toolkit 3: components’"
  },
  {
   "id": "L1-11",
   "type": "calc",
   "q": "A vector has components Aₓ = −5.00 m and Aᵧ = −12.0 m. What is its direction θ, measured counter-clockwise from +x, in the range 0° to 360°?",
   "options": [
    "67.4°",
    "113°",
    "293°",
    "247°"
   ],
   "answer": 3,
   "exp": "Both components are negative, so the vector is in quadrant III. The reference angle is tan⁻¹|−12.0/−5.00| = 67.4°. In quadrant III θ = 180° + reference = 247°. A calculator gives only 67.4° for tan⁻¹(Aᵧ/Aₓ), which points into quadrant I, so quadrant first and calculation second.",
   "ref": "Lecture 1 deck, slide ‘Direction from components: a common error’ and ‘Finding direction from components’",
   "calc": {
    "value": 247.38013505195957,
    "unit": "°",
    "sf": 3
   }
  },
  {
   "id": "L1-12",
   "type": "calc",
   "q": "Vector A has components (3.0, −2.0) m and vector B has components (−5.0, 6.0) m. What is the magnitude of A + B?",
   "options": [
    "11.4 m",
    "4.47 m",
    "6.00 m",
    "2.00 m"
   ],
   "answer": 1,
   "exp": "Add the components: Rₓ = −2.00 m and Rᵧ = 4.00 m. Then R = √(Rₓ² + Rᵧ²) = 4.47 m. The value 11.4 m adds the magnitudes, which only works for vectors in the same direction. The value 6.00 m adds the components of the answer instead of combining them.",
   "ref": "Lecture 1 deck, slide ‘Adding vectors with components’",
   "calc": {
    "value": 4.47213595499958,
    "unit": "m",
    "sf": 3
   }
  },
  {
   "id": "L1-13",
   "type": "calc",
   "q": "What is the magnitude of the vector C = 2î − 3ĵ + 6k̂?",
   "options": [
    "11.0",
    "7.00",
    "5.00",
    "49.0"
   ],
   "answer": 1,
   "exp": "|C| = √(2² + (−3)² + 6²) = √(4 + 9 + 36) = √49 = 7.00. Adding the components, or adding their absolute values, does not give the magnitude. Forgetting the square root gives 49.0.",
   "ref": "Lecture 1 deck, slide ‘Unit vectors’ and ‘The 3D Cartesian system’",
   "calc": {
    "value": 7.0,
    "unit": "",
    "sf": 3
   }
  },
  {
   "id": "L1-14",
   "type": "calc",
   "q": "Find A · B for A = 2î − 3ĵ + 5k̂ and B = 4î + 2ĵ − k̂.",
   "options": [
    "3.00",
    "19.0",
    "7.00",
    "−3.00"
   ],
   "answer": 3,
   "exp": "Multiply matching components and add: A·B = (2)(4) + (−3)(2) + (5)(−1) = 8 − 6 − 5 = −3.00. The result is a scalar, and it is negative here because the angle between the vectors is greater than 90°.",
   "ref": "Lecture 1 deck, slide ‘Dot product from components’ and ‘Predict the sign of A·B’",
   "calc": {
    "value": -3.0,
    "unit": "",
    "sf": 3
   }
  },
  {
   "id": "L1-15",
   "type": "calc",
   "q": "Two vectors have magnitudes 5.0 m and 4.0 m. The angle between them, with their tails together, is 120°. What is A · B?",
   "options": [
    "−10.0 m²",
    "10.0 m²",
    "17.3 m²",
    "−17.3 m²"
   ],
   "answer": 0,
   "exp": "A·B = AB cos φ = (5.0)(4.0) cos 120° = −10.0 m². The angle is greater than 90°, so the dot product must be negative. The projection of one vector on the other points against it. Using sine instead of cosine gives ±17.3 m², which is the magnitude of the cross product.",
   "ref": "Lecture 1 deck, slide ‘The dot (scalar) product’ and ‘Toolkit 6: the dot product’",
   "calc": {
    "value": -9.999999999999996,
    "unit": "m²",
    "sf": 3
   }
  },
  {
   "id": "L1-16",
   "type": "concept",
   "q": "What is the result of the cross product î × k̂?",
   "options": [
    "+ĵ",
    "+k̂",
    "−ĵ",
    "0"
   ],
   "answer": 2,
   "exp": "The cyclic order î → ĵ → k̂ → î gives a plus sign, so k̂ × î = +ĵ. The order in î × k̂ is reversed, so the result is −ĵ. By the right-hand rule, curling the fingers from +x towards +z puts the thumb along −y. The product is zero only for parallel vectors.",
   "ref": "Lecture 1 deck, slide ‘Properties of the cross product’"
  },
  {
   "id": "L1-17",
   "type": "calc",
   "q": "Two vectors have magnitudes 6.0 m and 3.0 m. The angle between them, tails together, is 30.0°. What is the magnitude of A × B?",
   "options": [
    "15.6 m²",
    "18.0 m²",
    "9.00 m²",
    "4.50 m²"
   ],
   "answer": 2,
   "exp": "|A×B| = AB sin φ = (6.0)(3.0) sin 30.0° = 9.00 m². This is the area of the parallelogram formed by the two vectors. Using cosine gives the wrong quantity, 15.6, and omitting the angle gives the product of the magnitudes, 18.0.",
   "ref": "Lecture 1 deck, slide ‘The cross (vector) product: geometry first’",
   "calc": {
    "value": 8.999999999999998,
    "unit": "m²",
    "sf": 3
   }
  },
  {
   "id": "L1-18",
   "type": "graph",
   "q": "Vectors A and B are drawn from a common tail and point in exactly the same direction. What are A · B and the magnitude of A × B?",
   "options": [
    "A · B = AB and |A × B| = 0",
    "A · B = 0 and |A × B| = AB",
    "A · B = 0 and |A × B| = 0",
    "A · B = AB and |A × B| = AB"
   ],
   "answer": 0,
   "exp": "The angle between the vectors is 0°. The dot product is AB cos 0° = AB, its largest value, and the cross product magnitude is AB sin 0° = 0. For perpendicular vectors the roles are reversed: the dot product is zero and the cross product is largest.",
   "ref": "Lecture 1 deck, slide ‘Dot product and cross product compared’ and ‘Cross Product: Technical Summary’"
  },
  {
   "id": "L1-19",
   "type": "graph",
   "q": "On a diagram, vector A is drawn pointing east with length 8 m, and vector B is drawn head to tail from the head of A, pointing west with length 3 m. What is the resultant A + B?",
   "options": [
    "11 m, pointing east",
    "5 m, pointing west",
    "3 m, pointing west",
    "5 m, pointing east"
   ],
   "answer": 3,
   "exp": "Head-to-tail addition gives a resultant from the tail of A to the head of B. B points opposite to A and is shorter, so the resultant points east with magnitude 8 m − 3 m = 5 m. Magnitudes add directly only when the vectors point the same way.",
   "ref": "Lecture 1 deck, slide ‘Adding vectors graphically: head to tail’"
  },
  {
   "id": "L1-20",
   "type": "calc",
   "q": "A crate is pulled 5.0 m along a horizontal floor by a rope that exerts a constant force of 40 N at 60° above the horizontal. What is F · d, the work done by the rope?",
   "options": [
    "173 J",
    "100 J",
    "200 J",
    "−190 J"
   ],
   "answer": 1,
   "exp": "Only the component of the force along the displacement contributes: F·d = F d cos θ = (40)(5.0) cos 60° = 100 J. Using sine gives the contribution of the vertical component. Ignoring the angle gives the largest possible value, 200 J. The negative value −190 J comes from a calculator in radian mode.",
   "ref": "Lecture 1 deck, slide ‘Integrated problem: pulling a crate’",
   "calc": {
    "value": 100.00000000000003,
    "unit": "J",
    "sf": 3
   }
  }
 ]
};
