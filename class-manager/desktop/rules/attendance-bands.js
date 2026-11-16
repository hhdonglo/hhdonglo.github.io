/* Who comes to class and who does not: the class split by attendance rate.
   One responsibility: take the student rows from class-stats and return the bands, each with its count, its share of the students counted, and its students (ID and name).
   Students with no counted session are left out (they have no record yet). Pure. */
"use strict";

const BANDS = [
  { key: "always", label: "Every session", test: (p) => p === 100 },
  { key: "regular", label: "Regular (75% to 99%)", test: (p) => p >= 75 && p < 100 },
  { key: "some", label: "Occasional (40% to 74%)", test: (p) => p >= 40 && p < 75 },
  { key: "rare", label: "Rarely (under 40%)", test: (p) => p > 0 && p < 40 },
  { key: "never", label: "Never attended", test: (p) => p === 0 }
];

function attendanceBands(students) {
  const counted = students.filter((s) => s.sessions > 0 && s.attendance !== null && s.attendance !== undefined);
  const byName = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
  const bands = BANDS.map((b) => {
    const list = counted.filter((s) => b.test(s.attendance)).map((s) => ({ id: s.id, name: s.name || "", attendance: s.attendance, present: s.present, sessions: s.sessions, missedInARow: s.missedInARow })).sort((a, c) => a.attendance - c.attendance || byName(a, c));
    return { key: b.key, label: b.label, count: list.length, pct: counted.length ? Math.round(1000 * list.length / counted.length) / 10 : null, students: list };
  });
  return { counted: counted.length, bands, attending: bands.filter((b) => b.key !== "never").reduce((n, b) => n + b.count, 0), never: bands[bands.length - 1].count };
}

module.exports = { attendanceBands, BANDS };
