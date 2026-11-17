# app/topics: the Topics panel on Quizzes and Questions

`quiz-panel.js` draws the Topics card under the quiz statistics: a mastery bar for each topic (green well mastered, gold developing, red needs attention), who is in each band, the well mastered and weak topics, the hardest and easiest questions and the common wrong answers. Two tabs: this quiz, and the whole semester. A quiz with no question-by-question record (imported as totals) says so and shows no topics. It lays out the `topics` block of the class statistics (`rules/topics`) and calculates nothing. `topics.css` styles it.

Change the wording or layout in `quiz-panel.js`; change a cut-off in `rules/topics/mastery.js`. Test: `test/topics-views.test.js`. Screenshots: `node tools/topics-screenshots.js <folder>`.

The student side is `assets/my-topics.js` (My results in the portal).
