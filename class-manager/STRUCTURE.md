# Class Manager: structure and review notes

**Current version: 0.24.1**

Written 9 November 2026. A description of the class management tool as it stands in this folder, for review of the tool and of the course it serves.

**Update, later on 9 November 2026.** Following the review, the package gained learning support; see "Learning support" in README.md. Of the gaps listed below, these are now closed: the own-results lookup needs a personal access code; the live quiz draw changes with each new workbook; every live answer is kept per question (Item_Log), so per-question statistics are computed; practice attempts record the questions asked. Four private tabs were added: Item_Log, Access_Codes, Question_Stats and Groups. Group marks now exist (groups.html), so "no group marks" below no longer holds.

**Further update, 9 November 2026.** The desktop app gained a resource library with search, summaries, question generation with Claude, question import and a review queue (desktop/README.md, "Resources and questions"); the server script gained a course calendar, messages with moderation, and announcements (README.md, "Calendar, messages and announcements"). Line counts below describe the script before these additions.

## Purpose and architecture

The class management tool runs one course from three layers: static pages that students and the lecturer open in a browser, one server script that holds every rule, and a private workbook that stores every record. It serves PHYS 143 (12 lectures plus an introduction, 347 practice questions) and is built so that the course content can be replaced.

- **Pages** (HTML and JavaScript, no framework): the student portal, course and lecture pages, practice quizzes, mock exam, live quiz pages, attendance pages, lecturer menu and Control Centre. They read the question banks and course data as JSON files.
- **Password** (`password.html`, `assets/password.js`, `apps_script/src/06-password.gs`): choose, change and recover the password. See README.md, "Password".
- **Server script** (`apps_script/quiz_receiver.gs`, built from the modules in `apps_script/src/` by `apps_script/build.js`): every live action goes through it, with `doGet` for reads (JSONP) and `doPost` for submissions. It checks the host key, scores answers, records attendance and rebuilds the mark tabs.
- **Workbook**: the tabs listed under Data model. In the website version it is the Google Sheet "PHYS 143 Quizzes (Responses)". In the desktop app it is a file on the lecturer's computer.

The same script runs in two places. On the website it is a Google Apps Script web app bound to the Sheet. In the desktop app (`desktop/backend.js`) it runs unchanged inside Node, against a local workbook, with the Google services it uses provided locally. The pages do not know which one they talk to: `config.js` gives them one address (`scriptUrl`).

## Components

Eleven components make up the tool. The ones students use need no key; the lecturer's need the host key. The pages are listed by their names in `class-manager/`, and the site names in brackets.

| Component | Page or file | Who uses it | What it does |
| --- | --- | --- | --- |
| Student portal | `index.html` (`phys143-portal.html`) | Students | This week's lecture and handout, check-in, the live quiz, and "My results" (own check-ins and quiz scores by student ID). The current week is set in `data/portal.json` or from the Control Centre. |
| Course page | `course.html` (`phys143.html`) | Students | Overview, weekly programme in three groups (Introduction, Mechanics, Thermal physics), mock exam card. Drawn from `data/lectures.json` and `data/pages/phys143.json`. |
| Lecture pages | `lecture-N.html`, `introduction.html` | Students | Summary, learning objectives, three weekly contacts, and buttons for slides, handout, supplement, tutorial and practice. |
| Practice quizzes | `lecture-N-practice.html` (11 lectures plus the introduction; none for lecture 6) | Students | 20 questions drawn from the lecture's bank, feedback after each answer, a retry of the missed questions. Progress is kept in the browser. An optional student ID sends the score to the workbook. |
| Mock exam | `mock-exam.html` | Students | 50 questions drawn from past examination questions across all banks, 2 hours 30 minutes, answers shown only at the end. |
| Live quiz | `quiz.html` (students), `quiz-host.html` (dashboard), `quiz-display.html` (projector) | Students and lecturer | Lecturer-paced quiz of 5 to 20 questions from the week's bank, 60 seconds per question by default, results and class ranking on release, then a question-by-question review. |
| Attendance | `attend.html` (students), `attendance.html` (lecturer) | Students and lecturer | A QR code whose link changes every 30 seconds; students enter only their ID. Lecturer start-up is one Start button and one tick box ("Only students in the room can check in"); radius and a typed classroom position are under More options. Stop, then submit, writes the day's column. |
| Lecturer menu | `lecturer.html` | Lecturer | One login with the host key, then Run quiz or Take attendance. |
| Control Centre | `control.html` | Lecturer | Six panels: Today's lecture, Pre-class check, Attendance, Class list, Live quiz, After class. Class list edits one ID at a time and "Tidy to class list". |
| Question banks | `quizzes/lectureN.json`, written by `tools/quiz_src/lectureN.py` | Lecturer | One bank per lecture, read by practice, mock exam and live quiz alike. |
| Server and workbook | `apps_script/quiz_receiver.gs`; Google Sheet or `desktop/` local workbook | Both, indirectly | Holds the rules and the records (Data model). |

The desktop app (`desktop/`) adds a home screen for the lecturer: the student address and its QR code, the host key, class list import, a viewer for every tab, Excel and CSV export, an Excel class list template, and optional Google sign-in that copies the tabs to a Sheet in the lecturer's own Drive.

## Data flow in a class session

A session moves records through three holding places before they reach the marks: a log of raw events, a held stage, and the mark tabs. Nothing reaches Master or Scores until the lecturer releases or submits it.

**Attendance**

1. The lecturer opens attendance. The script creates a session in Attendance_Control with a fresh random code that has never been used, and a secret for the QR link. The class list (Roster) must not be empty.
2. The QR link carries a token derived from the secret and the current 30-second slot; the two previous slots are also accepted.
3. A student scans and enters an ID. The page sends the ID, the token and a device token. The script logs a row in Attendance_Log (time, session, ID, on roster yes or no, a hash of the device). An ID not on the roster goes to Not_On_List and the student is told to see the lecturer. A second check-in on the same day adds nothing.
4. Close attendance stops check-ins and adds devices that checked in more than one ID to Attendance_Flags.
5. Submit attendance writes the session's column in Attendance: 1 for present, 0 for every other ID on the roster.

**Live quiz**

1. The lecturer chooses the join code (`2627` plus the week number), the week and the number of questions, and opens the lobby. Students join with first name, ID and code (Presence).
2. Start draws the questions from the week's bank. Next question moves the whole class on. Each answer is stored as given in Answers; the last answer to a question wins.
3. End quiz compiles each student's answers, marks them on the server and places one row per student in Staged_Quiz. Answer letters never reach the page.
4. Release results copies the held rows to Form Responses 1, then updates Master and Scores and rebuilds Totals. Students then see their score, the class ranking (first names only) and, during Review, each question with the correct option and the class spread.

**Practice and mock exam**

A student who types an ID on a practice page or the mock exam sends each finished attempt to the Attempts log. These reach Master and Scores at the next release, and only for IDs on the roster. A run of only the missed questions is not recorded.

## Data model

The workbook has up to 21 tabs, created by `setup` or on first use. Student IDs are the key that joins them; names appear only in Roster, Master, Totals, the quiz tabs and the optional Attendance_Named view.

| Tab | Kind | One row per | Holds |
| --- | --- | --- | --- |
| Key | Settings | Join code | Join codes, optional fixed answer letters and ranking mode; host key (J2, stored as a salted hash once changed); Totals mode Best or Latest (K2); Master on or off (L2) |
| Roster | Class list | Student | Student ID, optional name |
| Quiz_Control | State | Lecturer-controlled quiz | Status, timing, current question, seconds per question, round, week, number of questions, chosen question IDs, when to show score and ranking |
| Presence | Log | Join | Who joined which quiz, and when they submitted |
| Answers | Log | Answer | ID, first name, code, question number, answer letter, round |
| Staged_Quiz | Held | Student per quiz | Marked results waiting for Release |
| Form Responses 1 | Record | Scored attempt | Timestamp, first name, ID, code, Q1 to Q5, score, round, number of questions, answers, week |
| Explanations | Settings | Question | Optional override of a bank explanation |
| Attendance_Control | State | Session | Code, label (date and #n), status, opened, closed, link secret |
| Attendance_Log | Log | Check-in | Time, session, ID, on roster, device hash, location |
| Attendance | Record | Student | One column per session: 1 present, 0 absent |
| Not_On_List | Log | Unknown ID | IDs that checked in but are not on the roster |
| Attendance_Flags | Log | Flag | Devices used for more than one ID, and location notes |
| Attendance_Named | View | Student | Attendance with names beside the marks, built on request |
| Attempts | Log | Practice or mock attempt | Timestamp, ID, quiz, attempt number, score, total, seconds taken, IDs of the questions answered wrongly |
| Reports | Log | Report | Problems reported by students on a question |
| Master | Marks | Student | ID, name, last updated, one column per quiz (Week N, Practice N, Practice Intro, Mock exam) as "score / out of" |
| Scores | Marks | Student | ID, total, out of, average %, one column per quiz as a number; three header rows (heading, key, out of); every rostered ID has a row |
| Totals | Marks | Student | ID, first name, quizzes taken, one column per live quiz, total, out of, average % |
| Log | Audit | Event | Every submission outcome and lecturer action |

## How marks are computed

**Live quiz.** Each question is marked right or wrong against the bank; the score is the number correct out of the number of questions set (5 to 20). Only the first submission per student ID and join code in a round counts; a later submission is logged and ignored. A submission up to 15 seconds after the deadline is still accepted, to allow for network delay. Every result waits in Staged_Quiz until the lecturer presses Release, which copies it to Form Responses 1 and updates Master, Scores and Totals; Discard clears it. The settings show_score and show_leaderboard (Immediate, On release or Never) decide only when students see their score and the ranking, not when the result enters the record.

**Totals.** Rebuilt from Form Responses 1 by `refreshTotals`. There is one column per week and join code. If a student has more than one counted result for the same quiz (for example after a rerun round), the Key setting K2 decides: Best keeps the highest proportion score / n, Latest keeps the most recent. Total and Out of are sums over the columns; Average % is Total / Out of, rounded to 0.1.

**Practice and mock exam.** Students may attempt these any number of times. Each attempt is recorded in Attempts with its score, time taken and the IDs of the questions answered wrongly. When the lecturer releases, the latest attempt per student and quiz is written to Master and Scores, for rostered IDs only.

**Master.** One cell per student and quiz, written as "score / out of". A newer result overwrites the older one. Master can be switched off in Key L2.

**Scores.** The same results as plain numbers, for spreadsheet work. Total, Out of and Average % count live quizzes only; practice and mock results are shown but do not enter the total.

**Attendance.** 1 for present and 0 for absent, one column per submitted session. Only the first check-in per ID per day counts. There is no attendance percentage or weighting in the workbook.

**What is not computed.** There is no final course mark, no weighting between quizzes, attendance and examinations, no grade boundaries and no group marks. These are left to the lecturer's own spreadsheet.

## Files and configuration

```
class-manager/
  config.js                 course code, title, institution, Apps Script address
  index.html                student portal
  course.html               course overview and weekly programme
  introduction.html, lecture-N.html            lecture pages (N = 1 to 12)
  introduction-practice.html, lecture-N-practice.html   practice quizzes (none for lecture 6)
  mock-exam.html            mock exam from past examination questions
  quiz.html, attend.html    student pages: live quiz, attendance check-in
  lecturer.html             lecturer login and menu (host key)
  quiz-host.html, quiz-display.html   quiz dashboard and projector view
  attendance.html           open, close and submit attendance; rotating QR code
  control.html              Control Centre: class list, results, tidy to class list
  data/                     lectures.json, portal.json, pages/course.json, site.json (empty course)
  templates/                lecture and practice page templates
  course-packs/phys143/     the PHYS 143 course pack source (lecture pages, PDFs, banks, data, bank tools)
  apps_script/              quiz_receiver.gs (generated), src/ (its modules), build.js, live_quizzes.json
  assets/                   render.js, styles, QR library, KaTeX, icons
  desktop/                  the desktop app: main.js, backend.js, course.js (course folder and packs), table.js (reads class list files), excel.js (writes Excel workbooks), xlsx-book.js, import-values.js, import-specs.js, import-plan.js, import-apply.js and import-ipc.js (the web import: see desktop/IMPORT.md), dashboard/ in desktop/app (rules.js and render.js build the Today card, setup tracker, stat cards, priority queue, trends, health and insights: see its README), attendance-guard.js (check-in location range and same-network rule: see its header), autoload-ipc.js and autoload/ (categories.js, summary.js and records-view.js file records by category and show the import summary and student history, course-details.js finds course details in loaded files, oversize.js flags a class list far bigger than the other files; load data from a folder in any layout: see desktop/autoload/README.md), names.js (first and last names: join, split, name columns in exports), linked-folder.js (encrypted copies in a synced folder), storage-providers.js, sync/ (merge.js, records.js, materials.js, course-sync.js), storage/ (WebDAV, GitHub, Dropbox, S3 providers), preload.js, app/linked-folder.js (the Link storage card), app/home.html, app/setup.html, package.json
```

**Configuration points**

| Where | Setting | Effect |
| --- | --- | --- |
| config.js | courseCode, courseTitle, institution | Labels in the header and footer of every page |
| config.js | scriptUrl | Address of the server; in the app it is written automatically as this computer's address |
| data/portal.json | current week, contact times, handouts | What the portal shows this week |
| data/lectures.json | programme, titles, summaries, PDF paths | Every lecture page and the weekly programme |
| apps_script/live_quizzes.json | weeks | Which banks the live quiz may draw from |
| quiz_receiver.gs, top | SITE, attendance mode and radius, notification email | Web version only; the app overrides them (location off, no email) |
| Key tab | J2, K2, L2 | Host key, Totals mode (Best or Latest), Master on or off |
| Quiz dashboard | duration, seconds per question, mode, number of questions, week, show score, show ranking | Per quiz, chosen before it starts |
| App, Settings | course code, title, institution | Labels |
| App data folder | settings.json, workbook file | Settings and all results |

The live quiz join code is 2627 followed by the week number (26271 for week 1, 262710 for week 10). This pattern is written into quiz_receiver.gs itself, not into a setting, so another course or another academic year needs a one-line change in the script.

## What is automatic and what the lecturer does

| Task | Automatic | Lecturer |
| --- | --- | --- |
| Workbook and tabs | Created on first launch (app) or by `setup` (web) | Web only: paste the script, run setup, deploy |
| Host key | An 8-character key generated at setup | Change it from the quiz dashboard (12 to 40 characters; then stored only as a salted hash) |
| Class list | Roster lookups and the on-list check | Load it: paste or CSV in the app; roster_sync.sh or Control Centre on the web |
| Question selection | n questions drawn from the week's bank at quiz start, in an order fixed by the join code and round number | Choose the week, n and the timing |
| Marking | Every live answer, practice attempt and mock exam | None |
| Release | Nothing reaches the record before it | Press Release or Discard after each quiz |
| Totals, Master, Scores | Rebuilt on release | Choose Best or Latest, Master on or off |
| Attendance | Rotating QR every 30 seconds, one check-in per ID per day, device and failure limits, Not_On_List | Open, close, then Submit or Discard each session |
| Explanations | Shown from the bank | Optional overrides in Explanations |
| Problem reports | Logged in Reports (emailed on the web) | Read and correct the bank |
| Export | CSV per tab | Press Export; any final course mark is calculated outside the tool |
| End of term | None | Run clearSemesterRecords (web) and export what is needed first |
| Question banks | Validation and calculation checks by script | Write and correct questions; run build, validate and check_calcs |
| Course content | Pages drawn from the JSON files | Edit lectures.json, portal.json and the PDFs; set the current week |

## Strengths, gaps and limits

**Strengths**

- One server script serves both the web version and the desktop app, so the rules for join codes, rounds, marking, attendance and release are identical in both.
- Nothing a student sends enters the course record until the lecturer releases or submits it, so a mistaken quiz or session can be discarded cleanly.
- Marking is automatic and immediate, with an explanation for each question drawn from the bank.
- Attendance is resistant to sharing: the QR code changes every 30 seconds, one ID per device, a limit on failed attempts, and a separate list of IDs not on the class list.
- Public rankings show first names only; the class list, host key and marks are never in the published files.
- The question banks are large (347 questions, 105 of them from past examinations) and are checked by scripts that recompute every calculation.
- The desktop app needs no account, no internet and no setup; the Google copy is optional and limited to one file.

**Gaps**

- **Own results lookup.** The portal returns a student's results to anyone who types that student ID. There is a rate limit and a class list check, but no second factor, so a student who knows a classmate's ID can see that classmate's marks.
- **Question draw.** The draw is fixed by the join code and round number. A new workbook (for example a new academic year) starting again at round 0 with the same code draws the same questions in the same order as before.
- **Answer columns.** Form Responses 1 has columns Q1 to Q5. Quizzes of up to 20 questions keep all answers in the Answers string, but the per-question columns show only the first five.
- **Lecture 6** has no question bank, so it has no practice page and cannot be used for the live quiz.
- **Bank maintenance.** `build.py` rebuilds a bank from its Python source and overwrites past examination questions that were added to the JSON by hand (lecture 2 holds 35 questions while its source writes 20). The validator reports 4 format warnings in lecture 1, and one check in the browser test of the practice pages fails on the main site as well.
- **Join code pattern** 2627 + week is written into the script, not a setting.
- **No overall mark.** Quizzes, practice, mock exam and attendance are recorded separately; there is no weighting, final mark or grade.

**Limits of the desktop app**

- Results live on one laptop. If the laptop is lost and Google copy is not on, the results are lost; backing up the data folder is the lecturer's task.
- Phones must reach the laptop over the local network. University Wi-Fi often isolates devices; a phone hotspot is the fallback.
- Location checking for attendance is off, because phones give their location only to secure (https) addresses.
- Problem reports and notifications are not emailed.
- The installers are unsigned, so Windows and macOS show a warning on first launch.
- Students can reach the portal, practice and mock exam only while the app is running on the lecturer's laptop.

## Questions for the course, and opportunities

The banks as they stand: 347 questions over 12 lectures, every one with four options, an explanation and a reference to the slide it comes from. By type, 209 are calculations, 76 conceptual, 40 aimed at a known misconception and 22 read from a graph. 107 are taken from past examinations (2015 to 2018) or tutorials. No question carries a difficulty level or a learning outcome.

### Assessment design

- What should the live quiz measure: attendance and engagement, or attainment? The answer decides whether it should count towards the final mark, and with what weight.
- Calculations are 60 per cent of the bank. Is that the balance intended for the course outcomes, or should conceptual and graph questions carry more?
- Every question has four options. Would some questions be better as numerical entry, so that a calculation cannot be passed by elimination?
- Should practice and the mock exam count towards anything, or stay purely formative? At present they appear in Master and Scores but not in the total.
- Is Best or Latest the right rule for repeated live quizzes?
- Lecture 6 has no bank, and lecture 0 and lecture 12 are the smallest (20 and 21). Are these weeks covered elsewhere?

### Feedback to students

- Students see right or wrong and the explanation. Would a hint before the answer, or a second attempt on a wrong answer, teach more?
- The Attempts tab records which questions each student answered wrongly. This could feed a short "questions to revisit" list on the portal for each student.
- Should the ranking be shown at all? It motivates some students and discourages others; it can already be set to Never per quiz.

### Analytics for the lecturer

- The record already holds, for every question, who answered it and whether correctly. Not yet computed: the proportion correct per question, the most chosen wrong option, and how each question separates stronger from weaker students. These would show which explanations or lectures need attention.
- Attendance against marks: does attendance predict quiz and examination results in this course?
- Time per practice attempt is recorded and could identify questions that take too long for their weight.

### Question bank quality

- Add a learning outcome and a difficulty level to each question, so that a quiz can be balanced by design rather than by random draw.
- Review the questions that most students answer wrongly: is the question unclear, or the misconception real?
- Resolve the four format warnings in lecture 1, and bring the past examination questions into the Python sources so that rebuilding a bank no longer removes them.
- Draw from a fresh seed each academic year, so that students do not meet last year's live quiz.

### Accessibility and fairness

- Timed live questions (60 seconds by default) disadvantage slow readers and students with extra time arrangements. Consider a longer timer, or the timed mode for those quizzes.
- Students without a smartphone, or with a flat battery, cannot check in or join the quiz. A lecturer route to mark such a student present is needed.
- The pages use KaTeX for formulas; screen reader support for the quiz and graph questions has not been tested.
- The own-results lookup by student ID alone should be closed before marks are shown to students in a new term, for example with a personal code sent to each student.

### Practical next steps, in order of effort

1. Count per-question success rates from the existing record and review the ten weakest questions.
2. Decide the weight of quizzes and attendance in the final mark, and add the corresponding total to Scores.
3. Write the lecture 6 bank.
4. Add outcome and difficulty fields to the banks.
5. Close the own-results privacy gap.

## Learning Progress charts (desktop, from 11 November 2026)

The Learning Progress screen draws its graphs from `desktop/app/charts/`, one file per chart type (README.md there). The first two are the mastery distribution (stacked bars by objective) and the objective heat map (students by objectives). They read the figures of `learningProgress_` and do no calculation of their own. Added in the same release: class progress over time (weekly mean, median and quartile band, from `classTimeline_`), learning gain, before and after discussion, and for one student the trajectory against the class mean, student versus class by objective, learning gain and engagement (from `studentProfile_`, which now also returns `classTimeline`, `classByKey` and `engagement`). Class graphs on the dashboard (0.16.0): `stats.js`, `distribution.js` (histogram with Gaussian fit and outlier list), `boxplot.js`, `scatter.js`, `days.js` and `panel.js` (day selector; redraw when `cm:stamp` changes, a counter in `backend.js` that goes up on every change to the records). They read the figures of `classStats_` and do no server calculation. Not yet built: question difficulty (already on Quizzes and Questions) and the Sunday analytics list (evidence confidence, item analysis, concept and intervention tracking, fairness view), which should reuse `classTimeline_` and `classOutcomes_` rather than recalculate.


## 0.17.0: smaller queued items
- `desktop/remove-student.js`: remove a student from the class (Roster, Attendance, Master, Scores, Totals) by clicking a row in Grades and Results; the rows are kept in the `Removed_Students` tab and Restore puts them back. Logs (check-ins, quiz answers, records, notes) are never changed. IPC `cm:removeStudent`, `cm:restoreStudent`.
- `desktop/app/headings.js`: readable names for assessments and columns (display only; the stored heading and exports are unchanged). Used by the Grades table and the day selector.
- Roster integrity: in record tabs, rows for IDs not on the class list are marked and counted; the folder import summary says the class list is the source of truth.
- Attendance column headings show the time the session was opened (from `Attendance_Control`).
- Clickable graph regions: `panel.js` (see `app/charts/README.md`).

## 0.18.0: course details from a linked folder
`desktop/autoload/folder-details.js` reads up to 12 small outline and information files of a linked folder (outline-like names first) and `course-details.js` suggests code, title, term, lecturer, institution (labelled lines, or the first lines of an unlabelled outline). The Courses dialog runs it when a folder is linked, when a linked course has a blank title or term, and from "Read the files"; it fills the empty boxes, lists each value with its file, and the lecturer corrects and saves. IPC `cm:folderDetails`. Full folder and cloud ingestion (lectures, slides, material types) is still planned.

## 0.19.0: the whole Course details form from a folder
`autoload/folder-details.js` now also reads a CM course pack's own `course.json` (settings) and `data/portal.json` (class times, current week, lecture titles), then the outline text for what they lack; it returns every field it found with its file, the weekly topics, and `missing` (the fields the files do not give). `course-details.js` also finds the contact e-mail and the first and last day from a "teaching ... date to date" line. The New course form (`app/setup.html`) has "Fill from the course folder" and fills itself at once when a folder is linked or was loaded. Nothing is invented.

## 0.19.1: launch crash fixed

0.19.0 crashed at launch ("Cannot access 'on' before initialization"): the `cm:folderDetails` handler had been inserted above the line that declares `on` in `desktop/main.js`. It now sits with the other course handlers. `desktop/test/main-loads.test.js` loads `main.js` with a stand-in for Electron and checks that the handlers register, so a launch crash of this kind fails the tests before a release.

## 0.19.2: Hope's real PHYS 143 folder

Found by reading the real folder: the pack sits one level down in a wrapper folder with loose student files beside it, and `course-course-pack.zip` there holds only `course.json`. Importing it said "Imported (0 files)" and, worse, replaced the course content with nothing. Now: `course.js importPack` returns `files: 0, replaced: false` and leaves the content alone (the screen explains it), accepts a zip made from the pack folder (one wrapper), and accepts a folder. `autoload/folder-details.js` ranks files by their own name (a folder called "...-course-pack" made every file look like an outline) and skips student records; `autoload/course-details.js` reads "First Semester, 2026/2027" and teaching dates written inside a long sentence. Test: `test/real-pack.test.js`.

## Dashboard refresh (UI redesign, charts first)

Class Analytics now leads with five clickable numbers (students, attendance, learning, practice, at risk). A click opens a bar chart with the students behind each bar (`desktop/app/dashboard/groups.js` works out the groups, `charts.js` draws, `interact.js` handles clicks). "Who needs attention" is a scatter of attendance against quiz average with three clickable zones, replacing the long list. "What goes with what" shows three linked relations (attendance and quiz average, practice and quiz change, practice and quiz average) with n, r and the words association, not cause; a zone chosen above is highlighted in them. Server: "no practice recorded" no longer flags a student alone (`30-analytics.gs`); the lecturer sign-in form tells a wrong password from an unknown join code (`90-router.gs`, `quiz-host.html`). Tests: `desktop/test/dashboard-refresh.test.js`. Not yet built: support or intervention against later results (needs intervention tracking), and the refreshed look of the other screens.

Look (2026-11-15, from Hope's inspiration image): soft tinted tiles on cards, one navy and blue palette, large readable numbers, line icons, a row of four class tool tiles and one insight callout (`render.js`: `stat`, `controls`, `callout`; `dashboard.css`). Long lists of students show the first 8 and a "Show all" button (`interact.js`).

## Analytics, privacy and governance (0.21.0)
- `desktop/app/analytics/` (see its README): evidence labels, question review, concept tracking, support given, results by group, panel on the Overview.
- `desktop/extras.js`: groups (Roster column 3) and the Interventions tab (ID, kind, date, quizzes held, student IDs, note).
- `desktop/governance.js`: Audit_Log tab, per-student export and permanent erase (typed ID to confirm, found by Student ID or ID column), term close (Term_Status tab; closed terms refuse student check-ins, quiz attempts, reports and chat, never the lecturer), role table, default privacy notice served at `/privacy.html`.
- `desktop/summary.js`: weekly summary from class totals only; written locally; Claude wording only when the lecturer switches it on and a key is stored (off by default).
- IPC: `cm:analyticsExtra`, `cm:addIntervention`, `cm:govern` (export, erase, term, audit, ai, notice), `cm:weeklySummary`. No Apps Script change, so no redeploy.

## Assistant export (0.21.0)

`desktop/llm/` (README.md there) saves a private snapshot of the current course for an AI assistant: `policy.js` (allowed tabs, columns), `pseudonym.js` and `salt.js` (stable pseudonyms; the salt stays in the course data folder), `snapshot.js` (snapshot and preview), `markdown.js`, `mcp-server.js` (stand-alone read-only MCP server copied beside the snapshot) and `ipc.js` (`cm:llmPreview`, `cm:llmSave`, `cm:llmLookup`). Screen: Settings card, `desktop/app/llm.js`. Tests: `desktop/test/llm.test.js`.


## LMS connector (added 15 November 2026)

`desktop/lms/` (one job per file, listed in `desktop/lms/README.md`) with the screen `desktop/app/lms.html` and `lms.js`, opened from Course and Content. It reads an LMS roster export, writes a gradebook CSV, and optionally uses the LTI Advantage roster and grade services directly. Off until switched on; sends only user ids and points. Tests: `desktop/test/lms.test.js`.

## Course database (desktop/db/)

| File | Responsibility |
| --- | --- |
| `db/store.js` | Open the SQLite file, load the course, save changed tabs and rows in one transaction. |
| `db/codec.js` | Turn a row or setting into stored bytes (encrypted with the vault) and back. |
| `db/migrate.js` | Decide what is on disk: import `workbook.json` safely, move an unreadable database aside, read a course as workbook text for backups. |

`backend.js` uses these three and keeps the spreadsheet shim for the server script. Tests: `desktop/test/db.test.js`, `vault.test.js`.

| File | Responsibility |
| --- | --- |
| `db/students.js` | The student table with unique IDs, kept equal to Roster. |
| `receipts.js` | Run a request with a client key once. |
| `relay/client.js`, `relay/crypto.js` | Collect from the mailbox and open items; make the course keys. |
| `app/mailbox.html`, `app/mailbox.js` | The Mailbox screen. |
| `../assets/outbox.js`, `../assets/relay-seal.js` | The phone's queue and encryption. |
| `../relay/worker.mjs`, `../relay/README.md` | The mailbox Worker and the setup steps. |
| `grades/build.js`, `grades/view-model.js`, `grades/times.js` | The clean Grades tables (Quizzes by date, Attendance by session date, and more) with the time of each entry, a student's timeline, and the Excel layout (see `grades/README.md`). |
| `rules/session-label.js`, `rules/attendance-bands.js` | Clean session dates from any heading; the class split by attendance rate (who comes, who does not). |
| `app/grades-view.js` | Draws the Grades tables (buttons to switch), the row menu (Timeline, Remove from class) and the timeline. |
| `app/frozen-cols.css` | One shared style that freezes the first two columns (Student ID, Name) of a wide table; the other columns scroll to the right of them. Used by the Grades table. |
## Join code base (0.21.1)
- A join code is the course's base followed by the week number (base 2627: 26271 is Week 1). The base is a script property `join_base` (default 2627), changed by the host-only action `join_base` and the "Join code base" field in the Control Centre. `joinBase_`, `codeWeek_` and `weekFromCode_` are in `apps_script/src/00-core.gs`. A signed-in lecturer can open any join code of that shape; a week without a question bank says so. Script version 2026-11-15-signin-2.

## More charts (0.21.2)
`desktop/app/charts/explore-data.js`, `explore-view.js` and `explore-panel.js` (see `charts/README.md`): nine extra clickable bar charts across the Overview, Attendance, Quizzes and Questions and Students screens. Mounted from `app/insights.js` (`xmount`). Styles in `app/dashboard/dashboard.css`.

### Overflow guard (0.22.0)
`desktop/test/overflow.test.js` opens every sidebar screen at 760, 1000 and 1280 px with a very long folder path and repository URL and fails if the page or `main` scrolls sideways. The Course and Content card shows labelled Folder, Repository and Branch lines with Copy buttons; full values appear on hover. Long text wraps (`overflow-wrap:anywhere`) and `main` never scrolls horizontally.

## rules/ (desktop/rules)
The course rules as plain JavaScript over a small store interface, ported one area at a time from `apps_script/` with parity tests (`test/rules-parity.test.js`). Stage 1 has `access-codes.js` and `store.js`; stage 2 adds `attendance.js` (open, close, check-in, submit, discard; `test/attendance-parity.test.js`) and `attendance-review.js` (status, review, remove, approve, phone reset; `test/attendance-review-parity.test.js`). Nothing calls them yet. See `RULES-AND-RELAY-PLAN.md` for the staged plan and the removal list.
### Duplicate IDs card (0.22.1)
`desktop/id-notices-ipc.js` (two calls: `cm:idNotices`, `cm:idResolve`) and `desktop/app/id-notices.js` (the card on the Class Roster screen). A student ID that was on more than one row is merged by `db/id-guard.js` (first row stays, blanks filled, a different value never overwritten) and recorded by `db/notices.js`. The card lists each ID with both source rows exactly as they were and the names they gave; the lecturer picks the right name or marks the ID as checked, and the choice is written to the class list. Test: `desktop/test/id-notices.test.js`.

### IDs read with certainty in the class list upload (0.22.1)
`desktop/app/id-review.js` reads one ID cell: `22583439`, `22583439.0` and `022583439` are the same ID; Excel's scientific form, a decimal part, a wrong length or mixed characters are "ambiguous" and never guessed. The class list screen (`app/setup.html`) lists those rows (row number, value as written, name, reason) with a box to type the right ID, and the save leaves out any row still unread. Before this, `22583439.0` became `225834390` because all non-digits were removed. The column choice (ID, first name, last name) was already editable on that screen. Test: `desktop/test/id-review.test.js`.

### Column mapping and support tracking (0.22.2)
The web import preview shows which file column each required column is read from and lets the lecturer change it ("Columns the import uses"; `options.mapping` in `desktop/import-plan.js`, screen in `desktop/app/import.js`). The Support given card on Class Analytics records support (kind, student IDs, note; `cm:addIntervention`, audited) and compares later quizzes of students given it with students whose earlier results were similar (within 10 points, `TOLERANCE` in `desktop/app/analytics/interventions.js`); the counts open to the student IDs behind them. Tests: `desktop/test/column-mapping.test.js`, `desktop/test/analytics.test.js`.

## relay/hub (the CM relay)
The hosted Cloudflare Worker with D1 that lets phones take part when the lecturer's computer is off: automatic course registration, signed requests from CM, sealed drops from phones, small live state, abuse controls and forgetting. One file per job under `relay/hub/src/`; tested without Cloudflare through `relay/hub/test/fake-d1.js`. See `relay/hub/README.md`. The older KV mailbox (`relay/worker.mjs`) stays until CM moves over.

CM's side of the relay hub: `desktop/relay/hub.js` and `desktop/relay/address.js` (address built into the installer from `CM_RELAY_URL`); `desktop/test/relay-hub.test.js`.

### Live attendance on the relay (stage 4)
`relay/hub/src/attend.js` runs the attendance rules inside the hub Worker (open, check-in, events, close); `desktop/relay/live-attend.js` is CM's side (hand over the open session, collect and record events in the same tabs). Tests: `relay/hub/test/attend.test.js` (relay against `rules/attendance.js`), `desktop/test/live-attend.test.js` (CM and the hub together). Wired in (stage 5): `desktop/relay/live-session.js` watches the answers to `attend_open`, `attend_close` and `attend_status` in `main.js`, hands an opened session to the relay, collects check-ins every 15 s and at close, and adds a `relay` field (address, course id, website pages address) to the status answer. `attendance.html` then draws a QR code for the website's `attend.html?t=…&r=<relay>&c=<course>`, and `attend.html` posts the check-in to the relay when `r` and `c` are present, so the phone needs neither the laptop nor a Cloudflare account. Test: `desktop/test/live-session.test.js`. A relay failure is logged and the local answer is unchanged. Not yet: resuming a relay session after CM is restarted while a class is open.

### Move to SQL, step 1: class list
`desktop/rules/class-list.js` (sync from an upload, tidy other tabs to the list, add, remove or check one ID, lecturer notes) with `test/class-list-parity.test.js`. The host key check stays in the caller until step 2 (sign-in). Nothing calls the module yet; the router (step 7) will.

### Move to SQL, step 2: sign-in
`desktop/rules/auth.js` (sessions, lecturer key and password with recovery code, student sign-in, quiz receipts) with `test/auth-parity.test.js`. It keeps the script's stored forms (`pw1` hash in Key!J2, property `sess_secret`), so sessions and passwords made by either side work on the other. Failed-try counters come from `memoryCounters` (a short-lived counter, as the script's cache).

`desktop/rules/quiz-control.js` (start, next, pause, end, release, restart, review, settings; the question draw and the correct letters) with `test/quiz-control-parity.test.js`. The held-results steps (finalize, commit, discard) are passed in as hooks and arrive with step 3b. `backend.setProp(key, null)` now removes a setting, as the script's deleteProperty does.

`desktop/rules/quiz-results.js` (the answers of a paced quiz, compiling them when it ends, Release and Discard of held results, the item log, presence) with `test/quiz-results-parity.test.js`. Release calls the score tables through the `master` and `totals` hooks, which `rules/score-tables.js` fills in the next step.

`desktop/rules/score-tables.js` (Master, Scores and Totals, built from released results, practice and mock tries) is the `master` and `totals` hook of a release; the release test compares all three tabs with the script's.

`desktop/rules/quiz-submit.js` (what a student's page sends: answer, join, progress, timed submission, practice attempt, question report) with `test/quiz-submit-parity.test.js`, which sends the same requests to the script and to the module and compares outcomes, receipts and every record tab.

`desktop/rules/quiz-views.js` (what the quiz pages read: status, questions, review, ranking, a student's result, the host view, the projector display, portal status and My results) with `test/quiz-views-parity.test.js`, which compares every view with the script at each stage of a quiz (running, second vote, ended, review, released, board hidden).

`desktop/rules/learning.js` (a student's questions to revisit, per-question statistics, Teaching insights, records and notes) with `test/learning-parity.test.js`. The script's sandbox does not see its dates as dates, so the test checks the date text of records and notes by its form rather than against the script.

`desktop/rules/class-stats.js` (Class statistics: attendance and arrival, quizzes, questions, each student, engagement groups, whether the class is learning, areas to target) with `test/class-stats-parity.test.js`, which builds a class of twelve with two released quizzes, practice, attendance and check-in times and compares the whole answer with the script's.

`desktop/rules/outcomes.js` (learning objectives linked to questions, every answer as evidence, progress by objective and over time, the class by calendar week, ask-discuss-revise evidence) with `test/outcomes-parity.test.js`. Learning progress and the student profile need group work and come with step 6.

`desktop/rules/text.js` (calendar date text, message text, links, day format, random shuffle: small helpers shared by several rules), `desktop/rules/groups.js` (student groups made at random or mixed by quiz results or attendance, avoiding repeat pairings, locked, moved and marked; the projector layout; a student's own groups) and `desktop/rules/assignments.js` (group assignments, the shared submission, each member's part, private peer ratings, group marks into Master) with `test/collaboration-parity.test.js`. `desktop/rules/chat.js` (conversations, store and forward messages, student groups, moderation), `desktop/rules/announcements.js` and `desktop/rules/calendar.js` (events, weekly series, the iCalendar feed) with `test/communication-parity.test.js`. `desktop/rules/progress.js` (Learning Progress, the student profile with suggestions, one student in Class statistics, and the groups, learning and progress lines of My results) with `test/progress-parity.test.js`. `desktop/rules/router.js` is the one router for every request (read actions, host actions, POST kinds); `backend.js` runs it instead of the Apps Script when the engine is `js` (`createBackend({engine:"js"})` or `CM_ENGINE=js`), and since step 8 it is the default: the course runs on the rules alone, and the app screens that call the backend directly (statistics, Learning Progress, notes, class list sync, password) use them too. `CM_ENGINE=script` runs the old script instead (the parity tests do, to compare). The Apps Script address in CM Settings is no longer needed. `test/router-parity.test.js` runs the whole surface against the script; the whole test suite also passes with `CM_ENGINE=js`; `test/engine-js.test.js` runs a class end to end on it.

`relay/hub/src/quiz.js` (live quizzes on the relay: status, question text, joins and answers while the lecturer's computer is off), `desktop/relay/live-quiz.js` (CM's side: hands the quiz to the relay, collects, records through the quiz rules; wired in `main.js` beside live attendance), `quiz.html` (a phone opened from the relay QR code talks to the relay) and `config.js` (`CM.useRelay` makes the host and projector QR codes point at the relay while it holds the quiz), with `test/live-quiz.test.js`.

## The class list is entered in one place (0.23.0)

The roster enters CM only on the Class Roster page, from screenshots (`desktop/roster-shots/`). Every other file or source (attendance, grades, quiz exports, LMS files, a linked folder or repository, another computer) is checked against the class list: matching rows are used, IDs not on it are reported and never added, names on the list never change. The ID is the unique key: the same ID with two names is a conflict for the lecturer; the same name under two IDs is allowed. Removed: pasted and file class lists (`cm:classList`, `cm:classListFile`, `cm:classRows`, `cm:tableFile`, `cm:tableText`, `cm:sampleClassList`), adding students in the web import, folder import and LMS roster (`lms/roster-apply.js`), class list sync from linked storage, and `roster_sync` and `roster_edit add` page requests. See `desktop/roster-shots/README.md`.


## First-run setup (added 2026-11-16)

One central password opens CM and every course (`desktop/first-run/central-login.js`, `app/login.html`). Setup then runs in a fixed order: password, class roster, course material (`desktop/first-run/stages.js` holds which calls wait for which step). Course material is loaded from a folder of quiz banks in the online format (`first-run/quiz-bank.js`, `first-run/bank-folder.js`, add only) or generated by CM from the teaching material. `desktop/course-folder.js` finds the content inside a chosen folder or course pack and counts it. Details: `desktop/first-run/README.md`.

### Access code shown at sign-in (no slips, no email)

A student scans the room's QR code and enters only their ID. `rules/code-claim.js` (action `claim_code`; on the relay `POST /v1/claim`, `relay/hub/src/attend.js` `claim`) then shows that phone the personal access code, once, and `attend.html` uses it to check in and keeps it on the phone. The code is shown only when the QR token is current (and the location passes when it is enforced), the ID is on the class list and has a code, and the phone is not registered to another ID nor the ID to another phone. The first phone to ask is registered to the ID (the same one-phone-per-student rule as check-in, so CM's existing new-phone flow applies). Any other phone is not shown the code: the request appears in the attendance review under "waiting for approval", and the lecturer can give the code from Access codes or forget the phone (`attend_phone_reset`) so the student can try again. An ID that is off the list answers like a wrong code, so IDs cannot be probed; six refusals slow a phone down. With the laptop off the relay holds the codes in table `live_code` only while the session is open: CM sends them in `/v1/live/open`, `close` deletes them, and the daily cleanup removes any left behind. The lecturer can stop codes leaving CM with the property `code_claim` = `0`. Residual risk: someone in the room who knows another student's ID and asks first within the QR window would be shown that code; that student's own phone is then held and flagged, and the lecturer resets it. Tests: `desktop/test/code-claim.test.js`, `relay/hub/test/claim.test.js`.

- `desktop/offlist.js`: IDs not on the class list. Finds rows for them in Master, Scores, Attendance and Totals, sets chosen rows aside (`Offlist_Rows_Kept`, restorable) and keeps the `Flagged_IDs` review list. IPC `cm:offListScan`, `cm:offListSetAside`, `cm:offListRestore`. Screen: `desktop/app/offlist.js`.

**Roster first.** The class roster is the first upload in CM, after the password. The setup wizard runs Class list, Course details, Course materials, and every other upload is refused with a button to the roster step until a roster exists (one gate: `desktop/first-run/stages.js`). IDs in other files never become roster members; with an empty roster they are shown as not on the list and nothing is saved.
