window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};
window.PHYS143_QUIZ[3] = {
 "lecture": 3,
 "title": "Newton’s laws",
 "questions": [
  {
   "id": "L3-01",
   "type": "misconception",
   "q": "A hockey puck slides at constant velocity across horizontal ice, and friction is negligible. Which statement about the horizontal forces on the puck is correct?",
   "options": [
    "A constant forward force is needed to keep the puck moving.",
    "A forward force, left over from the push that started it, keeps the puck moving.",
    "No horizontal force is needed. The net horizontal force is zero.",
    "A forward force that slowly decreases is acting on the puck."
   ],
   "answer": 2,
   "exp": "By Newton’s first law, an object moves at constant velocity when the net force on it is zero. A force is needed to change the velocity, not to maintain it. A push that has ended no longer acts on the puck.",
   "ref": "Lecture 3 deck, slide ‘Newton’s first law’ and ‘Concept check: is the net force zero?’"
  },
  {
   "id": "L3-02",
   "type": "concept",
   "q": "An astronaut of mass 80 kg travels from Earth to the Moon, where the free-fall acceleration is about one sixth of that on Earth. What happens to the astronaut’s mass and weight?",
   "options": [
    "The mass stays at 80 kg and the weight becomes about one sixth of its value on Earth.",
    "The mass becomes about one sixth of 80 kg and the weight does not change.",
    "Both the mass and the weight become about one sixth of their values on Earth.",
    "Neither the mass nor the weight changes."
   ],
   "answer": 0,
   "exp": "Mass measures the amount of matter and resistance to acceleration, so it does not depend on location. Weight is the gravitational force, w = mg, and it changes with the local value of g.",
   "ref": "Lecture 3 deck, slide ‘Mass and weight’"
  },
  {
   "id": "L3-03",
   "type": "calc",
   "q": "An astronaut of mass 65.0 kg stands on the Moon, where g = 1.62 m/s². What is the astronaut’s weight on the Moon?",
   "options": [
    "637 N",
    "40.1 N",
    "65.0 N",
    "105 N"
   ],
   "answer": 3,
   "exp": "Weight is w = mg = (65.0 kg)(1.62 m/s²) = 105 N. The value 637 N is the weight on Earth. Dividing the mass by g gives 40.1, which has the wrong units for a force. The mass itself is 65.0 kg, which is not a weight.",
   "ref": "Lecture 3 deck, slide ‘Mass and weight’",
   "calc": {
    "value": 105.30000000000001,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-04",
   "type": "calc",
   "q": "Three horizontal forces act on a crate: 30.0 N east, 40.0 N north and 20.0 N west. What is the magnitude of the net force?",
   "options": [
    "90.0 N",
    "41.2 N",
    "50.0 N",
    "64.0 N"
   ],
   "answer": 1,
   "exp": "Use components with east as +x and north as +y: ΣF<sub>x</sub> = 30.0 − 20.0 = 10.0 N and ΣF<sub>y</sub> = 40.0 N. The magnitude is √(10.0² + 40.0²) = 41.2 N. Adding magnitudes, or ignoring the westward force, gives wrong values. The sketch shows the west force reduces the east component.",
   "ref": "Lecture 3 deck, slide ‘Net force: superposition’ and ‘Net force: solution’",
   "calc": {
    "value": 41.23105625617661,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-05",
   "type": "graph",
   "q": "A book rests on a horizontal table. Which set of forces belongs on the free-body diagram of the book?",
   "options": [
    "The weight, the normal force and a ‘force of rest’ that keeps the book still",
    "The weight of the book acting down and the normal force from the table acting up, equal in magnitude",
    "The weight, the normal force and the force of the book on the table",
    "The weight of the book only, because the table is not moving"
   ],
   "answer": 1,
   "exp": "A free-body diagram shows only forces acting on the chosen object, one arrow for each. The book is acted on by gravity (down) and by the table (normal force, up). Because the acceleration is zero, the two forces balance. The force of the book on the table acts on the table, so it does not belong on this diagram.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 1: free-body diagrams’ and ‘Build it together: a book on a table’"
  },
  {
   "id": "L3-06",
   "type": "calc",
   "q": "A car of mass 1200 kg is acted on by a net forward force of 3000 N. What is its acceleration?",
   "options": [
    "0.400 m/s²",
    "0.255 m/s²",
    "3.60×10<sup>6</sup> m/s²",
    "2.50 m/s²"
   ],
   "answer": 3,
   "exp": "Newton’s second law gives a = ΣF/m = (3000 N)/(1200 kg) = 2.50 m/s², in the direction of the net force. Inverting the ratio gives 0.400. Using the weight mg in place of the mass gives 0.255. Multiplying gives a quantity with the wrong units.",
   "ref": "Lecture 3 deck, slide ‘Newton’s second law’ and ‘Toolkit 3: applying ΣF = ma’",
   "calc": {
    "value": 2.5,
    "unit": "m/s²",
    "sf": 3
   }
  },
  {
   "id": "L3-07",
   "type": "misconception",
   "q": "A car is moving east and slowing down. In which direction is the net force on the car?",
   "options": [
    "West, opposite to the velocity",
    "East, in the direction of the motion",
    "There is no net force, because the car is still moving",
    "Downward, because of the weight of the car"
   ],
   "answer": 0,
   "exp": "The net force has the direction of the acceleration, not of the velocity. A car slowing down while moving east has an acceleration towards the west, so the net force points west. Motion does not have to be in the direction of the net force.",
   "ref": "Lecture 3 deck, slide ‘Newton’s second law’"
  },
  {
   "id": "L3-08",
   "type": "calc",
   "q": "A lamp of mass 8.00 kg hangs at rest from two identical cables. Each cable makes an angle of 25° above the horizontal. What is the tension in each cable?",
   "options": [
    "39.2 N",
    "43.3 N",
    "92.8 N",
    "78.4 N"
   ],
   "answer": 2,
   "exp": "The lamp is in equilibrium, so the vertical forces balance: 2T sin 25° = mg = 78.4 N, giving T = 92.8 N. The tension is larger than half the weight because each cable pulls at a shallow angle, so only part of it acts upward. Using cosine, or taking T = mg/2, would be correct only for other geometries.",
   "ref": "Lecture 3 deck, slide ‘Equilibrium: the special case a = 0’ and ‘A hanging lamp: solution’",
   "calc": {
    "value": 92.75510205957795,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-09",
   "type": "misconception",
   "q": "The Earth pulls down on a book on a table with a force of 5 N. Which force is the third-law partner of this force?",
   "options": [
    "The table pushes up on the book with a force of 5 N.",
    "The table pushes down on the floor with a force of 5 N.",
    "The book pulls up on the Earth with a force of 5 N.",
    "There is no partner force, because the book is not moving."
   ],
   "answer": 2,
   "exp": "Third-law pairs act on two different objects and are the same kind of force. The Earth pulls on the book, so the partner is the book pulling on the Earth. The upward push of the table also has magnitude 5 N here, but it acts on the same object as the weight and is a different kind of force. It balances the weight but is not its partner.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 4: third-law pairs’ and ‘Concept check: pairs for the book on the table’"
  },
  {
   "id": "L3-10",
   "type": "misconception",
   "q": "A small car collides head-on with a heavy truck. How does the magnitude of the force of the car on the truck compare with the force of the truck on the car, during the collision?",
   "options": [
    "The two forces are equal in magnitude and opposite in direction.",
    "The truck exerts the larger force, because it is heavier.",
    "The car exerts the larger force, because it is the one that is damaged more.",
    "The forces are equal only if the car and the truck have the same mass."
   ],
   "answer": 0,
   "exp": "Newton’s third law holds for every interaction: the forces have equal magnitude and opposite directions, whatever the masses. The car is affected more because the same force on a smaller mass gives a larger acceleration, a = F/m.",
   "ref": "Lecture 3 deck, slide ‘Newton’s third law’ and ‘Concept check: a horse and a cart’"
  },
  {
   "id": "L3-11",
   "type": "calc",
   "q": "A 3.00 kg block sits on a frictionless horizontal table. A light string over a frictionless pulley connects it to a hanging 5.00 kg mass. Once released, what is the acceleration of the blocks?",
   "options": [
    "9.80 m/s²",
    "16.3 m/s²",
    "3.68 m/s²",
    "6.13 m/s²"
   ],
   "answer": 3,
   "exp": "Treat the pair as one system moving along the string: the net force along the motion is the weight of the hanging mass, m₂g, and the mass being accelerated is m₁ + m₂. Then a = m₂g/(m₁ + m₂) = 6.13 m/s². The acceleration is less than g because the hanging mass must also accelerate the block. Swapping the masses gives 3.68.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 5: connected objects’ and ‘Block, pulley and hanging mass: solution’",
   "calc": {
    "value": 6.125,
    "unit": "m/s²",
    "sf": 3
   }
  },
  {
   "id": "L3-12",
   "type": "calc",
   "q": "For the same system, a 3.00 kg block on a frictionless table is joined by a light string over a frictionless pulley to a hanging 5.00 kg mass. What is the tension in the string?",
   "options": [
    "49.0 N",
    "18.4 N",
    "29.4 N",
    "24.5 N"
   ],
   "answer": 1,
   "exp": "Apply ΣF = ma to the block on the table: the only horizontal force is the tension, so T = m₁a = (3.00 kg)(6.13 m/s²) = 18.4 N. The tension is less than the weight of the hanging mass, 49.0 N, because that mass is accelerating downward. Setting T equal to m₂g would be correct only if the system were at rest.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 5: connected objects’ and ‘Block, pulley and hanging mass: solution’",
   "calc": {
    "value": 18.375,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-13",
   "type": "calc",
   "q": "A 40.0 kg crate is pushed across a horizontal floor at constant velocity. The coefficient of kinetic friction is 0.300. What horizontal force must be applied to the crate?",
   "options": [
    "392 N",
    "118 N",
    "12.0 N",
    "0 N"
   ],
   "answer": 1,
   "exp": "Constant velocity means zero acceleration, so the applied force equals the kinetic friction force. With n = mg on a horizontal floor, f<sub>k</sub> = μ<sub>k</sub>n = (0.300)(40.0)(9.80) = 118 N. A force of 0 N would only keep the crate at rest or let it slow down. The value 392 N is the weight, which would be the friction force only if μ<sub>k</sub> were 1.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 6: friction and the normal force’ and ‘Lecturer example: pushing a crate’",
   "calc": {
    "value": 117.60000000000001,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-14",
   "type": "misconception",
   "q": "A 30.0 kg crate rests on a rough horizontal floor with μ<sub>s</sub> = 0.600. A horizontal push of 50.0 N does not move it. What is the magnitude of the static friction force?",
   "options": [
    "176 N",
    "0 N",
    "294 N",
    "50.0 N"
   ],
   "answer": 3,
   "exp": "The crate stays at rest, so the net force is zero and the static friction force equals the push, 50.0 N. The formula f<sub>s</sub> = μ<sub>s</sub>n gives only the largest possible static friction, 176 N, which would be reached when the crate is about to slip. Static friction adjusts to the applied force up to that limit.",
   "ref": "Lecture 3 deck, slide ‘Strongest misconception of the week’ and ‘Static and kinetic friction’",
   "calc": {
    "value": 50.0,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-15",
   "type": "calc",
   "q": "A block slides down a frictionless incline that makes an angle of 35° with the horizontal. What is the magnitude of its acceleration?",
   "options": [
    "5.62 m/s²",
    "8.03 m/s²",
    "9.80 m/s²",
    "6.86 m/s²"
   ],
   "answer": 0,
   "exp": "Choose x down the slope. The weight component along the slope is mg sin θ and the normal force balances mg cos θ, so a = g sin θ = (9.80)(sin 35°) = 5.62 m/s². The acceleration is less than g and is independent of the mass. Using cosine gives the component of g perpendicular to the slope.",
   "ref": "Lecture 3 deck, slide ‘An inclined plane: choosing axes’ and ‘Sliding down an incline: solution’",
   "calc": {
    "value": 5.621049076240252,
    "unit": "m/s²",
    "sf": 3
   }
  },
  {
   "id": "L3-16",
   "type": "calc",
   "q": "A block slides down an incline of 25° with a coefficient of kinetic friction of 0.200. What is its acceleration down the slope?",
   "options": [
    "4.14 m/s²",
    "5.92 m/s²",
    "2.37 m/s²",
    "1.78 m/s²"
   ],
   "answer": 2,
   "exp": "Down the slope: mg sin θ − μ<sub>k</sub>n = ma, with n = mg cos θ. So a = g(sin θ − μ<sub>k</sub> cos θ) = 2.37 m/s². Friction acts up the slope because the block moves down it, so it is subtracted. The value 4.14 m/s² ignores friction, and 5.92 m/s² has friction pointing the wrong way.",
   "ref": "Lecture 3 deck, slide ‘Lecturer example: sliding down an incline’ and ‘Toolkit 6: friction and the normal force’",
   "calc": {
    "value": 2.3652957024670207,
    "unit": "m/s²",
    "sf": 3
   }
  },
  {
   "id": "L3-17",
   "type": "calc",
   "q": "A 900 kg car rounds a flat circular bend of radius 40 m at a steady 12 m/s. What horizontal force must the road exert on the car?",
   "options": [
    "1.30×10<sup>5</sup> N",
    "270 N",
    "3240 N",
    "8820 N"
   ],
   "answer": 2,
   "exp": "The net force must supply the centripetal acceleration: F = mv²/R = (900)(12)²/40 = 3240 N, directed towards the centre of the bend. The value 8820 N is the weight, which is vertical. Leaving out the division by R, or squaring only part of the expression, gives wrong values.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 7: circular dynamics’ and ‘Lecturer example: a flat curve’",
   "calc": {
    "value": 3240.0,
    "unit": "N",
    "sf": 3
   }
  },
  {
   "id": "L3-18",
   "type": "calc",
   "q": "A car travels round a flat circular bend of radius 60 m. The coefficient of static friction between the tyres and the road is 0.800. What is the greatest speed at which the car can take the bend without skidding?",
   "options": [
    "21.7 m/s",
    "470 m/s",
    "7.84 m/s",
    "30.7 m/s"
   ],
   "answer": 0,
   "exp": "At the limit, static friction at its maximum supplies the centripetal force: μ<sub>s</sub>mg = mv²/R. The mass cancels, so v = √(μ<sub>s</sub>gR) = 21.7 m/s. The value 470 is v² without the square root.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 7: circular dynamics’ and ‘A flat curve: solution’",
   "calc": {
    "value": 21.688706738761535,
    "unit": "m/s",
    "sf": 3
   }
  },
  {
   "id": "L3-19",
   "type": "misconception",
   "q": "A car turns left on a flat road. Which horizontal force provides the centripetal acceleration of the car?",
   "options": [
    "A centrifugal force, directed away from the centre of the turn",
    "The force of the engine, directed along the motion of the car",
    "A force of inertia that balances the friction",
    "Static friction from the road on the tyres, directed towards the centre of the turn"
   ],
   "answer": 3,
   "exp": "Centripetal means ‘towards the centre’. It is the name for the role played by a real force, here static friction. A centrifugal force does not act on the car in an inertial frame. The car’s tendency to go straight is inertia, not a force.",
   "ref": "Lecture 3 deck, slide ‘Misconception: centrifugal force’"
  },
  {
   "id": "L3-20",
   "type": "concept",
   "q": "A person stands on a bathroom scale in a lift that is accelerating upward. How does the scale reading compare with the weight mg of the person?",
   "options": [
    "The reading is equal to mg.",
    "The reading is greater than mg.",
    "The reading is less than mg.",
    "The reading is zero."
   ],
   "answer": 1,
   "exp": "The scale reads the normal force n. Taking up as positive, n − mg = ma with a > 0, so n = m(g + a), which is greater than mg. The normal force does not always equal the weight. It equals mg only when the vertical acceleration is zero.",
   "ref": "Lecture 3 deck, slide ‘Toolkit 6: friction and the normal force’"
  }
 ]
};
