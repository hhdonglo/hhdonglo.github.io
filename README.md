# hhdonglo.github.io

The personal academic website of **Hope Donglo** (theoretical nuclear physics, University of Ghana) at **https://hhdonglo.github.io/**, together with the PHYS 143 course material, the practice quizzes, and the live quiz and attendance system used in class.

This is an independent personal website. Official course information for registered students is on Sakai; the site says so in a disclaimer box on the course pages.

This README documents the whole repository: what each page and file is, how pages are built from data files, how the quiz and attendance system works, and how to change, publish and redeploy things. Two older guides stay in the repository and go deeper on their topics:

- [`EDITING.md`](EDITING.md): editing page text with the Pages CMS forms.
- [`QUIZ_SETUP.md`](QUIZ_SETUP.md): the quiz and attendance setup notes (steps, Sheet tabs, rules).

Contents

1. [How the site works](#1-how-the-site-works)
2. [Repository map](#2-repository-map)
3. [Pages](#3-pages)
4. [Data files and how pages are generated](#4-data-files-and-how-pages-are-generated)
5. [Assets: styles, scripts, images](#5-assets-styles-scripts-images)
6. [PHYS 143 lecture content](#6-phys-143-lecture-content)
7. [Practice quizzes and the mock exam](#7-practice-quizzes-and-the-mock-exam)
8. [Live quiz system](#8-live-quiz-system)
9. [Attendance system](#9-attendance-system)
10. [The Apps Script and the Google Sheet](#10-the-apps-script-and-the-google-sheet)
11. [Roster sync](#11-roster-sync)
12. [Privacy and standing rules](#12-privacy-and-standing-rules)
13. [Tools in `tools/`](#13-tools-in-tools)
14. [Deployment and caching](#14-deployment-and-caching)
15. [How to: add or edit a page, lecture or quiz](#15-how-to-add-or-edit-a-page-lecture-or-quiz)
16. [How to: redeploy the Apps Script](#16-how-to-redeploy-the-apps-script)
17. [Git workflow on the Mac](#17-git-workflow-on-the-mac)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. How the site works

- A **static site** served by **GitHub Pages** from the root of the `main` branch. There is no build server, no framework and no database. `.nojekyll` switches off Jekyll so files are served exactly as they are.
- Pages are plain HTML. Most page text lives in **JSON files in `data/`**. A small script, `assets/render.js`, loads the JSON in the browser and draws the content into containers marked `data-render="..."`. The HTML also holds a **baked fallback copy** of the rendered content, so a visitor with JavaScript off, or a search engine, still sees the text. If the JSON cannot be loaded, the fallback stays on screen.
- Text can be edited through browser forms in **Pages CMS** (https://app.pagescms.org, sign in with GitHub). The form definitions are in `.pages.yml`. Each save is one commit to `main`.
- The **live quiz and attendance system** is a Google Sheet with a **Google Apps Script web app** (`apps_script/quiz_receiver.gs`) as its server. The site pages talk to it from the browser. The Sheet is private; the repository holds only the script source and the public question banks.
- Visit counts are anonymous (GoatCounter, no cookies). The counter is private and nothing is shown to visitors.

## 2. Repository map

```
index.html, about.html, research.html, ...   one HTML file per page (section 3)
data/                                        content as JSON (section 4)
  site.json                                  name, contact details, profile links, footer, GoatCounter code
  pages/*.json                               home, about, contact, cv, kewpie3, laboratory, phys143, teaching, student-research
  lectures.json                              the 13 PHYS 143 entries (introduction plus lectures 1 to 12)
  research.json, projects.json, publications.json, reaction-dynamics.json, data-engineering.json
quizzes/lecture0.json ... lecture12.json     public practice question banks (no lecture6.json yet)
assets/
  site.css                                   all styles (light and dark, mobile, print)
  render.js                                  draws pages from data/*.json
  site.js                                    menu, dropdowns, reveal and counting motion, figure lightbox
  practice.js                                practice quiz engine for one lecture
  mock.js                                    mock exam engine
  tracking.js                                optional student ID and result sending (practice and mock)
  stats.js                                   GoatCounter loader
  quiz-l1-questions.js                       earlier Lecture 1 try-quiz questions (kept for the old page)
  figures/, thumbs/, logo/, katex/           images, thumbnails, favicons, KaTeX for equations
  hope-donglo-portrait.webp, -square.webp    profile photos
  fig-pathway.svg                            figure used on the research pages
apps_script/
  quiz_receiver.gs                           the Apps Script server (section 10)
  live_quizzes.json                          week names and default bank for live quizzes
PHYS143/lecture_N/ and PHYS143/introduction/ lecture PDFs (section 6)
PHYS105/lecture_1/                           the uncertainty analysis lecture PDF
tools/                                       build, check and test scripts (section 13)
.pages.yml                                   Pages CMS forms
.nojekyll                                    tells GitHub Pages not to run Jekyll
EDITING.md, QUIZ_SETUP.md                    detailed guides
robots.txt, sitemap.xml                      search engine files
googlec11511725be46f9d.html                  Google Search Console verification file (do not delete)
```

## 3. Pages

### Public pages

| Page | Purpose |
| --- | --- |
| `index.html` | Home: header, profile column, introduction, research cards, teaching block, selected publications, at-a-glance counts, contact. |
| `research.html` | Research questions, research areas, current and previous research (cards with optional "Summary and key results" panels). |
| `reaction-dynamics.html` | Nuclear Reaction Dynamics: fusion-evaporation and superheavy elements, with equations (KaTeX). `superheavy.html` is a small redirect to it. |
| `earlier-research.html` | Earlier research page. |
| `projects.html` | Research software projects (KEWPIE3 and fusion dynamics). |
| `kewpie3.html` | The KEWPIE3 project page with figures. |
| `data-engineering.html` | Scientific Computing, data science, machine learning and engineering projects (project cards, tools, upcoming projects). |
| `numeralanalytics.html` | Numeral Analytics project page. |
| `publications.html` | All publications in groups, with a year filter. |
| `students.html` | Student supervision and project opportunities. |
| `about.html`, `contact.html`, `cv.html` | Academic profile, contact page, CV summary (the CV PDF is in `cv/`). |
| `teaching.html` | Teaching hub: current courses and resources, research-informed learning. Holds the lecturer Login link. |
| `phys143.html` | The PHYS 143 course page: overview, structure, weekly programme with links to every file, reference chapters, expected skills, mock exam card. |
| `phys143-introduction.html`, `phys143-introduction-practice.html` | The introduction (physical quantities and measurement) and its practice quiz. |
| `phys143-lecture-N.html` (N = 1 to 12) | One page per lecture: summary, objectives, three contacts, buttons for slides, handout, tutorial, supplement and practice questions. Lecture 6 has a page but no practice quiz yet. |
| `phys143-lecture-N-practice.html` (N = 1 to 5, 7 to 12) | One practice quiz page per lecture, with 20 multiple-choice questions at a time. |
| `mock-exam.html` | Mock exam: 50 questions drawn from past exam questions, 2 hours 30 minutes. |
| `laboratory.html` | Laboratory courses page. |
| `uncertainty.html` | The uncertainty analysis lecture for PHYS 105, 106 and 205 (under development). |

### Student pages for live sessions (not indexed: `noindex`)

| Page | Purpose |
| --- | --- |
| `phys143-quiz.html` | The student page for every live quiz: name, ID, join code, waiting room, timed questions, result and review. One page serves every week. |
| `phys143-attend.html` | The student **Attendance check-in**: Student ID, Attendance code and a **Present** button. Opened by the attendance QR code. |

### Lecturer pages (not indexed; they need the host key)

| Page | Purpose |
| --- | --- |
| `phys143-lecturer.html` | Lecturer menu. One login, then two choices: **Run quiz** or **Take attendance**. |
| `phys143-quiz-host.html` | Quiz dashboard: open lobby, start, next question, pause, extend, end, release results, review answers, resets, week and number of questions, change the host key. |
| `phys143-quiz-display.html` | Projector view for a quiz: QR code, join code, joined count, countdown, question, results. Never shows IDs. |
| `phys143-attendance.html` | Attendance page: **Start attendance** (QR code and a new random code), live count, **Close attendance and record absences**. |

### Redirect pages (keep them; old links depend on them)

`data-computation.html` (to Projects), `data-science.html` (to Data Science, ML and Engineering), `student-research.html` (to Students), `superheavy.html` (to Nuclear Reaction Dynamics), `practice.html` (to the practice pages), `phys143-lecture1-try.html`, `phys143-lecture1-host.html` and `phys143-lecture1-display.html` (to the `phys143-quiz` pages). The folder `tools/old-address-redirect/` holds the files for an old address, `hhdonglo.github.io/UG-Lectures`, which has its own tiny repository.

## 4. Data files and how pages are generated

| File | Drives |
| --- | --- |
| `data/site.json` | Name, email addresses, phone, office, profile links (Scholar, ORCID, GitHub, LinkedIn), footer lines, banner lines, GoatCounter code. Read by the footer, the contact page and the home links. |
| `data/pages/home.json` | The home page: header lines, introduction, cards, highlights, menu dropdown lists. |
| `data/pages/about.json`, `contact.json`, `cv.json`, `kewpie3.json`, `laboratory.json`, `student-research.json`, `teaching.json` | Section and card lists for those pages. |
| `data/pages/phys143.json` | The PHYS 143 page text outside the lecture tables (`top` and `bottom` sections). |
| `data/lectures.json` | The weekly programme and every lecture page. Groups (Introduction, Mechanics, Thermal physics); each lecture has `number`, `title`, `status` (`available` or `soon`), `summary`, `outcomes`, file paths `slides`, `handout`, `reference`, `tutorial`, `supplement`, `contact_focus`, and `practice` (`available` or `soon`). Also the three contact headings, the course outline link, the official listing link and the mock exam card. |
| `data/research.json`, `projects.json`, `publications.json`, `reaction-dynamics.json`, `data-engineering.json` | The matching pages. |
| `quizzes/lectureN.json` | Public question banks (section 7). |
| `apps_script/live_quizzes.json` | Week names for live quizzes and the default bank (section 8). |

**Rendering.** A page contains containers such as `<div data-render="lecture" data-n="2">`, `data-render="weekly"`, `data-render="page"`, `data-render="footer"` or `data-render="publications"`. `assets/render.js` fetches the right JSON (always with `cache: "no-cache"`) and fills the container. Each renderer is a function on the `R` object in `render.js` (`R.lecture`, `R.weekly`, `R.page`, `R.footer`, `R.publications`, `R.projects` and so on). Text fields accept `**bold**`, `*italic*`, `^sup^` and `[text](link)`.

**Baked fallback.** `tools/bake.py` stores the rendered content in each page's HTML so that the page works without JavaScript. It needs a local server and Playwright, and `tools/bake.js` and `tools/bake.py` are written for a sandbox path (`/tmp/claude-0/bake.json`, `/opt/node22/...`), so they may need their paths changed on another machine. When only a small thing changes, the fallback text in the HTML can be patched by hand, as was done when the Handout buttons were added. If the fallback is stale, visitors with JavaScript see the new content anyway.

**Menu.** The navigation menu is fixed page structure, not data. `tools/build_shell.py` rewrites it on every page. The dropdown lists come from `data/pages/home.json` ("Menu dropdown lists").

**Lecture pages.** `tools/make_lecture_pages.py` writes `phys143-lecture-N.html` and `phys143-lecture-N-practice.html` for every lecture in `data/lectures.json`. `tools/make_intro_pages.py` writes the two introduction pages.

## 5. Assets: styles, scripts, images

- `assets/site.css`: every style, with design tokens for light and dark mode, mobile layout, sticky menu, hover and focus states, print rules and reduced-motion handling.
- `assets/render.js`: the renderers described above.
- `assets/site.js`: the menu (phone list, dropdowns, closing by swipe, Escape, outside tap), sticky menu height, the header and counting animations (off for visitors who prefer reduced motion), and the figure lightbox.
- `assets/practice.js`: the practice quiz engine. Mounts into `#quiz-app`, reads `data-lecture`, loads `quizzes/lectureN.json`, shows 20 questions, gives feedback, offers a retry of the missed questions, and contains a "Report a problem" link block (`REPORT_FORM`).
- `assets/mock.js`: the mock exam engine (50 questions, timer, no answers until submission).
- `assets/tracking.js`: an optional Student ID box for practice pages and the mock exam. Nothing is sent unless the student types an ID. Results go to the Google Form set in `TRACK_FORM` (and are read by the Apps Script as Attempts and Master).
- `assets/stats.js`: loads GoatCounter only when `goatcounter_code` is set in `data/site.json`, never on localhost or local files.
- `assets/figures/`: figures for project cards (webp, with `-full` versions for the lightbox) and the QR codes `phys143-attend-qr.svg`, `phys143-quiz-qr.svg` and `phys143-l1-try-qr.svg`.
- `assets/katex/`: KaTeX, for equations on the research pages.
- `assets/logo/`: favicons and the touch icon.

## 6. PHYS 143 lecture content

- Folder layout: `PHYS143/lecture_N/` for N = 1 to 12 and `PHYS143/introduction/`. File names follow `lectureNN_<topic>.pdf`:
  - `lectureNN_<topic>.pdf`: the lecture slides (published as the student handout, without overlays).
  - `lectureNN_<topic>_handout.pdf`: the handout, shown on the lecture page as a Handout button.
  - `lectureNN_<topic>_reference.pdf`: a reference version (lectures 1 to 3 only).
  - `lectureNN_tutorial.pdf` and `lectureNN_supplement.pdf`.
- Publishing rule: only the no-overlay student PDF goes on the site. The full overlay slide deck stays on the lecturer's computer.
- Each week has three contacts (Understand, Calculate, Apply and Consolidate); the headings come from `contacts` in `data/lectures.json`.
- Lecture topics: 1 Vectors, 2 Motion, 3 Newton's laws, 4 Work and kinetic energy, 5 Potential energy and energy conservation, 6 Gravitation, 7 Impulse and momentum, 8 Rotation, 9 Temperature and heat, 10 Thermal properties of matter, 11 First law of thermodynamics, 12 Second law of thermodynamics. The introduction covers physical quantities, units and measurement uncertainty.
- Lecture content follows the course textbook; wording is adapted to local (Ghana) context and numerical content stays consistent with the book.
- Every PDF link on a lecture page shows Preview (new tab) and Download buttons. A path left empty in `data/lectures.json` shows a disabled "Coming soon". The `PHYS143/` and `PHYS105/` folders are also the Pages CMS media folders (see `.pages.yml`).

## 7. Practice quizzes and the mock exam

- **Banks.** `quizzes/lectureN.json` has `lecture`, `title` and `questions`. Each question has `id` (for example `L2-01`; past exam questions look like `L2-P1718-03`), `type` (`concept`, `calc`, `graph` or `misconception`), `q`, four `options`, `answer` (index 0 to 3), `exp` (explanation), `ref` (where to review) and, for past exam questions, `source`. Current sizes: lecture 0 has 20 questions, 1 has 25, 2 has 35, 3 has 29, 4 has 30, 5 has 28, 7 has 32, 8 has 32, 9 has 30, 10 has 29, 11 has 36 and 12 has 21. Lecture 6 has no bank yet.
- **Practice pages.** Each lecture's practice page shows 20 questions, for practice and not assessment, with a link back to the lecture. The banks are public.
- **Mock exam.** `mock-exam.html` draws 50 questions only from the past exam questions (those with a `source` beginning "Past exam"), with a 2 hour 30 minute timer.
- **Authoring.** The questions are written in Python in `tools/quiz_src/lectureN.py` using helpers in `tools/quiz_src/common.py` (answers are computed from the problem data and rounded to the stated significant figures). `python3 tools/quiz_src/build.py [N ...]` writes `quizzes/lectureN.json`. Then run `python3 tools/validate_quizzes.py` and `python3 tools/check_calcs.py`. Past exam questions were checked separately and are not covered by `check_calcs.py`.
- **Reports.** After a question is answered, students can report a problem; the report goes to the Apps Script (Reports tab) and an email is sent to the lecturer. Optional Student ID results go to the Attempts and Master tabs.

## 8. Live quiz system

Pages: `phys143-quiz.html` (students), `phys143-quiz-host.html` (lecturer dashboard), `phys143-quiz-display.html` (projector). The old Lecture 1 try, host and display addresses redirect to these.

**Weekly quizzes (the normal way).** One page, one dashboard and one display serve every week. The questions are drawn at random, fresh for each round, from that week's practice bank in `quizzes/lectureN.json`; the answers and explanations are checked on the server and sent to students only during Review.

**Join codes.** A code of the form **2627 followed by the week number** is valid automatically if that week has a bank: 26271 is Week 1, 26272 is Week 2, and so on up to 262712 for Week 12. The week is set by the code. Plain **2627** is a general code with a Week chooser (it needs its row in the private Key tab). Any other code needs its own Key row; a code can be given a fixed set of questions with an entry in `apps_script/live_quizzes.json`. The number of questions per quiz is chosen on the dashboard (5 to 20, at most what the bank holds). Weeks are listed in `live_quizzes.json` under `weeks` (Lecture 6 is not listed yet because it has no bank).

**Running a quiz.**
1. Open `phys143-lecturer.html`, log in with the host key, choose **Run quiz**.
2. On the dashboard enter the join code (the key is already kept for the browser tab), press **Switch on lecturer control** the first time for a code, then choose the Week and Number of questions.
3. **Open lobby**: students scan the QR code on the projector view, enter first name, Student ID and the join code, and wait.
4. **Start quiz**, then **Next question** moves the whole class on. **Pause** and **Resume**, and **+1/+2/+5 min**, control the clock. **End quiz** marks everything; **Release results** shows scores and ranking; **Review answers** steps through each question with the correct option, how many chose each option, the student's own answer and the explanation.
5. **Stop**, **Reset: same questions** and **Reset: new questions** are on the dashboard. Nothing is deleted: earlier rounds stay in Form Responses 1.

**Rules.**
- The server holds the quiz state and is the authority. An answer counts only for the open question, before its deadline (15 seconds of grace), while the quiz is running.
- Only a student's first attempt per ID and join code counts in a round; a later round gives a new score.
- Rankings show first names and scores only. IDs are never shown publicly.
- Each response row carries a round number; logging in to the dashboard starts a fresh round.
- Master has one row per student and one column per quiz (Week N, Practice 1 to 11, Practice Intro, Mock exam). Totals is rebuilt automatically when a quiz ends.
- Scoring is by the server; answer letters are never in the page.
- For a class of about 200, repeated reads are cached by the script for a few seconds and the student page polls at random offsets; open the lobby early before a big class.

Full details of every setting are in [`QUIZ_SETUP.md`](QUIZ_SETUP.md).

## 9. Attendance system

Pages: `phys143-lecturer.html` (login), `phys143-attendance.html` (lecturer), `phys143-attend.html` (students).

**Flow.**
1. Log in once on the lecturer menu and choose **Take attendance**. The key is kept for that browser tab only (session storage), never in a web address.
2. Press **Start attendance**. A QR code appears with a **new random code**, different for every session and never reused (not by an earlier session or by a quiz). The code, the QR code and a live count stay on screen while attendance is open.
3. Students scan the QR code. It opens `phys143-attend.html`: **Student ID**, **Attendance code** and a **Present** button, with no name field and no quiz wording. They see "Attendance recorded" or a clear message.
4. **Close attendance and record absences** writes the result to the private Attendance tab.

**Rules.**
- **One mark per Student ID per day.** If an ID has already checked in during any session that day (including a second session, shown as "#2"), a repeat adds nothing and the student sees "Already marked present today". Checking in again never changes a 1.
- **ID to check in, name for the lecturer.** Students need only their ID. The private Roster tab may also hold each student's name (column B) for the lecturer's own view. Names are never returned to any page, reply or email; the only name shown publicly is the first name on a quiz leaderboard.
- **Roster.** A student whose ID is on the roster is marked present. An ID that is not on the roster is told that the sign-in was received and to see the lecturer, and is recorded in red in **Not_On_List**, never in Attendance. A student is told only whether their own ID was found; nothing else about the roster is ever returned.
- **Layout of the Attendance tab.** Student ID in column A; one column per session headed by its date (for example `03/11/2026`, a second session that day reads `03/11/2026 #2`); new sessions go to the right; 1 for present and 0 for every other student on the roster.
- Only the lecturer (host key) can open, close or read attendance. Opening needs a non-empty Roster tab.
- The list of students is private and is never put on the site or in git.

## 10. The Apps Script and the Google Sheet

`apps_script/quiz_receiver.gs` is bound to the private Google Sheet "PHYS 143 Quizzes (Responses)". It is published as a web app. Pages call it with `GET` (JSONP: `?action=...&callback=...`) and `POST` (`kind=...`). The web app address is set as `SCRIPT_URL` in `phys143-attend.html`, `phys143-attendance.html`, `phys143-lecturer.html`, `phys143-quiz.html`, `phys143-quiz-host.html` and `phys143-quiz-display.html`, and is read by `assets/tracking.js`. A new deployment under the same web app keeps the same address; a brand new deployment gets a new address that must be pasted into those pages.

**Sheet tabs** (all private):

| Tab | Holds |
| --- | --- |
| Form Responses 1 | One row per scored attempt: timestamp, first name, ID, join code, Q1 to Q5, Score, Round, Questions, Answers, Week. |
| Key | Join codes and legacy answer letters and ranking mode; the host key cell (stored as a salted hash once changed from the dashboard); settings for Totals (Best or Latest) and Master (On or Off). |
| Quiz_Control | One row per lecturer-controlled quiz: status, question timing, round, week, number of questions, chosen question ids. |
| Presence, Answers | Who joined; each answer as given in a paced quiz. |
| Log | Every submission outcome and lecturer action. |
| Totals, Master | Rebuilt scores per student ID. |
| Reports, Attempts | Student problem reports; optional-ID practice and mock results. |
| Explanations | Optional per-question override of the bank explanation. |
| Roster | Student ID (column A) and optional name (column B), private. |
| Attendance_Control | One row per attendance session: code, label (date and `#n`), status, opened, closed. |
| Attendance_Log | One row per check-in: time, session, ID, on roster (Yes or No). |
| Attendance | The 1 and 0 table described in section 9. |
| Not_On_List | IDs that checked in but are not on the roster. |

**Actions** (`doGet`): `status`, `questions`, `review`, `ranking`, `result`, `display`, `host`, `control`, `setkey`, `hostcheck`, `attend` (student check-in), and the host-only `attend_status`, `attend_open`, `attend_close`. **Posts** (`doPost`): `roster_sync`, `report`, `attempt`, `join`, `progress`, `answer`, and the legacy final submission.

**Protection.** Host actions need the host key. After 30 wrong keys the key check is locked for 10 minutes. The key can be changed from the quiz dashboard (12 to 40 characters; needs the current key). If the key is forgotten, type a new plain key into the host key cell of the Key tab; it works until changed from the dashboard. Entered text is sanitised so a value cannot run as a formula.

**Setup.** Run the `setup` function once from the Apps Script editor. It creates the tabs and settings. `testEmail` checks that report emails reach the lecturer. `rebuildMaster` fills Master from earlier live quizzes. The sheet has a **PHYS 143** menu with **Refresh totals**.

## 11. Roster sync

The Roster tab is filled from the lecturer's computer with a script, so the class list never goes on the site or in git.

- The tool is `attendance_tools/roster_sync.sh`, which lives **on the Mac only** and is not in this repository. It reads `attendance-list.csv` on the Mac, sends **only the Student ID and name columns** (with the host key; `--ids-only` drops names, `--name-column` names the name column) to the Apps Script as a `roster_sync` post, and prints a summary.
- Always run it with `--dry-run` first. A dry run reports how many IDs would be added; nothing is written.
- **Class section.** The Roster must hold only your own section (Group E), not the whole course. Use the section's own Sakai export (`PHYS143_GROUP_E.csv`, on the Mac only) and run `./roster_sync.sh PHYS143_GROUP_E.csv --dry-run`, then `--replace`. `--replace` sends `replace=yes`: the Roster becomes exactly that list and other IDs are removed from the Roster tab only (Attendance, Scores and Master rows are left alone). Check-in, Attendance, Scores and "My results" then involve only that section; any other ID is told to see the lecturer and goes to `Not_On_List`. The tool keeps only the ID column of the CSV.
- **Changing the list later.** (1) A student joins: Control Centre > Class list > type the ID > Add (or run the sync without `--replace` on a fresh export; it only adds). (2) A student leaves: Control Centre > Class list > Remove. Past marks stay in Attendance, Scores and Master; future sessions no longer count that ID. (3) Many changes at once: download a fresh Group E export and run the sync with `--dry-run`, then with `--replace`. (4) Check one ID: Class list > Check (yes or no only). Script action `roster_edit` (host key; `op` = add, remove or check; one ID per call). IDs are never returned.
- **Tidy to class list.** `--replace` changes only the Roster. Afterwards the Attendance, Scores and Master tabs still list the earlier IDs. Use **Control Centre > Class list > Tidy to class list** (or the sheet menu **PHYS 143 > Tidy to class list**): it shows counts, asks, then deletes rows of IDs not on the Roster that have no marks at all (no 1 in Attendance; every quiz cell blank in Scores and Master). Rows with any mark stay. Counts only are shown.
- **Add only.** Without `--replace`, new IDs are appended. IDs already there are left alone and nothing is ever deleted; IDs missing from the upload are only counted as `missing`.
- Limits: IDs of 4 to 12 digits; at most 5000 rows per upload. Skipped rows are counted as `skipped`. The script returns `added`, `unchanged`, `missing`, `skipped` and `total`.
- The host key is entered at run time and is never stored in a file or in this repository.
- After a sync the script clears its cached roster, so the next attendance session sees the new IDs.
- `attendance_tools/mark_attendance.py` (also Mac only) is the older fallback and is no longer needed.

## 12. Privacy and standing rules

- **End of term.** Run `clearSemesterRecords` from the Apps Script editor (answer Yes) to delete all rows of Attendance_Log, Not_On_List, Reports, Attempts and Staged_Quiz. Attendance, Scores, Master and Roster are kept; export what you need first. `attPurgeSemester` still clears device codes and secrets.

- Never put the host key, the class list, student names or any secret in this repository, in a page, or on a slide. Host and display pages and the host link stay off slides.
- Attendance holds **IDs only**. The Roster holds ID and name, in plain form, so the Sheet's sharing is the protection. Names never go in git, on a page, in a reply or in an email. The **Attendance_Named** tab (PHYS 143 menu > Named attendance view) shows names beside the Attendance marks; keep it private.
- The Totals, Master, Roster, Attendance and Not_On_List tabs are never published and the pages never read them.
- Public rankings show first names and scores only.
- Students can type an optional ID on practice pages; it stays in their browser, can be cleared, and nothing is sent without it. No cookies and no analytics beyond anonymous GoatCounter counts.
- The name is written "Hope Donglo", never with "Dr." before it.
- Lecture PDFs: publish only the student handout version without overlays, and only when the lecturer says so.

## 13. Tools in `tools/`

| Script | Use |
| --- | --- |
| `build_shell.py` | Rewrites the navigation menu on every page (`python3 tools/build_shell.py`). |
| `make_lecture_pages.py` | Writes the per-lecture pages and practice pages from `data/lectures.json`. |
| `make_intro_pages.py` | Writes the two introduction pages. |
| `bake.py`, `bake.js` | Store rendered content in the HTML as the no-JavaScript fallback (serve the repo on port 8765 first; paths are sandbox specific). |
| `quiz_src/build.py`, `lectureN.py`, `common.py` | Author the banks and write `quizzes/lectureN.json`. |
| `validate_quizzes.py` | Checks every question: four distinct options, one correct index, explanation and review reference, unique ids, computed values match the stated answer. Exit status 1 on failure. |
| `check_calcs.py` | Recomputes every calculation answer by a different method. |
| `test_practice.mjs` | Playwright test of each practice page (`node tools/test_practice.mjs [baseUrl]`). |
| `old-address-redirect/` | Files for the old `UG-Lectures` address. |

## 14. Deployment and caching

- **Deploy.** Pushing to `main` publishes the site. GitHub Pages updates about a minute later. There is no build step on the server, so what is committed is what is served (generated pages and baked fallbacks must be committed).
- **Pages CMS** saves straight to `main`, so a form edit is a deploy.
- **Caching.** Pages and assets are cached by the browser and by GitHub's CDN for a short time (usually about ten minutes). `render.js` always loads the JSON data with `cache: "no-cache"`, so data edits show on the next load, while an updated `.html`, `.css` or `.js` file can lag. Refresh hard (Ctrl+Shift+R, or Cmd+Shift+R on a Mac). The assets are referenced without a version number today. To get a fresh copy when testing or sharing a link, add a version query such as `?v=2` to the address (for example `phys143-quiz.html?v=2`), and increase the number when you change that file again. The Apps Script reads the public bank files with a time stamp so it never uses an old copy, and also caches them inside the script for five minutes.
- **Search files.** `robots.txt` allows everything and points to `sitemap.xml`. Student and lecturer live pages carry `noindex`.
- **Domain.** The site is at `hhdonglo.github.io`, served from the repository `hhdonglo/hhdonglo.github.io`.

## 15. How to: add or edit a page, lecture or quiz

**Edit text.** Use Pages CMS forms (see `EDITING.md`), or edit the JSON in `data/` on GitHub or locally. Keep text in double quotes with commas between items. A broken JSON file leaves the page's baked fallback visible, so validate with `python3 -m json.tool data/<file>.json`.

**Add a new ordinary page.**
1. Copy an existing page of similar layout, for example `students.html`, to `newpage.html`.
2. Change `<title>`, the meta description, the crumb line and the `data-render` container (add a renderer in `render.js` if it needs a new kind of content, or use `data-render="page"` with a `data/pages/newpage.json` of sections and cards).
3. Add it to the menu if needed in `tools/build_shell.py`, run `python3 tools/build_shell.py`, and add it to `sitemap.xml`.
4. If the page is edited in Pages CMS, add a form in `.pages.yml`.
5. Commit and push.

**Publish or update a lecture.** Put the PDFs in `PHYS143/lecture_N/` (only the no-overlay student versions). In `data/lectures.json` set the lecture's `status` to `available` and fill `title`, `summary`, `outcomes`, `slides`, `handout`, `tutorial`, `supplement` and `practice`. Leave a path empty to show "Coming soon". If the page is new, run `python3 tools/make_lecture_pages.py`. Update the baked fallback with `tools/bake.py` or by hand. Commit, push, and refresh hard.

**Add a lecture 13.** Add the lecture to a group in `data/lectures.json`, then run `python3 tools/make_lecture_pages.py` (or copy `phys143-lecture-12.html` and change 12 to 13 in `data-n`, the title and the heading). Add `tools/quiz_src/lecture13.py` if it has questions.

**Add or change practice questions (a bank).**
1. Edit or add `tools/quiz_src/lectureN.py` and run `python3 tools/quiz_src/build.py N`, or edit `quizzes/lectureN.json` directly.
2. Run `python3 tools/validate_quizzes.py` and `python3 tools/check_calcs.py`.
3. Commit and push. The practice page, the mock exam (past exam questions only) and the live quiz all read the same file.

**Make a bank available to live quizzes.** The bank needs at least five questions. Add its week under `weeks` in `apps_script/live_quizzes.json`. Join code 2627 plus the week number then works with no Key row. For Lecture 6 this means adding `quizzes/lecture6.json`, a `"6"` entry under `weeks`, and a practice page for lecture 6 (`tools/make_lecture_pages.py`).

**Run a quiz with a code of your own.** Add a row in the Key tab with the new code (letters empty, ranking Open), open the dashboard with that code and the host key, press **Switch on lecturer control**, and choose the week and number of questions. Never reuse a code.

**Regenerate the QR codes.** `assets/figures/phys143-attend-qr.svg` points to the attendance check-in page and `phys143-quiz-qr.svg` to the quiz page. If a page address changes, make a new SVG with any QR tool (for example `segno`) and replace the file.

**Update the CV.** The CV page has no download link: visitors request the full CV by email. Keep the master copy of the PDF outside the public site.

## 16. How to: redeploy the Apps Script

Changing `quiz_receiver.gs` in this repository does not change the live script. The script must be pasted into Google and redeployed.

1. Open the Google Sheet "PHYS 143 Quizzes (Responses)", then **Extensions, Apps Script**.
2. Replace the whole script with the contents of `apps_script/quiz_receiver.gs` and **Save**.
3. If this is a first setup or tabs are new, choose `setup` in the function list and **Run** (it asks for permissions the first time; choose your account and allow).
4. **Deploy, Manage deployments**, choose the web app, press the pencil (Edit), set **Version: New version**, and **Deploy**. Keep "Execute as: Me" and "Who has access: Anyone". Editing the existing deployment keeps the same web app address. Creating a new deployment instead gives a new address, which must then be pasted as `SCRIPT_URL` into the pages listed in section 10 (and into `assets/tracking.js` if used there).
5. Test: open `phys143-attend.html` with an unknown code (it must refuse), and open the lecturer menu with the host key.

Whenever the script changes, run one full test before class: lobby, join, a short quiz, and attendance open and close. Delete test rows from Form Responses 1 and Attendance afterwards, then use **Refresh totals** in the PHYS 143 menu.

## 17. Git workflow on the Mac

The local copy is `~/Documents/hhdonglo.github.io`. The GitHub command line (`gh`) is not logged in on the Mac, so pull requests are merged locally with plain git rather than with `gh`. A typical cycle when a pull request has been prepared (for example by Claude):

```bash
cd ~/Documents/hhdonglo.github.io
git fetch origin
git checkout main
git pull origin main
git merge origin/<branch-name>      # or merge the branch name given with the pull request
git push origin main
```

Then wait about a minute and refresh the live page hard.

Other everyday steps:

```bash
git status                         # see what changed
git add -A && git commit -m "Short plain message"
git push origin main               # publish
git log --oneline -5               # recent changes
```

To undo a bad change, find the commit with `git log --oneline` and run `git revert <commit>` then push, or restore a file in the GitHub History view.

Notes:
- Pushes are done to `main` because Pages publishes `main`.
- Never put the class list (`attendance-list.csv`), the host key or any secret in the repository. Keep `attendance_tools/` outside commits.
- Changes made in Pages CMS arrive on `main` by themselves, so `git pull origin main` first on the Mac.

## 18. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| A change does not show on the live site | Wait a minute, then hard refresh. Add `?v=N` to the address to bypass the cache. |
| Page shows old text but data was edited | The baked fallback is stale or JavaScript is off; refresh bake or check the JSON is valid. |
| A page shows only fallback content | The JSON has a syntax error. Run `python3 -m json.tool` on it. |
| A quiz code is "not valid" | The week has no bank or is missing from `apps_script/live_quizzes.json`, or a non-week code has no Key row. |
| Student gets an error at check-in | Attendance not open, wrong code, or ID outside 4 to 12 digits. The student sees a clear message for each. |
| "The Roster tab is empty" on Start attendance | Run roster sync (section 11). |
| Host key not accepted | Wrong key, or locked for 10 minutes after 30 wrong keys. Reset it in the Key tab if forgotten. |
| Script change has no effect | The script was not pasted and redeployed as a New version (section 16). |
| Report emails do not arrive | Run `testEmail` once in the script editor and allow the permission. |
| Practice bank change not seen in live quiz | The script caches bank files for up to five minutes; wait or start a new round. |
