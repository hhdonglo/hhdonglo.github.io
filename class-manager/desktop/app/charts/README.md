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
| `stats.js` | (shared helpers) | Mean, standard deviation, skew, quartiles, outliers, histogram bins, normal curve, correlation. Pure numbers; under 10 values is a small sample |
| `distribution.js` | How is performance spread across the class, and who stands out? | Histogram with a fitted Gaussian curve, mean and one SD either side, outlier markers; students beyond 1.5, 2 or 3 SD listed high and low, each opening the student |
| `boxplot.js` | Who is an outlier, on each measure? | One box per measure (quartiles, median, whiskers) with outlier dots that open the student |
| `scatter.js` | Does coming to class go with doing well? | One dot per student, attendance across and quiz average up; the relationship is stated in words only from 10 students |
| `days.js` | (day logic) | The class days in order (sessions and quizzes merged by date), today or the latest day first, figures per student "up to" or "on" a day |
| `panel.js` | (the dashboard panel) | Day selector with previous and next, range, measure and outlier limit; redraws only the graphs when the backend's data stamp changes (`cm:stamp`), keeping the chosen day |
| `panel.js` regions | Which students are in this part of the graph? | Click a histogram band, a box or a quarter of the scatter (or press Enter on it): the students in it are listed above the graphs, each opening the student, and the list follows the data as they change |
| `charts.css` | (styles) | Uses CM's colour tokens, so dark and light themes both work |

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

## Extra analytics charts (`explore-*.js`)

Bar charts on the Overview, Attendance, Quizzes and Questions and Students screens. Every bar is clickable and lists the students (or the questions) behind it.

| File | Job |
|---|---|
| `explore-data.js` | Builds each chart from the class statistics: score spread, change since the quiz before, who took each quiz, sessions missed in a row, practice against quiz average, results by suggested group and by teaching group, percent correct by lecture, question difficulty, question discrimination. `forScreen(screen, d, cohorts)` says which go where. |
| `explore-view.js` | One chart card: bars (the dashboard's bar drawing), caption, a table of the same numbers with n, and the list behind a clicked bar. |
| `explore-panel.js` | Mounts the cards on a screen and handles clicks and the keyboard. |

Rules: counts are not judged by size, averages are: a group of fewer than 5 students is marked small. A relation is worded as what goes together, never as a cause. A gap between teaching groups is a prompt to check conditions. Tests: `test/explore-charts.test.js`. To add a chart, write a builder in `explore-data.js` and add its key to `forScreen`.
