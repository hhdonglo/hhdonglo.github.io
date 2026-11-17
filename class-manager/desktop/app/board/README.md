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
| `render.js` | Puts the panels together (`html`) and exposes each panel so it can be redrawn alone. No calculation. |
| `interact.js` | Tabs, the topic/group switch, bar and slice clicks (opens the students through `cmDashInteract.open`), redraw when lecture progress arrives (`cm:lecture`). |
| `board.css` | Layout and the white panel look. Narrow windows stack the panels. |

Where it plugs in: `insights.js` (`overview()`) draws the board first and then the older sections. `lecture-progress.js` sets `window.cmLecture` and fires `cm:lecture` when the plan changes. The old lecture card keeps the verdict and the corrections; its numbers and bar are hidden while the board shows them (`body.has-board`).

Empty state: every panel still draws, with ghost bars, a grey ring and one plain sentence saying what to do. A class with 140 students draws the same few dozen marks, so it stays fast. Student lists stay on the lecturer's screen.

Change a chart: edit its module and `test/board.test.js`. Add a progress tab: one entry in `progress()` in `model.js`. Add a KPI: one entry in `kpis()` (and a drill in `dashboard/groups.js` if it should open students). Screenshots: `node tools/board-screenshots.js <folder> [dark|light]` (made-up class, no real data).
