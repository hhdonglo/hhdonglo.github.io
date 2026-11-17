# rules/topics: topic mastery

How well each lecture topic is understood, for the class and for one student. JavaScript only (the Apps Script copy does not have it; the Apps Script path is deprecated). Pure functions over the tabs CM keeps; nothing is estimated and no student data leaves the computer.

| File | One job | Change here to |
|---|---|---|
| `map.js` | Which topic and concept each question belongs to. Topic is the lecture in the question id (`L3-07` is Lecture 3), titled from `data/lectures.json`. Concept is the bank's own `concept`, `topic` or first `tags` field, otherwise the slide named in quotes in `ref`, otherwise none. A question with no lecture has no topic and is counted as unmapped, never guessed. | change how a question finds its topic or concept |
| `evidence.js` | The list of answers behind every figure: released live answers, each student's latest full practice attempt for a lecture, the latest mock exam. Class view counts only students on the class list; a student's own view takes only their ID. A blank is not an answer. | change which answers count |
| `mastery.js` | Bands (well mastered 70 or more, developing 50 to 69, needs attention under 50, too early below 10 class answers or 3 of a student's own), students per band, hardest and easiest questions, common wrong answers (a quarter or more of at least 8 live answers), per quiz, over time, per student, and a student's own advice. All cut-offs are constants at the top. | change a cut-off or a sentence of advice |
| `index.js` | `classTopics(store, o, quizOrder)` and `studentTopics(store, o, id)`. | add an output |

Where it plugs in: `class-stats.js` adds `topics` to the class statistics (Quizzes and Questions, Class Analytics); `progress.js` `portalExtras` adds `topics` to My results (the student's own only). A failure in topics never fails the statistics: `topics` is then null and `topicsError` says so.

A quiz imported as totals (no Item_Log rows) has no per-quiz topics, and the page says so instead of inventing them.

Tests: `test/topics.test.js` (map, bands, per quiz, over time, student view, evidence rules, at risk), `test/topics-views.test.js` (the three pages), `test/progress-parity.test.js` (My results carries only the student's own topics).
