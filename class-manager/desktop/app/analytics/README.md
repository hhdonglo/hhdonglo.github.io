# Analytics (app/analytics/)

Cards on the Overview that say how far a number can be trusted and what to do next. Each file has one job. All are plain data in, plain data out, so a non-specialist can change a threshold in one place.

| File | Job | Change here to |
| --- | --- | --- |
| evidence.js | Evidence label (Too little, Low, Medium, High) from the number of students and the share of the class covered | change the cut-offs 5, 10 and 30 |
| items.js | Item analysis: which questions to review, very hard or very easy (needs 10 answers) | change MIN or the 20% and 90% limits |
| concepts.js | Topic status (revisit under 60%, secure from 80%, too early under 30 answers), live against practice | change REVISIT |
| interventions.js | Support given: later quiz change for students given it against students whose earlier results were similar (within TOLERANCE points; with none, everyone else, and the card says so), worded as an association; the card also holds the form that records support | change TOLERANCE or the wording |
| fairness.js | Results by teaching group (the Group column); needs groups of 10; a gap of 10 points is flagged as a prompt to check conditions | change GAP or MIN_GROUP |
| render.js | The HTML of each card | change a card's words |
| panel.js | Fetches the extra data, assembles the cards, and holds the Privacy and records card | add a card |

Data outside the class statistics comes from `extras.js` (groups and support given). The records side is `governance.js` (audit log, export, erase, term close). The weekly summary is `summary.js`. Tests: `test/analytics.test.js`, `test/governance.test.js`, `test/summary.test.js`.

Rules kept throughout: no personal characteristics are used; a gap or change is an association, never a cause; a small group is labelled, not judged; CM never sends student names or answers anywhere.
