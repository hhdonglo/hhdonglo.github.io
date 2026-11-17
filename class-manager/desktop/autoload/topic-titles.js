// Cleans the lecture titles read from a course outline or a tutorial sheet ("Week 3: Work and Kinetic Energy - Tutorial Sheet").
// One responsibility: raw lines in, a usable title or null out. Pure: no file access. Used by course-details.js.
"use strict";

const CONNECTOR = /(?:^|\s)(?:of|and|the|to|in|for|a|an|on|with|from|by|or|as|at)$/i; // a title that ends here is cut off
const SUFFIX = /\s*[-–—:]\s*(?:tutorial|problem|exercise|worksheet|practice)(?:\s+(?:sheet|set|questions?))?\.?$/i;

// A line that is cut off at the end continues on the next line: "Thermal Proper-" + "ties" or "The Second Law of" + "Thermodynamics".
function joinWrapped(title, next) {
  if (!next) return title;
  const n = String(next).trim();
  if (!n || /^(?:week|lecture)\s+\d/i.test(n) || n.length > 80) return title;
  if (/[a-z]-$/.test(title)) return title.slice(0, -1) + n.split(/\s+/)[0] + (n.split(/\s+/).length > 1 ? " " + n.split(/\s+/).slice(1).join(" ") : "");
  if (CONNECTOR.test(title)) return title + " " + n;
  return title;
}

// -> the cleaned title, or null when the text is not a title (a sentence fragment, an arrow chain, a cut-off phrase, too short).
function cleanTitle(raw, next) {
  let t = joinWrapped(String(raw || "").trim().replace(/\s+/g, " "), next).replace(SUFFIX, "").replace(/[.\s]+$/, "").trim();
  if (t.length < 4 || t.length > 100) return null;
  if (/^[a-z]/.test(t)) return null;          // starts in lower case: the middle of a sentence ("a collision")
  if (/[→>]|->/.test(t)) return null;          // an arrow chain, not a name
  if (/-$/.test(t) || CONNECTOR.test(t)) return null; // still cut off after joining
  return t;
}

module.exports = { cleanTitle, joinWrapped };
