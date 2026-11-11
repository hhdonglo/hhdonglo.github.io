# dashboard: the top of Class Overview

Answers "what do I need to do today?" with rules only. No AI-written text (that is planned separately).

| File | Does |
|---|---|
| `rules.js` | Pure functions: `statCards`, `todayCard`, `setupProgress`, `priorityQueue`, `trends`, `health`, `insights`, `light`. Plain data in, plain data out. |
| `render.js` | Turns those results into HTML strings. No calculation. |
| `dashboard.css` | Traffic-light colours (from CM's tokens) and layout. Gold stays for actions. |

Rules: a small class (under 10 students) is amber with the reason; a trend needs three points; every light has a word; names are escaped.

Inputs: the class statistics from `cmApp.stats` (same as `insights.js`), `window.cmSetup` (setup steps) and `window.cmLive` (live attendance). `insights.js` places `cmDashView.top(...)` above the existing overview.

Change a threshold: edit `rules.js` (`MIN_STUDENTS`, the numbers in `statCards`, `priorityQueue`), then update `test/dashboard.test.js`.
