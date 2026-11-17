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
| `topics-model.js` | Topic part, pure: mastery bars, topic by quiz grid, class trend, correlations (Pearson r with n, a caution when n is under 30 or the link is under 0.3, nothing under 10 pairs) and the topic insights (real numbers only). | change a cut-off or a sentence |
| `topics-panels.js`, `topics.css` | Draws the topic panels under the first grid: Topic mastery, Mastery by topic over time, What goes with what. Green, gold and red appear only as mastery bands. | change a panel |
| `icons.js`, `util.js` | Line icons; escaping, rounding, colours. |
| `sections.js` | Places the page's pieces under section headings (Overview, Attendance, Quizzes, Risk and attention, Questions, Relationships and trends, Actions, Privacy and records) once each, with a row of jump links. Empty sections are left out. |
| `render.js` | Puts the panels together (`html`) and exposes each panel so it can be redrawn alone. No calculation. |
| `interact.js` | Tabs, the topic/group switch, bar and slice clicks (opens the students through `cmDashInteract.open`), redraw when lecture progress arrives (`cm:lecture`). |
| `board.css` | Layout and the white panel look. Narrow windows stack the panels. |

Every metric on the page appears once, in one section (`insights.js` `overview()` collects the pieces, `sections.js` places them). Section content: Overview (KPIs, lecture plan, progress, breakdown, ranked topics, insights, class health, is the class learning, this week summary), Attendance (missed in a row, sessions not counted), Quizzes (spread numbers, Class graphs with outliers and the normal curve, who took each quiz, change since the quiz before, practice and quiz average, quiz average by group), Risk and attention (who is at risk and why, who needs attention zones), Questions (difficulty, discrimination, questions to review, concepts), Relationships and trends, Actions (areas to target, support given, results by group, today and setup), Privacy and records. Charts from `app/charts/explore-*.js` and `app/analytics/` are shown by section: `forScreen("ov-attendance" | "ov-quizzes" | "ov-risk" | "ov-questions")` and `cmAnalyticsPanel.mountInto({ summary, questions, actions, privacy })`. Inside a section every `.card` is white (`board.css` sets the colour tokens on the card), so older charts take the same look without being rewritten.

**At risk** counts only students with a solid reason; flags on thin evidence (fewer than 4 sessions or 2 quizzes) are named separately. **Sessions with no check-ins** are treated as not held (`rules/class-stats.js`, `attendance.notHeld`), so a test or abandoned session cannot drag every rate down or flag the whole class; the Attendance section says which were set aside. The deprecated Apps Script copy does not do this.

Where it plugs in: `insights.js` (`overview()`) draws the board first and then the older sections. `lecture-progress.js` sets `window.cmLecture` and fires `cm:lecture` when the plan changes. The old lecture card keeps the verdict and the corrections; its numbers and bar are hidden while the board shows them (`body.has-board`).

Empty state: every panel still draws, with ghost bars, a grey ring and one plain sentence saying what to do. A class with 140 students draws the same few dozen marks, so it stays fast. Student lists stay on the lecturer's screen.

Change a chart: edit its module and `test/board.test.js`. Add a progress tab: one entry in `progress()` in `model.js`. Add a KPI: one entry in `kpis()` (and a drill in `dashboard/groups.js` if it should open students). Screenshots: `node tools/board-screenshots.js <folder> [dark|light]` (made-up class, no real data).

## Dashboard layout (2026-11-17)
KPI row on top, a thin tab bar (Overview, Attendance, Quizzes, Risk and attention, Questions, Relationships and trends, Actions), then one grid of cards for the chosen tab, like the reference: two to three cards per row, one column when narrow. `sections.js` builds the tabs and panes; `interact.js` `pane()` shows one pane and hides the rest without redrawing. Privacy and records stay below every tab. The list of students behind a clicked number (`#ddrill`) sits under the tab bar so it shows on every tab.
`shares.js` holds the numbers for the donuts (attendance present or absent, quiz average bands, why students are flagged, topic mastery bands); `render.js` draws them as cards (`shareCard`). Topic panels from `topics-panels.js` are placed in Questions and Relationships by `topicCards`.

## Compact, arrangeable layout (2026-11-17)
- Top row: `strip.js` draws the lecture plan as a small donut, a bar with an expected-by-today marker, a state badge and chips (due, next, missed); the sentences are tooltips. `lecture-progress.js` renders it and `insights.js` moves it beside the five small KPI tiles (their notes are tooltips).
- Each tab is a 12 column grid. Short cards fill the space under each other (masonry: `arrange.js` gives each card the number of 8 pixel rows its height needs). Default widths and the rule "charts first, text-heavy cards last" are in `layout.js`.
- Arrange cards (button beside the tabs): drag a card or use its buttons to move it earlier or later, make it narrower, wider, shorter or taller, or hide it; drag the corner to resize. Hidden cards are listed so they can be shown again. Done ends the mode; Reset layout restores the defaults. Choices are saved per course in this computer's browser storage (`cm.board.layout.<course>`), never sent anywhere.
- Captions under charts (`.bd-foot`, `.ch-cap`) are turned into an info icon with the text as a tooltip. A card with nothing to show is one line (`bd-slim`, no empty donut).
- Check: `CM_ARRANGE_CHECK=1 node tools/board-screenshots.js <folder>` clicks through move, resize, hide, show, reload and reset.
