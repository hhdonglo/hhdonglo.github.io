# Class Manager: structure and review notes

Written 9 November 2026. A description of the class management tool as it stands in this folder, for review of the tool and of the course it serves.

**Update, later on 9 November 2026.** Following the review, the package gained learning support; see "Learning support" in README.md. Of the gaps listed below, these are now closed: the own-results lookup needs a personal access code; the live quiz draw changes with each new workbook; every live answer is kept per question (Item_Log), so per-question statistics are computed; practice attempts record the questions asked. Four private tabs were added: Item_Log, Access_Codes, Question_Stats and Groups. Group marks now exist (groups.html), so "no group marks" below no longer holds.

**Further update, 9 November 2026.** The desktop app gained a resource library with search, summaries, question generation with Claude, question import and a review queue (desktop/README.md, "Resources and questions"); the server script gained a course calendar, messages with moderation, and announcements (README.md, "Calendar, messages and announcements"). Line counts below describe the script before these additions.

## Purpose and architecture

The class management tool runs one course from three layers: static pages that students and the lecturer open in a browser, one server script that holds every rule, and a private workbook that stores every record. It serves PHYS 143 (12 lectures plus an introduction, 347 practice questions) and is built so that the course content can be replaced.

- **Pages** (HTML and JavaScript, no framework): the student portal, course and lecture pages, practice quizzes, mock exam, live quiz pages, attendance pages, lecturer menu and Control Centre. They read the question banks and course data as JSON files.
- **Lecturer password** (`password.html`, `assets/password.js`, `apps_script/src/06-password.gs`): choose, change and recover the lecturer password. See README.md, "Lecturer password".
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
| Attendance | `attend.html` (students), `attendance.html` (lecturer) | Students and lecturer | A QR code whose link changes every 30 seconds; students enter only their ID. Close, then submit, writes the day's column. |
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
  desktop/                  the desktop app: main.js, backend.js, course.js (course folder and packs), table.js (reads class list files), excel.js (writes Excel workbooks), names.js (first and last names: join, split, name columns in exports), google.js, linked-folder.js (encrypted copies in a synced folder), storage-providers.js (names the cloud service from a folder path), sync/ (merge.js, records.js, materials.js, course-sync.js: keeping notes, materials, class list and attendance in step with the linked place), storage/ (providers for WebDAV, GitHub, Dropbox and S3 with the lecturer's own credentials), preload.js, app/home.html, app/linked-folder.js (the Link storage card), app/setup.html, package.json
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
| App, Settings | course code, title, institution; advanced Apps Script address | Labels, or use a Google Apps Script server instead of the local one |
| App data folder | settings.json, workbook file, google.bin | Settings, all results, and the encrypted Google sign-in token |

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
| Google copy | Every tab copied within about a minute of a change, after sign-in | Sign in once (optional) |
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
- Google sign-in needs a one-time registration of a Google OAuth client by the publisher, which has not yet been done.
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

The Learning Progress screen draws its graphs from `desktop/app/charts/`, one file per chart type (README.md there). The first two are the mastery distribution (stacked bars by objective) and the objective heat map (students by objectives). They read the figures of `learningProgress_` and do no calculation of their own. Added in the same release: class progress over time (weekly mean, median and quartile band, from `classTimeline_`), learning gain, before and after discussion, and for one student the trajectory against the class mean, student versus class by objective, learning gain and engagement (from `studentProfile_`, which now also returns `classTimeline`, `classByKey` and `engagement`). Not yet built: question difficulty (already on Quizzes and Questions) and the Sunday analytics list (evidence confidence, item analysis, concept and intervention tracking, fairness view), which should reuse `classTimeline_` and `classOutcomes_` rather than recalculate.
