/* Course content for the pedagogy tests and previews: five lectures with learning objectives and five-question banks whose IDs match
   the made-up class in sample-class.js (L1-Q1 to L4-Q5, plus lecture 5 for a live quiz with a second vote). Nothing here is real. */
"use strict";

const OUTCOMES = {
  1: ["Convert quantities between SI units and prefixes", "Estimate orders of magnitude for physical quantities", "Combine measurement uncertainties in sums and products"],
  2: ["Resolve vectors into components", "Add vectors by components and find the resultant"],
  3: ["Calculate displacement and velocity from a motion graph", "Apply the constant-acceleration equations to straight-line motion"],
  4: ["Analyse projectile motion as two independent motions", "Calculate the range and maximum height of a projectile"],
  5: ["Draw free-body diagrams for objects in equilibrium", "Apply Newton's second law to connected bodies", "Explain friction as a force opposing relative motion"]
};
const KEYS = [1, 3, 0, 2, 4]; // B, D, A, C, E: the same keys as the sample class's live quizzes
const STEMS = {
  1: ["Convert 3.2 km to metres using SI prefixes.", "Estimate the order of magnitude of the number of heartbeats in a lifetime.", "A length is 2.0 ± 0.1 m and a width 3.0 ± 0.1 m. What is the uncertainty in the sum?", "Which prefix means 10^-6 for SI units?", "Combine the uncertainties for the product of two measurements."],
  2: ["Resolve a 10 N force at 30° into components.", "Find the resultant of two vectors added by components.", "What is the x component of a vector of length 5 at 90°?", "Add vectors (3, 4) and (1, -2) by components.", "Which pair of components describes the resultant?"],
  3: ["From the velocity graph, calculate the displacement in 4 s.", "Which motion graph shows constant velocity?", "Apply v = u + at to a car accelerating at 2 m/s².", "A ball falls from rest. Use the constant-acceleration equations to find its speed after 3 s.", "Read the velocity from the slope of the displacement graph."],
  4: ["A projectile is launched horizontally. Which motion is independent of the other?", "Calculate the range of a projectile launched at 20 m/s and 45°.", "At maximum height, what is the vertical velocity of a projectile?", "Calculate the maximum height for a launch speed of 10 m/s straight up.", "Why are horizontal and vertical motion of a projectile independent?"],
  5: ["Draw the free-body diagram of a book resting on a table in equilibrium.", "Two connected bodies are pulled by 12 N. Apply Newton's second law to find the acceleration.", "Friction opposes which motion?", "Which forces act on a hanging lamp in equilibrium?", "Find the tension between connected bodies of 2 kg and 4 kg."]
};

function lecturesJson() {
  return { course_title: "Sample course", contacts: [], groups: [{ id: "lectures", title: "Lectures", lectures: Object.keys(OUTCOMES).map((n) => ({ number: Number(n), title: "Lecture " + n, status: "available", outcomes: OUTCOMES[n] })) }] };
}
function bank(n) {
  return { title: "Lecture " + n, questions: STEMS[n].map((q, k) => ({ id: "L" + n + "-Q" + (k + 1), q, options: ["Option A", "Option B", "Option C", "Option D", "Option E"].slice(0, 5), answer: KEYS[k], exp: "", type: "concept", difficulty: "medium" })) };
}
// For createBackend({readSite}): the course files the script reads.
function readSite(p) {
  p = "/" + String(p || "").replace(/^\/+/, "");
  if (p === "/data/lectures.json") return JSON.stringify(lecturesJson());
  const m = /^\/quizzes\/lecture(\d+)\.json$/.exec(p);
  if (m && STEMS[m[1]]) return JSON.stringify(bank(m[1]));
  if (p === "/apps_script/live_quizzes.json") return JSON.stringify({ weeks: { 5: "Lecture 5" } });
  return null;
}
module.exports = { OUTCOMES, KEYS, lecturesJson, bank, readSite };
