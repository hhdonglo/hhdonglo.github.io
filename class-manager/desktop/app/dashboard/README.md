# dashboard: the top of Class Analytics

Answers "what do I need to do today?" with rules only. No AI-written text (that is planned separately).

| File | Does |
|---|---|
| `rules.js` | Pure functions: `statCards`, `todayCard`, `setupProgress`, `priorityQueue`, `trends`, `health`, `insights`, `light`. Plain data in, plain data out. |
| `render.js` | Turns those results into HTML strings. No calculation. The top row of numbers are buttons; `riskCard` and `corrCard` hold the two charts. |
| `groups.js` | Pure functions: which students stand behind each number, bar and zone (`drills`, `riskZones`), and the linked relations with n and r (`correlations`, `pearson`). |
| `charts.js` | SVG strings only: `bars`, `risk` (scatter with three zones), `relation`. Each drawing carries a text label. |
| `interact.js` | Clicks: opens the chart behind a number, lists the students behind a bar or zone, highlights the chosen zone in the linked views, restores the choice after a refresh. |
| `dashboard.css` | Traffic-light colours (from CM's tokens) and layout. Gold stays for actions. |

Rules: a small class (under 10 students) is amber with the reason; a trend needs three points; every light has a word; names are escaped.

Inputs: the class statistics from `cmApp.stats` (same as `insights.js`), `window.cmSetup` (setup steps) and `window.cmLive` (live attendance). `insights.js` places `cmDashView.top(...)` above the existing overview.

Change a threshold: edit `rules.js` (`MIN_STUDENTS`, the numbers in `statCards`, `priorityQueue`), then update `test/dashboard.test.js`.


Charts first, tables only as the drill-down behind a chart or number (Hope, 2026-11-12). Every number, bar and zone lists its students; the lists stay on the lecturer's screen and never go to the projector view. A relation is always shown with n and r and the words "association, not proof of cause"; under 5 students it is not drawn. Practice is optional work, so "no practice recorded" never flags a student on its own (`apps_script/src/30-analytics.gs`).

Change the zone lines: the thresholds in Teaching insights (`effort` for attendance, `perf` for quiz average). Add a relation: one entry in `correlations()` in `groups.js`, then a test in `test/dashboard-refresh.test.js`.
