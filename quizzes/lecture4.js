window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[4] = {
 "lecture": 4,
 "title": "Work and kinetic energy",
 "questions": [
  {
   "id": "L4-01",
   "type": "calc",
   "q": "A sled is pulled 15 m along level ground by a rope that exerts a constant force of 120 N at 30° above the horizontal. How much work does the rope do on the sled?",
   "options": [
    "900 J",
    "1800 J",
    "1560 J",
    "278 J"
   ],
   "answer": 2,
   "exp": "Work by a constant force is W = Fd cos θ = (120)(15) cos 30° = 1560 J. Only the component of the force along the displacement does work. Using sine gives the contribution of the vertical component, 900 J, and leaving out the angle gives the maximum possible value, 1800 J.",
   "ref": "Lecture 4 deck, slide ‘Work by a constant force’ and ‘Toolkit 1: work by a constant force’",
   "calc": {
    "value": 1558.8457268119896,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-02",
   "type": "concept",
   "q": "A box slides along a rough horizontal floor and comes to rest. What is the sign of the work done on the box by kinetic friction?",
   "options": [
    "Negative, because the friction force points opposite to the displacement",
    "Positive, because friction is what brings the box to a stop",
    "Zero, because the box ends with no kinetic energy",
    "Zero, because friction is perpendicular to the displacement"
   ],
   "answer": 0,
   "exp": "The sign of the work comes from the angle between the force and the displacement. Kinetic friction opposes the motion, so φ = 180° and W = fd cos 180° = −fd. The negative work removes kinetic energy from the box.",
   "ref": "Lecture 4 deck, slide ‘The sign of work’"
  },
  {
   "id": "L4-03",
   "type": "misconception",
   "q": "A crate rests on the flat bed of a truck that is speeding up in a straight line. The crate does not slide on the bed. What is the work done on the crate by static friction, measured in the ground frame?",
   "options": [
    "Negative, because friction always opposes motion",
    "Zero, because the crate does not move relative to the truck",
    "Zero, because static friction never does work",
    "Positive, because the friction force is in the direction of the crate’s displacement"
   ],
   "answer": 3,
   "exp": "The only horizontal force on the crate is static friction from the truck bed, and it points forward, along the displacement of the crate over the ground. Hence it does positive work and is what increases the crate’s kinetic energy. Friction does not always oppose motion. It opposes sliding between the surfaces.",
   "ref": "Lecture 4 deck, slide ‘Concept check: can friction do positive work?’"
  },
  {
   "id": "L4-04",
   "type": "concept",
   "q": "A waiter carries a tray horizontally at constant velocity. What is the work done on the tray by the waiter’s upward supporting force?",
   "options": [
    "Positive, because the waiter is exerting a force",
    "Zero, because the force is perpendicular to the displacement",
    "Positive, because the tray is moving",
    "Negative, because the force opposes the weight of the tray"
   ],
   "answer": 1,
   "exp": "Work is W = Fd cos φ. The supporting force is vertical and the displacement is horizontal, so φ = 90° and W = 0. A force does no work if it is perpendicular to the displacement, however hard it is exerted. Effort in the everyday sense is not work in the physics sense.",
   "ref": "Lecture 4 deck, slide ‘Concept check: which forces do no work?’ and ‘Is a hard workout work?’"
  },
  {
   "id": "L4-05",
   "type": "calc",
   "q": "A box is dragged 6.0 m across a rough horizontal floor by a rope pulling with a force of 80.0 N at 40° above the horizontal. The friction force is a constant 35 N. What is the total work done on the box?",
   "options": [
    "368 J",
    "158 J",
    "270 J",
    "210 J"
   ],
   "answer": 1,
   "exp": "The weight and the normal force are perpendicular to the displacement and do no work. The rope does 368 J and friction does −210 J, so the net work is 368 J − 210 J = 158 J. Ignoring friction gives 368 J. Subtracting the friction force from the full rope force ignores the angle.",
   "ref": "Lecture 4 deck, slide ‘Total work on an object’ and ‘Toolkit 2: net work from the free-body diagram’",
   "calc": {
    "value": 157.70133269710942,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-06",
   "type": "calc",
   "q": "A car of mass 1200 kg travels at 90.0 km/h. What is its kinetic energy?",
   "options": [
    "4.86×10<sup>6</sup> J",
    "30000 J",
    "7.50×10<sup>5</sup> J",
    "3.75×10<sup>5</sup> J"
   ],
   "answer": 3,
   "exp": "Convert first: 90.0 km/h = 25.0 m/s. Then K = ½mv² = ½(1200)(25.0)² = 3.75×10<sup>5</sup> J. Using the speed in km/h gives 4.86×10<sup>6</sup> J, which is not a joule value. Omitting the ½ gives 7.50×10<sup>5</sup> J, and mv is the momentum, not the kinetic energy.",
   "ref": "Lecture 4 deck, slide ‘The physical meaning of kinetic energy’ and ‘Comparing kinetic energies’",
   "calc": {
    "value": 375000.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-07",
   "type": "concept",
   "q": "A car’s speed is doubled. By what factor does its kinetic energy change?",
   "options": [
    "It is multiplied by 4.",
    "It is multiplied by 2.",
    "It is multiplied by 8.",
    "It does not change, because the mass is the same."
   ],
   "answer": 0,
   "exp": "Kinetic energy is K = ½mv², which is proportional to v². Doubling v multiplies K by 2² = 4. This is why the braking distance, which is proportional to the kinetic energy for a fixed braking force, also quadruples.",
   "ref": "Lecture 4 deck, slide ‘Comparing kinetic energies’ and ‘Back to the opening question: braking distance’"
  },
  {
   "id": "L4-08",
   "type": "calc",
   "q": "A 3.0 kg block starts from rest on a smooth horizontal floor. A net horizontal force of 15.0 N acts on it over a distance of 4.0 m. What is its final speed?",
   "options": [
    "20.0 m/s",
    "4.47 m/s",
    "6.32 m/s",
    "12.6 m/s"
   ],
   "answer": 2,
   "exp": "The work–energy theorem gives W<sub>net</sub> = ΔK. So Fd = ½mv², and v = √(2Fd/m) = √(2(15.0)(4.0)/3.0) = 6.32 m/s. Forgetting the square root gives 20.0, and forgetting the factor 2 inside it gives 4.47 m/s.",
   "ref": "Lecture 4 deck, slide ‘Rule: the work–energy theorem’ and ‘Toolkit 3: applying the work–energy theorem’",
   "calc": {
    "value": 6.324555320336759,
    "unit": "m/s",
    "sf": 3
   }
  },
  {
   "id": "L4-09",
   "type": "calc",
   "q": "A 1500 kg car travelling at 20.0 m/s brakes with a constant friction force of 6000 N until it stops. How far does it travel while stopping?",
   "options": [
    "100 m",
    "25.0 m",
    "50.0 m",
    "200 m"
   ],
   "answer": 2,
   "exp": "The work done by friction removes all of the kinetic energy: −fd = 0 − ½mv₀². So d = mv₀²/(2f) = (1500)(20.0)²/(2(6000)) = 50.0 m. Leaving out the ½ doubles the answer, to 100 m.",
   "ref": "Lecture 4 deck, slide ‘Back to the opening question: braking distance’ and ‘Toolkit 4: choosing the method’",
   "calc": {
    "value": 50.0,
    "unit": "m",
    "sf": 3
   }
  },
  {
   "id": "L4-10",
   "type": "calc",
   "q": "A 2.50 kg hammer head falls from rest through 1.80 m before striking a pile. Neglect air resistance. What is its speed on impact?",
   "options": [
    "5.94 m/s",
    "35.3 m/s",
    "4.20 m/s",
    "17.6 m/s"
   ],
   "answer": 0,
   "exp": "Only gravity does work, W = mgh, and it equals the gain in kinetic energy: mgh = ½mv². The mass cancels, so v = √(2gh) = √(2(9.80)(1.80)) = 5.94 m/s. A heavier hammer would have the same speed but more kinetic energy. The value 35.3 is v² and 4.20 m/s leaves out the factor 2.",
   "ref": "Lecture 4 deck, slide ‘Work done by the weight’ and ‘Lecturer example: a pile driver’",
   "calc": {
    "value": 5.939696961966999,
    "unit": "m/s",
    "sf": 3
   }
  },
  {
   "id": "L4-11",
   "type": "graph",
   "q": "The graph of the force F<sub>x</sub> on an object against position x shows a constant 12.0 N from x = 0 to x = 2.0 m. The force then falls in a straight line to zero at x = 5.0 m. What is the work done by the force from x = 0 to x = 5.0 m?",
   "options": [
    "60.0 J",
    "24.0 J",
    "30.0 J",
    "42.0 J"
   ],
   "answer": 3,
   "exp": "Work is the area under the F<sub>x</sub>–x graph. The rectangle is (12.0)(2.0) = 24.0 J and the triangle is ½(12.0)(3.0) = 18.0 J, so the total is 42.0 J. Using the full width at the full height gives 60.0 J, which ignores that the force falls.",
   "ref": "Lecture 4 deck, slide ‘Work as the area under a force graph’ and ‘Example: work from an F<sub>x</sub>–x graph’",
   "calc": {
    "value": 42.0,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-12",
   "type": "calc",
   "q": "A spring of force constant 400 N/m is stretched from its natural length by 0.15 m. How much work is done on the spring?",
   "options": [
    "60.0 J",
    "4.50 J",
    "9.00 J",
    "30.0 J"
   ],
   "answer": 1,
   "exp": "The spring force grows from 0 to kx, so the work done on the spring is the area of a triangle, W = ½kx² = ½(400)(0.15)² = 4.50 J. The value 60.0 is the final force in newtons, not a work. Omitting the ½ gives 9.00 J.",
   "ref": "Lecture 4 deck, slide ‘Work done on a spring’ and ‘Toolkit 6: springs’",
   "calc": {
    "value": 4.5,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-13",
   "type": "calc",
   "q": "A spring with force constant 200 N/m is stretched from 0.10 m to 0.30 m beyond its natural length. How much work is done on the spring during this stretch?",
   "options": [
    "9.00 J",
    "8.00 J",
    "4.00 J",
    "40.0 J"
   ],
   "answer": 1,
   "exp": "Work is the change in ½kx²: W = ½k(x₂² − x₁²) = ½(200)(0.30² − 0.10²) = 8.00 J. It is not ½k(Δx)², which gives 4.00 J. The value 9.00 J is the work to stretch from the natural length to 0.30 m.",
   "ref": "Lecture 4 deck, slide ‘Work done on a spring’ and ‘Toolkit 6: springs’",
   "calc": {
    "value": 7.999999999999999,
    "unit": "J",
    "sf": 3
   }
  },
  {
   "id": "L4-14",
   "type": "calc",
   "q": "A 0.200 kg glider on a frictionless air track is attached to a spring of force constant 50.0 N/m. It is pulled 0.12 m from the equilibrium position and released from rest. What is its speed when it passes the equilibrium position?",
   "options": [
    "3.60 m/s",
    "2.68 m/s",
    "1.34 m/s",
    "1.90 m/s"
   ],
   "answer": 3,
   "exp": "The spring does work ½kx² on the glider as it returns to equilibrium. Setting this equal to ½mv² gives v = x√(k/m) = (0.12)√(50.0/0.200) = 1.90 m/s. The value 3.60 is v², and the other wrong values come from a misplaced factor of 2.",
   "ref": "Lecture 4 deck, slide ‘Lecturer example: a glider on a spring’ and ‘A glider on a spring: solution’",
   "calc": {
    "value": 1.8973665961010275,
    "unit": "m/s",
    "sf": 3
   }
  },
  {
   "id": "L4-15",
   "type": "calc",
   "q": "A student of mass 60.0 kg climbs a flight of stairs of total height 4.50 m in 8.0 s at a steady pace. What is the average power the student develops against gravity?",
   "options": [
    "331 W",
    "2650 W",
    "33.8 W",
    "662 W"
   ],
   "answer": 0,
   "exp": "The work done against gravity is mgh = (60.0)(9.80)(4.50) = 2650 J. Average power is work divided by time: P = W/t = 331 W. The value 2650 is the work, in joules, not a power. Leaving out g gives 33.8.",
   "ref": "Lecture 4 deck, slide ‘Power’ and ‘Lecturer example: two stair climbers’",
   "calc": {
    "value": 330.75,
    "unit": "W",
    "sf": 3
   }
  },
  {
   "id": "L4-16",
   "type": "calc",
   "q": "A car moves at a constant 25.0 m/s on a level road against a total resistive force of 600 N. What power must the engine deliver to the wheels? Give the answer in kilowatts.",
   "options": [
    "7.50 kW",
    "375 kW",
    "15.0 kW",
    "30.0 kW"
   ],
   "answer": 2,
   "exp": "At constant velocity the forward force equals the resistive force, so P = Fv = (600 N)(25.0 m/s) = 15000 W = 15.0 kW. A power of 7.50 kW would use the average of the speeds over a start from rest, which does not apply here.",
   "ref": "Lecture 4 deck, slide ‘Toolkit 7: power’ and ‘Lecturer example: a car at constant speed’",
   "calc": {
    "value": 15.0,
    "unit": "kW",
    "sf": 3
   }
  },
  {
   "id": "L4-17",
   "type": "misconception",
   "q": "A 2.0 kg object and a 4.0 kg object start from rest on a smooth floor. The same net force acts on each over the same distance. Which has the greater kinetic energy at the end?",
   "options": [
    "The 4.0 kg object, because it has more mass.",
    "The 2.0 kg object, because it reaches a higher speed.",
    "They have the same kinetic energy.",
    "It cannot be found without the force and the distance."
   ],
   "answer": 2,
   "exp": "By the work–energy theorem, ΔK = W<sub>net</sub> = Fd. The force and the distance are the same, so the kinetic energies are the same. The lighter object ends up faster, but its smaller mass exactly compensates in ½mv².",
   "ref": "Lecture 4 deck, slide ‘The physical meaning of kinetic energy’ and ‘Comparing kinetic energies’"
  },
  {
   "id": "L4-18",
   "type": "graph",
   "q": "A graph of the kinetic energy of an object against the square of its speed is a straight line through the origin. What does the slope of the line represent?",
   "options": [
    "Half the mass of the object",
    "The mass of the object",
    "Twice the mass of the object",
    "The weight of the object"
   ],
   "answer": 0,
   "exp": "K = ½mv², so a plot of K against v² has the form y = (½m)x. The slope is ½m. Reading a slope with its physical meaning is part of graph interpretation.",
   "ref": "Lecture 4 deck, slide ‘Rule: the work–energy theorem’ and ‘The physical meaning of kinetic energy’"
  },
  {
   "id": "L4-19",
   "type": "concept",
   "q": "A ball is thrown straight up. How does the sign of the work done on the ball by gravity change during the flight, as it rises and as it falls?",
   "options": [
    "Positive while the ball rises and negative while it falls",
    "Always negative, because gravity always acts downward",
    "Always positive, because the ball always has weight",
    "Negative while the ball rises and positive while it falls"
   ],
   "answer": 3,
   "exp": "Work depends on the angle between the force and the displacement. While the ball rises, gravity points down and the displacement points up, so the work is negative and the ball slows. While it falls, they point the same way, so the work is positive and the ball speeds up.",
   "ref": "Lecture 4 deck, slide ‘The sign of work’ and ‘Work done by the weight’"
  },
  {
   "id": "L4-20",
   "type": "calc",
   "q": "A 3.0 kg block slides at 5.0 m/s on a frictionless floor into a spring of force constant 1200 N/m. What is the maximum compression of the spring?",
   "options": [
    "0.354 m",
    "0.250 m",
    "0.125 m",
    "0.0625 m"
   ],
   "answer": 1,
   "exp": "At maximum compression the block is momentarily at rest, so the spring has done work −½kx² and removed all the kinetic energy: ½kx² = ½mv₀². Then x = v₀√(m/k) = (5.0)√(3.0/1200) = 0.250 m. The value 0.0625 is x² and the others come from misplaced factors.",
   "ref": "Lecture 4 deck, slide ‘Integrated problem: a block and a spring on a rough floor’",
   "calc": {
    "value": 0.25,
    "unit": "m",
    "sf": 3
   }
  }
 ]
};
