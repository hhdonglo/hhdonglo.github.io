# Class Manager: architecture

Written 9 November 2026 from the code on branch `claude/project-thread-h89zsr` (commit 022dca7 and the documentation commit that follows it). It describes the system as it stands, for review. Every statement was checked against the source. Where something is a judgement rather than a fact, it is labelled as such, in the last two sections.

## 1. Purpose and scope

Class Manager runs one university course, PHYS 143, from one package:

- course and lecture pages;
- practice quizzes and a mock examination;
- a live, lecturer-paced quiz and attendance check-in;
- mark tabs for the lecturer;
- student progress, teaching insights, groups, a calendar, messages and announcements.

The desktop app adds a resource library with question authoring.

The package lives in `class-manager/` of the site repository. It is separate from the live PHYS 143 pages at the root of the site.

## 2. System overview

The system has three layers:

1. **Pages.** Static HTML and plain JavaScript, with no framework and no build step. Students and the lecturer open them in a browser.
2. **One server script.** `apps_script/quiz_receiver.gs` (2,577 lines) holds every rule: scoring, attendance, access, the calendar, messages and the rest.
3. **One workbook.** It holds every record, one tab per kind of record.

The same server script runs in two places: in Google Apps Script, or inside the desktop app. Section 3 gives the three ways the package can be deployed.

```
             Students' phones and laptops                Lecturer
             (portal, practice, live quiz,               (lecturer menu, Control Centre,
              check-in, calendar, messages)               insights, groups, calendar, messages)
                          \                                   /
                           \  HTTP GET pages and JSON banks  /
                            v                               v
   +---------------------------------------------------------------------+
   |  Static pages  (index.html, quiz.html, calendar.html, ... assets/*) |
   |  config.js gives CM.scriptUrl: where the server script answers      |
   +---------------------------------------------------------------------+
                            |  JSONP GET  ?action=...   (reads, lecturer actions, chat)
                            |  form POST  kind=...      (answers, joins, attempts, reports)
                            v
   +---------------------------------------------------------------------+
   |  Server script  apps_script/quiz_receiver.gs                        |
   |  doGet(e) / doPost(e): host key and access-code checks, rules       |
   |  reads banks:  SITE + /quizzes/lectureN.json, /apps_script/live_quizzes.json
   +---------------------------------------------------------------------+
                            |  SpreadsheetApp (rows), CacheService, PropertiesService, LockService
                            v
   +---------------------------------------------------------------------+
   |  Workbook: Google Sheet, or workbook.json on the lecturer's computer|
   +---------------------------------------------------------------------+
```

## 3. Deployment modes

| Mode | Pages served from | Server script runs in | Records kept in | Reach |
|---|---|---|---|---|
| A. Static site with Google | Any static host; GitHub Pages at `hhdonglo.github.io/class-manager` | Google Apps Script web app bound to a Google Sheet | The Google Sheet | Anywhere with internet |
| B. Desktop app, local | The app's own HTTP server, `0.0.0.0:8143` by default | Node `vm` inside the Electron main process (`desktop/backend.js`) | `workbook.json` in the app's data folder | Devices on the same network while the app is open |
| C. Desktop app with an Apps Script address | The app's HTTP server | Google Apps Script (Settings: "Apps Script web app address") | The Google Sheet | Pages on the local network; records online |

In mode B, the optional Google sign-in (`desktop/google.js`) copies every tab one way to a Google Sheet in the lecturer's Drive. The scope is `drive.file`. This copy is a backup and a view. It does not serve students.

```
 Desktop app (Electron)
 +--------------------------------------------------------------------------------+
 | main.js                                                                        |
 |   HTTP server 0.0.0.0:8143 --- /            -> class-manager pages (resources/web)
 |                              --- /config.js  -> generated from Settings         |
 |                              --- /exec       -> backend.doGet / doPost          |
 |                              --- /calendar.ics -> backend.doGet(calendar_ics)   |
 |                              --- /quizzes/lectureN.json, /apps_script/live_quizzes.json
 |                              |                -> authoring.siteFile (merged)    |
 |                              --- /app/*      -> app screens, this computer only |
 |   IPC (preload.js: window.cmApp) <- app/home.html, app/author.html             |
 |                                                                                |
 | backend.js   vm context: quiz_receiver.gs + shims for SpreadsheetApp,          |
 |              CacheService, PropertiesService, LockService, UrlFetchApp,        |
 |              Utilities, ContentService, MailApp (no-op), Session               |
 |              -> userData/data/workbook.json (written 400 ms after a change)     |
 | authoring.js resource library, BM25 search, summaries, generation, import,     |
 |              drafts, bank overlay -> userData/authoring/                       |
 |              -> api.anthropic.com (only with an API key)                       |
 | google.js    OAuth (loopback, PKCE) -> one-way copy of all tabs to a Sheet     |
 | tunnel.js    optional internet address: cloudflared quick tunnel -> second     |
 |              server on 127.0.0.1 (remote requests: no /app/, 240 per minute)    |
 +--------------------------------------------------------------------------------+
```

## 4. Repository layout

| Path | Role |
|---|---|
| `config.js` | Course code, title, institution and the server address (`window.CM`), plus page helpers. In the desktop app it is generated from Settings, with `desktop: true`. |
| `index.html` | Student portal: what is open in class, this week, announcements, the next events, My progress (ID plus access code), and an install prompt. |
| `course.html`, `lecture-N.html`, `lecture-N-practice.html`, `introduction*.html`, `mock-exam.html` | Course pages, practice (`assets/practice.js`) and the mock examination (`assets/mock.js`). |
| `quiz.html`, `quiz-host.html`, `quiz-display.html` | The live quiz for students, the lecturer's controls, and the projector. |
| `attend.html`, `attendance.html` | Student check-in and the lecturer's attendance session. |
| `lecturer.html`, `control.html` | Lecturer menu and Control Centre. Both use the host key. |
| `insights.html`, `codes.html`, `groups.html` | Teaching insights, access codes, and student groups (host key). |
| `calendar.html` | Course calendar: public read, lecturer edit. |
| `messages.html` | Announcements and messages for students and the lecturer. |
| `quizzes/lectureN.json` | Question banks: 347 questions, lectures 0 to 12, no bank for lecture 6. |
| `apps_script/live_quizzes.json` | Weeks that have a live quiz, and optional fixed question sets per join code. |
| `apps_script/quiz_receiver.gs` | The server script. |
| `assets/` | Shared CSS and JS, the QR code generator, KaTeX, `messages.js` (error texts), `tracking.js` (practice attempts), and icons. |
| `sw.js`, `manifest.webmanifest` | Installable portal; network first, with the shell cached for offline use. |
| `data/`, `PHYS143/` | Course data for the portal and the lecture materials. |
| `tools/` | `validate_quizzes.py`, `check_calcs.py`, `test_practice.mjs`, and the bank build in `quiz_src/`. |
| `desktop/` | The Electron app: `main.js`, `preload.js`, `backend.js`, `authoring.js`, `google.js`, `app/home.html`, `app/author.html`, `app/question-template.md` and `.docx`, and `package.json` (build). |
| `README.md`, `STRUCTURE.md`, `desktop/README.md`, `ARCHITECTURE.md` | Documentation. `STRUCTURE.md` and `ARCHITECTURE.md` are left out of the installers. |

## 5. Server script: endpoints

All reads and lecturer actions use JSONP GET: `?action=...&callback=...`. Submissions use form POST with `kind=...`. The tables below list every action in `doGet` and `doPost`.

**Public or student (no host key).**

| Action | Purpose | Check |
|---|---|---|
| `status`, `display`, `questions`, `review`, `ranking`, `result` | Live quiz state, the projector, questions for the current round, review, the first-name ranking, and the student's own result | Join code, and Student ID where relevant |
| `portal_status` | Whether attendance or a quiz is open and whether My results is on (cached 5 s) | None |
| `my_results` | A student's attendance, quizzes, practice, mastery, revisit list and groups | Student ID plus access code; six failures lock the ID for 10 min |
| `attend`, `attend_status` | Check-in, and the session state | Rotating QR token, device token, rate limit |
| `calendar`, `calendar_ics` | Events visible to students; the iCalendar file or feed | None. With the host key, lecturer-only events are included. |
| `announcements` | Announcements for everyone; more for a signed-in student | None, or ID plus access code |
| `chat` | Conversations and messages | ID plus access code, or the host key |
| `hostcheck`, `version` | Is this key right; the script version (`SCRIPT_VERSION` must equal `EXPECT_VERSION` in `control.html`) | None |

**Lecturer (host key).**

| Area | Actions |
|---|---|
| Quiz | `control` (open, start, pause, next, end, release, reset), `host`, `held_status`, `held_release_quiz`, `held_discard_quiz`, `set_week`, `preclass` |
| Attendance | `attend_open`, `attend_close`, `attend_submit`, `attend_discard` |
| Class list | `roster_edit`, `roster_tidy`; POST `roster_sync` |
| Key | `setkey` (store the host key as a salted SHA-256) |
| Learning | `insights`, `access_codes` (list, generate, reset), `groups` (make, move, lock, mark, delete, list) |
| Calendar | `calendar_edit` (save, series, delete, delete_series) |
| Announcements | `announcements` with `op` (save, delete) |
| Messages | `chat` with `op` (remove, restore, mute, unmute, settings, group_delete, export) |

**POST kinds.** `join`, `joined`, `progress`, `answer` (paced quiz, with an optional confidence), `quiz` (timed quiz), `attempt` (practice, with the question IDs asked), `report` (a problem reported on a question), `inprogress`, `roster_sync`.

**Concurrency.** Writes take `LockService.getScriptLock()`. Reading chat and announcements takes no lock. A chat poll returns `{same: true}` at once when the version stamp `chat_ver` in `CacheService` has not changed.

## 6. Data model: workbook tabs

| Tab | Content | Written by |
|---|---|---|
| Key | Join codes and correct letters; J2 is the host key (plain, or `sha256:salt:hex`); the settings columns K, L and N (week) | `setup`, lecturer |
| Quiz_Control | One row per lecturer-run quiz: status, timers, mode, round, review question, N, question IDs, week | Live quiz |
| Presence, Answers, Staged_Quiz | Who joined; paced answers with confidence; results held until released | Live quiz |
| Form Responses 1 | Released results: name, ID, join code, letters, score, round, questions, answers, week | Release |
| Master, Scores, Totals | One row per student, one column per quiz; the clean grid; totals (Best or Latest) | Rebuilt automatically |
| Log, Reports, Attempts | Submission outcomes; reported problems (emailed in mode A); practice tries with question IDs | POST |
| Explanations | Optional explanation overrides per join code | Lecturer |
| Roster | Student ID and name (the class list) | Class list sync, roster edit |
| Attendance_Control, Attendance_Log, Attendance, Not_On_List, Attendance_Flags | Sessions; held check-ins; the grid; unknown IDs; flags | Attendance |
| Item_Log | One row per student per live quiz question (answer, correct, confidence) | Finalising a quiz |
| Access_Codes | Student ID, personal code (`XXXX-XXXX`, no 0, O, 1, I or L), issued | Lecturer |
| Question_Stats | Per-question proportion correct, discrimination and label | Teaching insights |
| Groups | Set, group, ID, name, group mark, out of, locked, created | Groups |
| Calendar | Event ID, title, kind, start, end (local text `YYYY-MM-DDTHH:MM`), all day, location, agenda, resources, week, linked session, visibility, series, created, updated | Calendar |
| Messages | Message ID, time (ms), conversation, from, name, text, status, removed by | Chat |
| Chat_Groups | Group ID, name, owner, members, created | Chat |
| Chat_Read | Who, conversation, last read (ms); `ANN` holds the last read time of announcements | Chat, announcements |
| Announcements | ID, title, text, audience, pinned, show from, link, event ID, created, updated, status | Lecturer |

**Script properties.** `draw_salt` (per-workbook question draw), and `chat_mode` (on, announce, off), `chat_dm`, `chat_groups`, `chat_rules` and `chat_muted` (a JSON map).

**Conversation IDs.**

- `CLASS`: the whole class.
- `L:<set>|<group>`: a lecturer-made group, taken from the Groups tab.
- `S:<id>`: a group made by students.
- `DM:<studentId>`: a student and the lecturer.
- `P:<idA>:<idB>`: two students, IDs sorted.

**Desktop data folder.** This is `userData`, for example `~/.config/Class Manager` on Linux. It holds:

- `settings.json`;
- `data/workbook.json` (all tabs and properties; dates stored as `{$d: ISO}`);
- `google.bin` (OAuth tokens) and `anthropic.bin` (the API key), both encrypted with `safeStorage` where available;
- `authoring/library/` (copies of documents, `<id>.chunks.json`, `index.json`);
- `authoring/drafts.json` and `authoring/settings.json` (the model);
- `authoring/banks/lectureN.json` (approved questions, with a `next` counter).

## 7. Authentication and access

| Who | Credential | Where checked |
|---|---|---|
| Lecturer | Host key: 16 random hexadecimal characters made at setup, optionally replaced and stored hashed | `hostOk_`; 30 failures lock it for 10 min (CacheService). Kept in `sessionStorage` (`phys143_hk`) by lecturer pages. |
| Student, own record and chat | Student ID on the class list plus a personal access code | `portalResults_`, `chatWho_`; 6 failures lock the ID for 10 min. Optionally remembered in `localStorage`. |
| Student, live quiz | Join code shown in class, plus name and ID | Presence and round rules; first submission counts |
| Student, attendance | Rotating QR token (30 s slots), device token, one check-in per ID per session | Attendance hardening section |
| App screens (`/app/*`) | Request from this computer's own addresses | `isThisComputer` in `main.js` |

Access codes reach students on printed slips (`codes.html`). Names from the class list are shown to other students only in two places: group members (groups, chat) and the senders of messages. Student IDs are shown to the lecturer only.

## 8. Main flows

**Live quiz (paced).**

1. The lecturer opens a round in `quiz-host.html`. The server draws N questions (5 to 20) from the week's bank. The draw is seeded with the join code, the round and `draw_salt`.
2. Students join on `quiz.html`. Each answer is POSTed (`kind=answer`) and checked against the open question, its deadline and presence.
3. At the end, answers are compiled into Staged_Quiz and Item_Log.
4. **Release** copies them to Form Responses 1 and rebuilds Master, Scores and Totals.
5. The projector (`quiz-display.html`) shows each option's share during review.

**Attendance.** Open a session, then students check in (the token is checked). Check-ins wait in Attendance_Log. **Submit** writes the Attendance grid; **Discard** drops the session.

**Practice.** `practice.js` loads `quizzes/lectureN.json` and runs entirely in the browser. When a student types an ID, `tracking.js` POSTs an attempt with the question IDs. Practice tries join Master and Scores at release, and only for IDs on the class list.

**Store and forward (messages and announcements).**

```
 sender page --GET action=chat&op=send--> chat_(): check sign-in, membership, mode, pause, rate (8/min), length (1000)
                                           append row to Messages; bump chat_ver; mark sender's read time
 recipient page (later) --GET action=chat&v=<last version>--> unchanged? {same:true}
                                           changed? conversations with unread counts (Chat_Read vs Messages)
                                           + messages of the open conversation; own messages carry Sent / Read / Read by n
 recipient opens a conversation --op=read--> Chat_Read updated; the sender's next poll shows Read
```

Pages poll every 8 seconds while visible, and again when they become visible. Nothing is pushed: there is no WebSocket or server-sent events. Removed messages keep their text for the lecturer, and students see "Message removed by the lecturer".

**Calendar.**

- Events are stored as local time text.
- `calOut_` adds UTC start and end, and fills a missing end (one hour, or zero for a deadline).
- A series creates up to 30 events every 1, 7 or 14 days, sharing a series ID. When a course week is set, it advances by one per event.
- The iCalendar output follows RFC 5545: lines folded at 73 characters, UTC times, `VALUE=DATE` for all-day events, a reminder one day before quizzes, examinations and deadlines, and `REFRESH-INTERVAL` of 6 hours.
- The page builds single-event and whole-calendar `.ics` files in the browser, and makes Google Calendar and Outlook links from the UTC times.

**Announcements.** Each announcement has an audience:

- `all`: shown publicly, on the portal;
- `class`: signed-in students only;
- a comma list of `L:` or `S:` conversation IDs: members of those groups.

An announcement whose "show from" time is in the future is hidden from students until that time. An announcement can link to a calendar event, which appears only if the event is visible to students.

## 9. Resources, retrieval and the language model (desktop only)

```
 add file --> extract text            --> chunk (~900 chars, per page or slide) --> library/<id>.chunks.json
              PDF: unpdf (pdf.js), lines rebuilt from text positions
              DOCX: mammoth raw text; PPTX: jszip, <a:t> runs per slide; MD/TXT: as is
 search   --> BM25 over all passages (k1 = 1.4, b = 0.75), terms = lower-case words, stop words removed, plural s stripped
 summary  --> with key: Claude, whole document (map-reduce above 600,000 characters, parts of 400,000)
              without key: extractive (sentences scored by tf-idf, 5 to 14 kept in order, plus 14 key terms)
 generate --> passages: whole documents if no focus and under 300,000 characters; else BM25 top passages up to 300,000
              + plain stems of the lecture's existing questions (to avoid repeats)
              --> Claude (JSON schema: quizzes[].questions[] with type, difficulty, q, options, answer, exp, ref)
              --> options shuffled, text sanitised to HTML --> drafts.json (status draft, batch, set, source documents)
 import   --> same extraction --> template parser --> validation --> preview --> drafts
 approve  --> validation (4 distinct options, valid answer, lecture) --> banks/lectureN.json, ID L{n}-U{nn}
              server merges course bank + overlay for /quizzes/lectureN.json and live_quizzes.json weeks;
              the script's 5-minute bank cache is cleared
```

**Model call** (`askJson` in `authoring.js`). The call is made with the official SDK, `@anthropic-ai/sdk` 1.6.0:

- `messages.stream(...).finalMessage()`;
- model from Settings (default `claude-opus-5-5`);
- `thinking: {type: "adaptive"}` and `output_config: {effort: "high", format: {type: "json_schema", schema}}`;
- for the models that accept it, the beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`;
- `max_tokens` of 16,000 for summaries, and up to 64,000 for generation.

Error types (authentication, permission, not found, rate limit, connection) become plain messages. A `refusal` or `max_tokens` stop is reported, and nothing is saved.

**Validation rules** (shared by import, editing and approval):

- the question has text;
- exactly four options, none empty, no two the same;
- the answer index is valid;
- the lecture is set.

Two warnings do not block approval: a missing explanation or difficulty, and a duplicate of a bank question or another draft.

**Text safety.** All imported and generated text is escaped. Only `<sub>`, `<sup>`, `<em>`, `<strong>`, `<b>`, `<i>` and `<br>` are re-allowed, and `^` and `_` notation becomes `<sup>` and `<sub>`.

## 10. Security and privacy model

- **Secrets.** No secrets are in the repository. The host key is in the workbook only. The API key and Google tokens are in the app's data folder, encrypted with the system keychain when `safeStorage` is available.
- **Student data.** It stays in the workbook. Nothing about students is sent to Anthropic: requests contain only the lecturer's documents, instructions and existing question stems. The end-to-end test checks this.
- **Pages from the desktop server** run in sandboxed `BrowserWindow`s (`contextIsolation`, `sandbox`, no `nodeIntegration`). External links open in the system browser, and navigation away from the local server is blocked. The `cmApp` bridge exposes a fixed list of IPC calls.
- **Server paths.** `/app/*` answers only to this computer. Other `/apps_script/*` paths return 404. Static paths are confined to the web root.
- **Sheet values.** Typed values beginning `=`, `+`, `-` or `@` are prefixed so that the sheet does not run them as formulas.
- **Rate limits.** Host key: 30 failures per 10 min. Access code: 6 per ID per 10 min. Messages: 8 per minute per student. Attendance: per-device and per-ID rules.
- **Moderation.** The lecturer reads every conversation. Students are told so on the page.

## 11. Configuration

- **`config.js`.** Course labels and `scriptUrl` (mode A). In the desktop app, Settings (`settings.json`) generates this file: course code, title, institution, an optional Apps Script address, and the port.
- **Constants at the top of the script sections.** `SITE` (where the script reads banks in mode A), `NOTIFY_EMAIL`, `GRACE_MS`, attendance constants (`ATT_*`), and chat limits (`CHAT_MAX`, `CHAT_PER_MIN`, `CHAT_GROUP_MAX`, `CHAT_OWN_MAX`).
- **Key tab settings.** Totals rule (Best or Latest), Master on or off, and the live quiz week.
- **Chat settings.** Set in the moderation panel and stored as script properties.
- **Resources and questions.** The API key and the model, in the app.

## 12. Build and packaging

- **Pages.** No build step. They are served as files.
- **Desktop app.** Electron 44.9.3 with electron-builder 26.18.0, from `desktop/package.json`. Run `npm run dist:mac`, `dist:win` or `dist:linux`. The outputs are a universal macOS DMG (ad hoc signature), a Windows NSIS installer (x64) and a Linux AppImage.
- **What the app bundle contains.**
  - `app.asar`: `main.js`, `preload.js`, `backend.js`, `google.js`, `authoring.js`, `app/**`, `google-oauth.json` (if present) and the production dependencies (`@anthropic-ai/sdk`, `mammoth`, `unpdf`, `jszip`).
  - `resources/web`: the class-manager folder, except `desktop/`, `tools/`, `README.md`, `STRUCTURE.md`, `ARCHITECTURE.md` and `.nojekyll`.
- **Release.** A private draft GitHub release `class-manager-v0.1.0` holds earlier installers. Publishing it needs Hope's approval.

## 13. Testing

| Suite | What it covers | Where |
|---|---|---|
| `tools/validate_quizzes.py`, `tools/check_calcs.py`, `tools/test_practice.mjs` | Bank schema and calculations, and the practice engine | Repository |
| Server checks | 36 (core and learning), 17 (groups), 14 (calendar), 38 (messages and announcements), run against `backend.js` | Session scratch files; not yet in the repository |
| Browser checks | 17 (learning pages), 11 (groups pages), via Playwright against the running app | Session scratch files |
| End to end, packaged app | 45 checks, via Playwright's Electron driver against `dist/linux-unpacked`, with a stand-in for the Anthropic API that records requests: library (four formats), search, both summaries, generation request shape, review and approval into served banks, import preview, manual entry, withdrawal, no student data in requests, calendar views and series, `.ics` and feed, portal, messages, moderation, delivery states, store and forward | Session scratch files |

None of the session suites has been run against Google Apps Script itself. Generation and Claude summaries have not been run against the real Anthropic API.

## 14. Known limits and technical debt

1. **Desktop reach.** In mode B, students reach the app on the same network, or from anywhere through the optional internet address (a Cloudflare quick tunnel, `desktop/tunnel.js`), and only while the app is open. The internet address changes at each start, so external calendar subscriptions to it do not last.
2. **Google copy is one way.** The copy from the desktop app to a Sheet is one way. Moving from mode B to mode A is not a migration path for messages or the calendar.
3. **Polling.** Chat polls every 8 seconds over JSONP. In mode A, each poll is an Apps Script execution. The version stamp keeps unchanged polls short, but a large class with chat open adds up against Apps Script quotas and concurrency (judgement: worth measuring before heavy use).
4. **Whole-tab reads.** Every chat sync reads the Messages, Chat_Read and Chat_Groups tabs in full, and the roster and codes. Cost grows with the number of messages; there is no archive or paging.
5. **Secrets in URLs.** Host key and access codes travel as GET query parameters, so they can appear in browser history and server logs. In mode B, the transport is plain HTTP on the local network.
6. **Host key strength.** Fixed on 9 November 2026: setup now makes the host key from a random UUID (16 hexadecimal characters). Keys made before that are 8 base-36 characters from `Math.random` and can be replaced with `setkey`.
7. **Owner email in the script.** Fixed on 9 November 2026: `NOTIFY_EMAIL` is empty in the package, and reports go to the Google account that deployed the script. The desktop app sends no email.
8. **One large script file.** The server script is a single 2,577-line file with sections, not modules. Tab layouts are positional (column numbers in code).
9. **Tests outside the repository.** The session test suites are not committed and there is no CI for the package.
10. **Fixed upper bound on the week.** `setWeek_` accepts weeks 0 to 12 only, although banks may now be added for other lectures.
11. **Desktop-only authoring.** The web version has no authoring screen; new questions there mean editing `quizzes/lectureN.json`.
12. **Model output limits.** The schema does not force four options. Approval rejects any other count. Shuffling assumes explanations do not name option letters, and the prompt forbids that.
13. **Scanned PDFs.** These have no text layer and cannot be read; there is no OCR.
14. **Dates.** Calendar times follow the script's time zone, which in mode B is the computer's.

## 15. Candidate improvements

These are proposals for review, ordered by the value they would give relative to effort (judgement).

1. **Commit the test suites** under `class-manager/tests/` with a single command, and run the server and end-to-end suites in GitHub Actions on each push.
2. **Move secrets out of URLs.** Send the host key and access codes in POST bodies, or exchange them once for a short-lived session token held in memory.
3. **Make the colleague package neutral.** Done for the report email (item 7 above).
4. **Strengthen the host key.** Done for generation (item 6 above). Hashing it by default remains open.
5. **Push in the desktop app.** Server-sent events on the local server would deliver messages at once and reduce polling. Mode A would keep polling.
6. **Messages at scale.** Add an archive tab per term, and read only recent rows (the last N per conversation) on sync.
7. **Two-way Google storage for mode B.** Use the Google-hosted script as the single record, with the desktop app as a client. Mode C already does this, and could be offered as the default once signed in.
8. **Split the server script** into files per area (Apps Script allows several `.gs` files in one project, and `backend.js` can load them in order). Add a header map per tab, so that columns are found by name.
9. **Authoring on the web.** A host-key page that posts approved questions to a Questions tab, merged by `siteJson_`. This would give mode A the review queue without editing files.
10. **Retrieval quality.** Add embeddings or a reranking step alongside BM25 when the library grows beyond a few hundred passages, and show the passages used for each generated question in the review screen.
11. **Generation checks.** Run `check_calcs.py`-style numerical checks on generated calculation questions before they reach review, and let the lecturer regenerate a single question.
12. **Week range.** Derive the allowed range from `live_quizzes.json` instead of the fixed 0 to 12.
13. **Accessibility pass.** Audit the new pages with a screen reader and keyboard only (the views use buttons and live regions, but this has not been audited).
