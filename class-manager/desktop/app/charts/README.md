# Learning Progress charts

Charts for the Learning Progress screen of the desktop app. Each file draws one kind of chart and does nothing else.

| File | Question it answers | Drawn as |
|---|---|---|
| `core.js` | (shared helpers) | Level names and colours, escaping, the "not enough evidence" sentence, the legend, the table fallback |
| `mastery-distribution.js` | On which objectives have many students not yet shown understanding? | One 100% stacked bar per objective, with student counts |
| `heatmap.js` | Which students are weak on which objectives? | Students by objectives, percentage in each cell, weakest student first; a row opens the student |
| `progress-over-time.js` | Is the class, or one student, doing better week by week? | Weekly line: class mean, median and quartile band with student counts; or a student's line over the class mean |
| `bars.js` | Where did learning move? How does a student compare with the class? Did discussion help? | Learning gain bars (latest minus first), student versus class paired bars, before and after discussion paired bars |
| `engagement.js` | Has this student been present and active? | Attendance, quizzes taken, practice attempts, with a note that these are context only |
| `charts.css` | (styles) | Uses the app's colour tokens, so dark and light themes both work |

## Rules for every chart

- A chart is a function from plain data to an HTML string. It does no calculation of its own. The figures come from the server script (`learningProgress_` in `apps_script/src/30-analytics.gs`).
- Fewer answers than the minimum is shown as "not enough evidence", never as a low score or an empty chart.
- Counts are shown beside percentages. Colour is never the only signal (numbers and labels are always present).
- Each chart offers its numbers as a table ("View as a table") for screen readers and for checking.
- `progress.js` only places the charts on the page.

## Add a chart

1. Add `charts/<name>.js` with the same header comment (question answered, how drawn, input).
2. Add its `<script>` line in `desktop/app/home.html`, after `core.js`.
3. Call it from `progress.js` (class level) or `profileHtml` (one student).
4. Add tests in `desktop/test/charts.test.js` and a row in the table above.

## Tests

`npm test` in `class-manager/desktop`; `test/charts.test.js` covers these modules.
