# board: the chart board at the top of Class Analytics

White chart panels on CM's dark navy and gold page (Hope, 2026-11-17). Orange and gold are the accents; red and green appear only where they carry meaning (a fall, a rise, behind plan). The panels set their own colours, so they look the same in CM's dark and light themes. All charts are inline SVG drawn here: no library, no CDN, no internet.

| File | Does |
|---|---|
| `model.js` | Pure functions: `kpis`, `plan`, `progress`, `topicDonut`, `groupDonut`, `ranked`, `findings`. Class statistics (and lecture progress) in, plain data out. A number that cannot be worked out is null and the panel says so. |
| `kpi.js` | The five KPI cards (buttons with a trend arrow). They carry `data-drill`, so `dashboard/interact.js` opens the students behind them. |
| `donut.js` | One donut and its legend. Used for the lecture plan (held, behind plan, still to come) and the category breakdown. |
| `barline.js` | Bars with a line over them and optional dashed plan lines. Used for attendance per session, quiz average per quiz and lectures held against the plan. |
| `ranked.js` | The ranked table of topics needing attention (lowest first, growth arrow from the gain on repeated questions). |
| `findings.js` | The Insights panel: sentences from `model.findings`, never written by AI. |
| `icons.js`, `util.js` | Line icons; escaping, rounding, colours. |
<<<<<<< HEAD
| `sections.js` | Places the page's pieces under section headings (Overview, Attendance, Quizzes, Risk and attention, Questions, Relationships and trends, Actions, Privacy and records) once each, with a row of jump links. Empty sections are left out. |
=======
>>>>>>> 0cc9a42560f666d645a25f88f211af393e263608
| `render.js` | Puts the panels together (`html`) and exposes each panel so it can be redrawn alone. No calculation. |
| `interact.js` | Tabs, the topic/group switch, bar and slice clicks (opens the students through `cmDashInteract.open`), redraw when lecture progress arrives (`cm:lecture`). |
| `board.css` | Layout and the white panel look. Narrow windows stack the panels. |

<<<<<<< HEAD
Every metric on the page appears once, in one section (`insights.js` `overview()` collects the pieces, `sections.js` places them). Section content: Overview (KPIs, lecture plan, progress, breakdown, ranked topics, insights, class health, is the class learning, this week summary), Attendance (missed in a row, sessions not counted), Quizzes (spread numbers, Class graphs with outliers and the normal curve, who took each quiz, change since the quiz before, practice and quiz average, quiz average by group), Risk and attention (who is at risk and why, who needs attention zones), Questions (difficulty, discrimination, questions to review, concepts), Relationships and trends, Actions (areas to target, support given, results by group, today and setup), Privacy and records. Charts from `app/charts/explore-*.js` and `app/analytics/` are shown by section: `forScreen("ov-attendance" | "ov-quizzes" | "ov-risk" | "ov-questions")` and `cmAnalyticsPanel.mountInto({ summary, questions, actions, privacy })`. Inside a section every `.card` is white (`board.css` sets the colour tokens on the card), so older charts take the same look without being rewritten.

**At risk** counts only students with a solid reason; flags on thin evidence (fewer than 4 sessions or 2 quizzes) are named separately. **Sessions with no check-ins** are treated as not held (`rules/class-stats.js`, `attendance.notHeld`), so a test or abandoned session cannot drag every rate down or flag the whole class; the Attendance section says which were set aside. The deprecated Apps Script copy does not do this.

=======
>>>>>>> 0cc9a42560f666d645a25f88f211af393e263608
Where it plugs in: `insights.js` (`overview()`) draws the board first and then the older sections. `lecture-progress.js` sets `window.cmLecture` and fires `cm:lecture` when the plan changes. The old lecture card keeps the verdict and the corrections; its numbers and bar are hidden while the board shows them (`body.has-board`).

Empty state: every panel still draws, with ghost bars, a grey ring and one plain sentence saying what to do. A class with 140 students draws the same few dozen marks, so it stays fast. Student lists stay on the lecturer's screen.

Change a chart: edit its module and `test/board.test.js`. Add a progress tab: one entry in `progress()` in `model.js`. Add a KPI: one entry in `kpis()` (and a drill in `dashboard/groups.js` if it should open students). Screenshots: `node tools/board-screenshots.js <folder> [dark|light]` (made-up class, no real data).
