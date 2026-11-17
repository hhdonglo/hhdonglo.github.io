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
2. **One server script.** `apps_script/quiz_receiver.gs` holds every rule: scoring, attendance, access, the calendar, messages and the rest. It is built from eight modules in `apps_script/src/` (core, assessment, attendance, analytics, collaboration, communication, portal, router) by `apps_script/build.js`, so that Google Apps Script still receives one file.
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
   |  Workbook: Google Sheet, or course.db (SQLite) on the lecturer's computer|
   +---------------------------------------------------------------------+
```

## 3. Deployment modes

| Mode | Pages served from | Server script runs in | Records kept in | Reach |
|---|---|---|---|---|
| A. Static site with Google | Any static host; GitHub Pages at `hhdonglo.github.io/class-manager` | Google Apps Script web app bound to a Google Sheet | The Google Sheet | Anywhere with internet |
| B. Desktop app, local | The app's own HTTP server, `0.0.0.0:8143` by default | Node `vm` inside the Electron main process (`desktop/backend.js`) | `course.db` (SQLite) in the course's data folder | Devices on the same network while the app is open |

The optional Google copy of mode B was removed in version 0.23.0 (see google-path-removal.md). Phones reach the lecturer's computer, or the relay when the computer is off.

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
 |              -> courses/<id>/data/course.db (changed tabs written 400 ms after a change)     |
 | authoring.js resource library, BM25 search, summaries, generation, import,     |
 |              drafts, bank overlay -> userData/authoring/                       |
 |              -> api.anthropic.com (only with an API key)                       |
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
| `apps_script/quiz_receiver.gs` | The server script, generated: do not edit it by hand. |
| `apps_script/src/*.gs`, `apps_script/build.js` | The server script's modules and the build that joins them in file-name order (`node apps_script/build.js`; `--check` in CI). |
| `assets/` | Shared CSS and JS, the QR code generator, KaTeX, `messages.js` (error texts), `tracking.js` (practice attempts), and icons. |
| `sw.js`, `manifest.webmanifest` | Installable portal; network first, with the shell cached for offline use. |
| `data/`, `PHYS143/` | Course data for the portal and the lecture materials. |
| `tools/` | `validate_quizzes.py`, `check_calcs.py`, `test_practice.mjs`, and the bank build in `quiz_src/`. |
| `desktop/` | The Electron app: `main.js`, `preload.js`, `backend.js`, `authoring.js`, `linked-folder.js` and `storage-providers.js` (optional encrypted copies in a folder kept in the cloud by a sync app; tested in `test/linked-folder.test.js`), `sync/` and `storage/` (keeping records and materials in step with a linked cloud place), `table.js` (reads CSV and Excel class lists), `xlsx-book.js`, `import-values.js`, `import-specs.js`, `import-plan.js`, `import-apply.js`, `import-ipc.js` (importing results from the web version, see `desktop/IMPORT.md`), `autoload-ipc.js` and `autoload/` (point the app at a folder: it finds the class list, quiz results, attendance and quiz questions in files of any layout, keeps only those fields in a clean working file in the app's data folder, and previews them through the same import; see `desktop/autoload/README.md`), `excel.js` (writes Excel workbooks: the class list template and the results of one course), `names.js` (joins first and last names for the class list, and replaces each whole-name column by First name and Last name in every export; pure functions, tested in `test/names.test.js`), `app/home.html`, `app/author.html`, `app/question-template.md` and `.docx`, and `package.json` (build). |
| `README.md`, `STRUCTURE.md`, `desktop/README.md`, `ARCHITECTURE.md` | Documentation. `STRUCTURE.md` and `ARCHITECTURE.md` are left out of the installers. |

## 5. Server script: endpoints

Since 0.9.0 the pages send every request by form POST through `CM.call` (in `config.js`): `action=...` for reads and lecturer actions, `kind=...` for submissions. A GET (JSONP) request is still answered for public data, but any request that carries the host key, an access code or a session is refused by GET, so credentials never appear in a web address. The tables below list every action.

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
| Key | `setkey` (choose or change the password: salted slow hash, new recovery code), `password_status` (public), `password_recover` (public, rate limited: recovery code instead of the old password) |
| Learning | `insights`, `access_codes` (list, generate, reset), `groups` (make, move, lock, mark, delete, list) |
| Calendar | `calendar_edit` (save, series, delete, delete_series) |
| Announcements | `announcements` with `op` (save, delete) |
| Messages | `chat` with `op` (remove, restore, mute, unmute, settings, group_delete, export) |

**POST kinds.** `join`, `joined`, `progress`, `answer` (paced quiz, with an optional confidence), `quiz` (timed quiz), `attempt` (practice, with the question IDs asked), `report` (a problem reported on a question), `inprogress`, `roster_sync`.

**Concurrency.** Writes take `LockService.getScriptLock()`. Reading chat and announcements takes no lock. A chat poll returns `{same: true}` at once when the version stamp `chat_ver` in `CacheService` has not changed.

## 6. Data model: workbook tabs

| Tab | Content | Written by |
|---|---|---|
| Key | Join codes and correct letters; J2 is the password (a temporary plain key on a new workbook, then `pw1:rounds:salt:hash`; older `sha256:salt:hex` still accepted); the recovery code is a hash in the script property `pw_recovery`; the settings columns K, L and N (week) | `setup`, lecturer |
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
- `data/course.db` (SQLite, since 0.22.0; all tabs and properties, each row sealed; dates stored as `{$d: ISO}`), encrypted per row (AES-256-GCM, magic `CMV1`) with the data key `data.key`, which is itself encrypted with the system keychain (`safeStorage`) where available (`desktop/vault.js`);
- `courses/<id>/backups/` (automatic encrypted backups of the workbook: on opening the course, every four hours and on closing; each read back and checked; the newest 14 kept, plus copies made before a restore);
- `anthropic.bin` (the API key), encrypted with `safeStorage` where available;
- `authoring/library/` (copies of documents, `<id>.chunks.json`, `index.json`);
- `authoring/drafts.json` and `authoring/settings.json` (the model);
- `authoring/banks/lectureN.json` (approved questions, with a `next` counter).

## 7. Authentication and access

| Who | Credential | Where checked |
|---|---|---|
| Lecturer | Host key: 16 random hexadecimal characters made at setup, optionally replaced and stored hashed. Sent once by POST and exchanged for a lecturer session (8 hours) | `hostOk_` in `05-auth.gs`, hashing in `06-password.gs`; 10 failures lock it for 10 min (CacheService); recovery code: 5 failures per hour. Pages keep the session in `sessionStorage` (`cm_hk`), not the key. |
| Student, own record, chat, group work, check-in | Student ID on the class list plus a personal access code, exchanged for a student session (14 days) | `studentCheck_`; 6 failures lock the ID for 10 min; 200 failures across the class in 10 min pause new sign-ins. Codes can expire after a set number of days. A remembered phone keeps the session in `localStorage`, not the code. |
| Student, live quiz | Join code shown in class, plus name and ID; the phone receives a receipt when it joins or submits | Presence and round rules; first submission counts. The student's result and own answer in review are shown only with the receipt. |
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

- **Records at rest (desktop).** Each course's workbook is encrypted on disk; the key is protected by the system keychain, so a copied data folder cannot be read on another computer. A workbook that cannot be read is moved aside and kept, never overwritten. Backups to a file are encrypted with a passphrase (scrypt, AES-256-GCM) and checked before a restore replaces anything; the current records are kept as a backup first.
- **Linked folder (desktop, off by default).** The lecturer may link one folder per course, usually a Google Drive, OneDrive, Dropbox, MEGA or iCloud sync folder or a private git repository. Class Manager writes only passphrase-encrypted `.cmbackup` files there (scrypt, AES-256-GCM, read back after writing), so the provider holds no readable student data; the app never signs in to the provider. The passphrase is kept only if the system keychain is available. The lecturer may instead link their own account on WebDAV, a private GitHub repository (a public one is refused), their own Dropbox app or an S3-compatible bucket (`desktop/storage/`, one module per provider with a common interface). The lecturer registers with the service and supplies the credentials; the app holds no developer keys. Credentials are kept in `linked-folder.cred`, encrypted by the system keychain, and a service link is refused where there is none. **Synchronisation (`desktop/sync/`).** Per item (notes, course materials, class list, attendance) the lecturer chooses "this computer only" or "in step". The local copy always exists, so the app works offline. Notes and materials are readable files pulled and pushed under `Class Manager/<course>/notes|materials/` (a locally changed file is never overwritten). The class list and attendance are merged three-way from encrypted per-computer snapshots (`records-<computer>.cmsync`): each computer writes only its own file, the merge baseline is kept encrypted in the course folder, and a removal counts only if the other computer had known the record. Quizzes, scores, messages and the library are not yet synchronised. Google Drive and OneDrive browser sign-in are the next providers to add; see the plan in the project files.
- **Secrets.** No secrets are in the repository. The host key is in the workbook only. The API key and Google tokens are in the app's data folder, encrypted with the system keychain when `safeStorage` is available.
- **Student data.** It stays in the workbook. Nothing about students is sent to Anthropic: requests contain only the lecturer's documents, instructions and existing question stems. The end-to-end test checks this.
- **Assistant export (desktop, off until used).** CM sends nothing to any assistant. On request it writes a snapshot of the current course (an allowlist of tabs, student IDs as stable pseudonyms, names removed unless chosen) to a folder the lecturer picks, after a preview. A stand-alone read-only MCP server (`desktop/llm/mcp-server.js`) can serve that snapshot; it cannot reach CM, the workbook or the network. The pseudonym salt never leaves the data folder, so only the lecturer can map a pseudonym back. See `desktop/llm/README.md`.
- **Pages from the desktop server** run in sandboxed `BrowserWindow`s (`contextIsolation`, `sandbox`, no `nodeIntegration`). External links open in the system browser, and navigation away from the local server is blocked. The `cmApp` bridge exposes a fixed list of IPC calls.
- **Server paths.** `/app/*` answers only to this computer. Other `/apps_script/*` paths return 404. Static paths are confined to the web root.
- **Sheet values.** Typed values beginning `=`, `+`, `-` or `@` are prefixed so that the sheet does not run them as formulas.
- **Sessions.** A session is `s1.<role>.<subject>.<expiry>.<HMAC-SHA256>` signed with a secret in the script properties, bound to the stored host key or to the student's current code. Changing the host key, replacing a code or "Sign everyone out" (Access codes page) ends them. The answer that accepts a key or code carries `_session`; `CM.call` swaps it in for the key or code in the page and in browser storage.
- **Desktop access rules.** Requests with lecturer credentials are refused through the internet address unless allowed in App Settings, and can be limited to this computer only (`desktop/access.js`). The internet address stops by itself after a set time (default 3 hours) and shows the number of visitors, requests, requests over the limit and refused lecturer requests.
- **Quiz window without a password.** A CM window on this computer (its address is this computer's own and CM's port, `desktop/local-window.js`) receives the signed-in password in its tab storage when it opens (`desktop/preload.js`), so the quiz dashboard opens straight into the live quiz and asks the server for the join code with `quiz_default` (the open quiz, else the latest, else the chosen week). Still protected: a browser or device that is not a CM window has no stored password and sees the form with Join code and Password; every host action, including `quiz_default`, needs the password or a Login session; the internet address and the "this computer only" setting refuse lecturer requests as before; student phone pages and the projector display (public counts only) are unchanged.
- **Password.** Chosen by the lecturer (10 to 100 characters), kept only as a slow salted hash (4000 chained HMAC-SHA256 rounds, stored with the hash so it can be raised). A one-time recovery code (20 characters, about 100 bits) is shown when a password is set, kept as a hash, and replaced at every change or recovery. If both are lost, the Sheet owner runs `resetHostKey()` in the script editor, or the desktop app's "Reset password" button on the home screen. In the desktop app the owner can set the password on the home screen without the old one (`ownerSetPassword_`, reachable only from the app's own screens through `backend.setPasswordAsOwner`, never from the router). Module: `apps_script/src/06-password.gs`; page: `password.html` with `assets/password.js`.
- **Rate limits.** Host password: 10 failures per 10 min. Access code: 6 per ID per 10 min. Messages: 8 per minute per student. Attendance: per-device and per-ID rules.
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
  - `app.asar`: `main.js`, `preload.js`, `backend.js`, `authoring.js`, `app/**` and the production dependencies (`@anthropic-ai/sdk`, `mammoth`, `unpdf`, `jszip`).
  - `resources/web`: the class-manager folder, except `desktop/`, `tools/`, `README.md`, `STRUCTURE.md`, `ARCHITECTURE.md` and `.nojekyll`.
- **Release.** A private draft GitHub release `class-manager-v0.1.0` holds earlier installers. Publishing it needs Hope's approval.

## 13. Testing

| Suite | What it covers | Where |
|---|---|---|
| `tools/validate_quizzes.py`, `tools/check_calcs.py`, `tools/test_practice.mjs` | Bank schema and calculations, and the practice engine | Repository |
| `desktop/test/` (`npm test`) | Class statistics, learning progress, and many courses: migration of a 0.7.0 data folder, the registry and routing, and two courses that share no records (class list, host key, access codes, attendance, lookup, statistics, content, Google Sheet, browser storage); Excel files (written workbooks read back cell for cell, the template imports as a class list, IDs stay text, sheet names, one course per results workbook) | Repository |
| `desktop/test/charts.test.js` | Learning Progress charts and the weekly class timeline: level counts and shares, quartile band rules, gain signs, thin evidence shown as a dot, row order, escaping, agreement with the server figures | `desktop/app/charts/` |
| `desktop/test/class-stats-empty-session.test.js` | Sessions with no check-ins are set aside; a class with no attended session has no rate. |
| `desktop/test/board.test.js` | The Class Analytics board: KPI trend arrows (only when two numbers exist), the lecture plan adds up to the plan, progress series, ranked topics, findings from the numbers, the empty state, escaping of names, and that each chart's clicks are in the markup. |
| Server checks | 36 (core and learning), 17 (groups), 14 (calendar), 38 (messages and announcements), run against `backend.js` | Session scratch files; not yet in the repository |
| Browser checks | 17 (learning pages), 11 (groups pages), via Playwright against the running app | Session scratch files |
| End to end, packaged app | 45 checks, via Playwright's Electron driver against `dist/linux-unpacked`, with a stand-in for the Anthropic API that records requests: library (four formats), search, both summaries, generation request shape, review and approval into served banks, import preview, manual entry, withdrawal, no student data in requests, calendar views and series, `.ics` and feed, portal, messages, moderation, delivery states, store and forward | Session scratch files |

None of the session suites has been run against Google Apps Script itself. Generation and Claude summaries have not been run against the real Anthropic API.

## 14. Known limits and technical debt

1. **Desktop reach.** In mode B, students reach the app on the same network, or from anywhere through the optional internet address (a Cloudflare quick tunnel, `desktop/tunnel.js`), and only while the app is open. The internet address changes at each start, so external calendar subscriptions to it do not last.
2. **Google copy is one way.** The copy from the desktop app to a Sheet is one way. Moving from mode B to mode A is not a migration path for messages or the calendar.
3. **Polling.** Chat polls every 8 seconds over JSONP. In mode A, each poll is an Apps Script execution. The version stamp keeps unchanged polls short, but a large class with chat open adds up against Apps Script quotas and concurrency (judgement: worth measuring before heavy use).
4. **Whole-tab reads.** Every chat sync reads the Messages, Chat_Read and Chat_Groups tabs in full, and the roster and codes. Cost grows with the number of messages; there is no archive or paging.
5. **Plain HTTP in mode B.** Since 0.9.0 keys, codes and sessions travel only in POST bodies, never in addresses. On the local network in mode B the transport is still plain HTTP: someone on the same network could read a request. Sessions limit the time a captured credential is useful, and lecturer pages can be limited to this computer. The internet address (mode B with a tunnel) and mode A use https.
6. **Host key strength.** Fixed on 9 November 2026: setup now makes the host key from a random UUID (16 hexadecimal characters). Keys made before that are 8 base-36 characters from `Math.random` and can be replaced with `setkey`.
7. **Owner email in the script.** Fixed on 9 November 2026: `NOTIFY_EMAIL` is empty in the package, and reports go to the Google account that deployed the script. The desktop app sends no email.
8. **Positional columns.** The server script is split into modules (since 0.8.1), but tab layouts are still positional (column numbers in code).
9. **Tests.** The server release suite (`desktop/test/release.test.js`) and the other suites run with `npm test` and in the workflow `class-manager-tests.yml` on every push and pull request. Browser suites are added separately.
10. **Fixed upper bound on the week.** `setWeek_` accepts weeks 0 to 12 only, although banks may now be added for other lectures.
11. **Desktop-only authoring.** The web version has no authoring screen; new questions there mean editing `quizzes/lectureN.json`.
12. **Model output limits.** The schema does not force four options. Approval rejects any other count. Shuffling assumes explanations do not name option letters, and the prompt forbids that.
13. **Scanned PDFs.** These have no text layer and cannot be read; there is no OCR.
14. **Dates.** Calendar times follow the script's time zone, which in mode B is the computer's.

### Many courses (desktop, 0.8.0)

- **Registry.** `courses.json` in the app's data folder lists the courses (id, code, title, term, content source, archived), the course last shown and the default course. The id is made once from the course code and never changes, so students' links survive a rename.
- **Folders.** Each course has `courses/<id>/` with `settings.json` (course details), `data/course.db`, `authoring/` and `course/`. The app's own `settings.json` keeps only the port and text size. A course may link a folder of its own for its content instead of `course/`; the workbook and the authoring library never move there.
- **Server.** Pages of a course are served under `/c/<id>/`, each with its own `config.js` and `/exec`. One backend (one vm context running the server script) per course, made on first use and kept while the app runs. Paths without the prefix serve the default course. Archived and unknown courses return 404. One tunnel serves every course through the same prefixes.
- **Screens.** The app's screens are served under `/c/<id>/app/`. Each IPC call is resolved to the course in the calling window's address, so a window can act on no other course. The course dropdown navigates the window to another course.
- **Students.** Records, host keys, access codes and phone registrations are per course. For every course but the default one, `config.js` prefixes the browser storage keys of the pages with the course id, so one phone keeps separate records per course.
- **Migration.** On the first start of 0.8.0 the 0.7.0 layout (`settings.json`, `data/`, `course/`, `authoring/`) is moved, by renames inside the same folder, into the first course; the registry is written last, so an interrupted move finishes at the next start.

## 15. Candidate improvements

These are proposals for review, ordered by the value they would give relative to effort (judgement).

1. **Commit the test suites.** Done for the server suites (`npm test`, workflow `class-manager-tests.yml`).
2. **Move secrets out of URLs.** Done in 0.9.0: POST for every request, sessions that expire, receipts for live quiz results.
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


## LMS connector (15 November 2026)

**Purpose.** Let a lecturer keep the class list in step with the LMS and put CM's scores in the LMS gradebook without retyping, while student data stays local.

**Flow.** File route: the lecturer exports a roster from the LMS, `roster-read` turns it into students, `roster-plan` compares it with the Roster tab, and only on confirmation (after a backup) `roster-apply` adds the missing students through the backend's class-list function. For grades, `assessments` reads the Master tab, `gradebook` writes the LMS's CSV layout. Direct route: `keys` makes an RSA key on this computer; `token` signs a client assertion and receives a short-lived token; `members` reads learners (matched to CM IDs by the LMS student number); `push-grades` finds or creates one gradebook column per assessment (`scores`) and posts each score by LMS user id. `ipc` exposes these to the screen as `cm:lms*`.

**Trust boundaries.** CM calls out; nothing calls in. The private key stays in the course folder; only the public JWKS is shared. Settings are per course (`lms.json`) and default to off; only https addresses are kept.

**Not yet verified.** The direct route has run against a mock LMS only; each LMS's gradebook CSV layout needs one trial import.

## Course database (SQLite, 15 November 2026)

Each course keeps its records in one SQLite file, `data/course.db`, using the SQLite built into Node (`node:sqlite`): no server, no account, no extra install. The code is in `desktop/db/` (README there). The server script is unchanged: `backend.js` still gives it a spreadsheet, now backed by the database instead of a JSON file.

- Tables: `sheet` (a tab), `cell_row` (one row of a tab, sealed with the vault key), `prop` (settings, sealed), `meta` (schema version, import record).
- Writes: only changed tabs, and within them only changed rows, in one transaction (a power cut leaves the last complete state).
- `workbook.json` is an inbox. An older workbook, or a restored backup, is imported into a new database, read back and compared cell by cell, and only then replaces the old database. The old database (`course.replaced-*.db`) and the file (`workbook.json.imported-*`) are kept; nothing is deleted. A database that cannot be read is moved aside (`course.unreadable-*.db`) and reported.
- Backups and backup files still hold workbook text, so older backups restore and the format is the same as before.
- Student table (`desktop/db/students.js`): one row per ID, the unique key is a keyed fingerprint of the ID, so IDs and names stay unreadable in the file. It is rebuilt from Roster at each save; a repeated ID is kept once and reported. The Excel download starts with a Students sheet.
- Safe retries (`desktop/receipts.js`): a request with a client key (`ckey`) runs once; a repeat gets the first answer.
- Failures are answers (`desktop/exec-failure.js`, `config.js` `CM.noAnswer`): an error inside CM's server returns `{ok:false, why}` with a plain sentence, and the pages say "CM did not answer" only when nothing came back at all. Google is not involved: the pages' address is CM's own `/exec`. Start quiz with no question bank for the week is refused in words (`rules/quiz-control.js`, nothing saved) instead of failing; tests: `test/quiz-start-no-bank.test.js`.

## Phone outbox and mailbox (15 November 2026)

- `assets/outbox.js`: every practice result and question report is saved on the phone with a unique key, sent, and tried again (5 s, slower, and when the phone is back online) until CM accepts it. States: saved, received, held. Live check-in and live quiz answers are not queued: they need the room.
- Mailbox (optional, `relay/`): if CM cannot be reached after two tries and the course has a mailbox, the phone encrypts the result with the course's public key (`assets/relay-seal.js`) and leaves it in a Cloudflare Worker with a KV store. CM collects every three minutes while open (`desktop/relay/client.js`), records each item once through `receipts.js`, then tells the mailbox to delete it. Only practice results and reports are accepted. Keys and tokens are kept sealed in the course database (`backend.secret`).
- The Google Apps Script path is unchanged and still works for courses that use it. It has not been removed: that waits for tests with real phones and Hope's decision. Google Sheets remains an optional copy and import, not required.

## Grades table (15 November 2026)

"Grades and Results" opens on a clean table built from the records (`desktop/grades/`), not from Master. One row per student on the class list; each group is its own table, chosen by buttons above it (Quizzes, Attendance, Assignments, Practice): Student ID, Name, then one column per date. Quiz columns are headed by the quiz date, oldest first (two quizzes on one day read "2 Nov 2026 (Week 1)" and "2 Nov 2026 (Week 2)"; the latest try shows). Attendance has one column per session date, with 1 for present and 0 for absent. A blank cell means no record. Only students on the class list are rows. Every value keeps the time of the entry it came from (shown on hover); the timeline lists every dated entry, newest first. Download as Excel has one sheet per table with the same layout, then a Timeline sheet. Removing a student is an explicit row action (confirm, set aside, restorable); clicking a row no longer removes anything. Master, Scores and Totals remain in the tab list as raw tabs.


## Roster with grades (17 November 2026)

Grades and Results has a first table, Roster with grades (also reached by the button of that name beside "Attendance with names"): the class list and every result in one table, one row per student on the class list, with ID, Name, one column per quiz date, Quiz average, Sessions attended, Attendance %, assignment marks and Practice done. It is added by `desktop/grades/roster-table.js` from the columns `grades/build.js` already builds (no results logic is duplicated); the four figures are worked out from those cells and left blank when the student has nothing behind them. The same table is the first sheet of Download as Excel and the file `Grades Roster with grades.csv` in Export all tabs as CSV. IDs not on the class list are never rows. Refresh totals redraws it because the Grades tables are built from the records each time.

The notice "IDs flagged by imports" now counts each ID once however many files it came from (`offlist.flagSummary`). An import used to flag at most 500 IDs because the report listed only 500; it now flags every ID that is not on the class list (`notOnListAllIds`).

## Courses, IDs and Reset (15 November 2026)

- A course owns its class list. Each course has its own database (`courses/<id>/data/course.db`), so a student ID is unique within a course and the same person in two courses is two separate records. Every record refers to an ID in its own course's class list; an import matches only against that course's class list. IDs in a file that are not on the class list are listed in the preview ("IDs not on the class list"), never added silently and never sent to another course.
- The mailbox keeps items per course (`<course>:` prefix) and each course has its own keys.
- Reset "everything" erases what the course keeps: the database, notes, every earlier backup, and synchronisation state, and switches the class list and attendance of a linked course to this computer only so nothing is pulled back. By default the erased parts are moved aside and can be restored; "Erase for good" deletes them. Other courses are never touched (`test/reset-records.test.js`).
- The import preview now plans with the same option the screen shows (a ticked "Add the students in the file" was previously shown ticked while the preview was planned without it, which produced "Nothing in the file is new").

## Rules in JavaScript, the router and the relay quiz (July to November 2026 refactor)

- `desktop/rules/*.js` hold every rule of the former script as plain JavaScript over a store interface (`rows`, `setRows`, `prop`, `setProp`, `now`). `rules/router.js` turns a request into a reply. `CM_ENGINE` selects the engine: `js` (default) or `script` (the old vm script, kept for side-by-side tests).
- The relay (`relay/hub/`) also serves the live quiz at `/v1/quiz/*`: status, question text without the key, who joined and admitted answers. CM collects the events and records them with the same rules.
- The Google sign-in, the Sheet copy and the Apps Script address setting were removed (see `google-path-removal.md`). The website keeps its own copy of the script.

## Roster entry (single path)

One path writes the class list: `app/roster-shots.js` (screen) to `cm:rosterShotsRead` and `cm:rosterShotsSave` (`roster-shots/ipc.js`) to `roster-shots/review.js` (unique IDs, conflicts, unreadable IDs) to a backup, then `backend.rosterSync` and `buildFromRoster`. Screenshots are read by Claude through the lecturer's own API key (`roster-shots/vision.js`). All other inputs go through `import-plan.js`, which forces `addMissing` off and returns no roster rows, so they can only be matched against the list. `main.js` refuses `roster_sync` and `roster_edit` with `op=add` from pages and scripts (`roster-shots/gate.js`). Sync (`sync/records.js`) no longer merges the class list and drops attendance for IDs not on the local list.


## First-run setup (added 2026-11-16)

One central password opens CM and every course (`desktop/first-run/central-login.js`, `app/login.html`). Setup then runs in a fixed order: password, class roster, course material (`desktop/first-run/stages.js` holds which calls wait for which step). Course material is loaded from a folder of quiz banks in the online format (`first-run/quiz-bank.js`, `first-run/bank-folder.js`, add only) or generated by CM from the teaching material. Details: `desktop/first-run/README.md`.

### Access code shown at sign-in (no slips, no email)

A student scans the room's QR code and enters only their ID. `rules/code-claim.js` (action `claim_code`; on the relay `POST /v1/claim`, `relay/hub/src/attend.js` `claim`) then shows that phone the personal access code, once, and `attend.html` uses it to check in and keeps it on the phone. The code is shown only when the QR token is current (and the location passes when it is enforced), the ID is on the class list and has a code, and the phone is not registered to another ID nor the ID to another phone. The first phone to ask is registered to the ID (the same one-phone-per-student rule as check-in, so CM's existing new-phone flow applies). Any other phone is not shown the code: the request appears in the attendance review under "waiting for approval", and the lecturer can give the code from Access codes or forget the phone (`attend_phone_reset`) so the student can try again. An ID that is off the list answers like a wrong code, so IDs cannot be probed; six refusals slow a phone down. With the laptop off the relay holds the codes in table `live_code` only while the session is open: CM sends them in `/v1/live/open`, `close` deletes them, and the daily cleanup removes any left behind. The lecturer can stop codes leaving CM with the property `code_claim` = `0`. Residual risk: someone in the room who knows another student's ID and asks first within the QR window would be shown that code; that student's own phone is then held and flagged, and the lecturer resets it. Tests: `desktop/test/code-claim.test.js`, `relay/hub/test/claim.test.js`.


## IDs not on the class list

The class list decides who has a row. `onRoster_` in the server script (`10-assessment.gs`) drops results for IDs not on the Roster before Master and Scores are written. Imports record such IDs in `Flagged_IDs` (`desktop/offlist.js`, called from `import-ipc.js`) and never as rows. Rows left by older versions are set aside on the lecturer's confirmation and can be restored. See `desktop/IMPORT.md`.


### Attendance page: the record, then who comes and who does not
The Attendance page opens with the same Attendance table as Grades and Results (ID, Name, one column per session date, 1 present, 0 absent, blank no record), drawn by the same component (`app/grades-view.js`, `make()` gives one viewer per place, `only: "attendance"` hides the table buttons). Below it, `rules/attendance-bands.js` splits the students who have a counted session into bands (every session, regular 75% to 99%, occasional 40% to 74%, rarely under 40%, never attended), with counts and shares; clicking a band lists its students with ID and name, and clicking a student opens the record. The "Missed in a row" list shows ID and Name in separate columns. Session headings from any file are cleaned by `rules/session-label.js` ("3 Nov 2026", a second session that day "3 Nov 2026 #2"); the charts use `date` (2026-11-03) for ordering and the short form "3 Nov" on the axis.


## Attendance start-up (simplified 2026-11-16)

`attendance.html` shows one Start button, one tick box ("Only students in the room can check in", remembered as `cm_near`) and a collapsed More options (radius, typed classroom position). Unticked, CM sends `attend_open` with no position. Ticked, CM sends this computer's position, else the saved one, and asks for typing only when neither exists. If the Access and safety setting enforces location, the server answers `needLocation` and the page switches the tick on by itself. Rules in `desktop/rules/attendance.js` and `attendance-guard.js` are unchanged: one phone per student ID, new-phone approval, roster-only IDs and the relay all work as before. Test: `desktop/test/attendance-start.test.js`.

## Uploads (2026-11-17)
Every upload screen accepts the standard file types through the shared readers (`desktop/autoload/read-file.js`, `detect.js`, `file-types.js`; `desktop/roster-shots/files.js` for the class list). Only the Class Roster adds students; other uploads only check against it.

**Roster first, but optional.** The class roster is the first step of setup, after the password, and can be skipped: CM can be set up fully without one (course details, lectures, files, quiz banks, course packs). Only information about students (results, attendance, marks, quiz results, access codes, LMS files) waits for a roster and is refused with a button to the roster step (one gate: `desktop/first-run/stages.js`, `NEEDS`). IDs in other files never become roster members; with an empty roster the preview says so and nothing is saved. The ID is the only required and unique field of a roster entry; a name is optional (first only, last only, both, none, or the same as another student) and is shown as typed.

## Lecture progress

Attendance sessions (the Attendance_Control tab) are the single source of truth for a lecture held: a closed or submitted session counts its calendar date once. The lecturer can add a make-up or cancel a date; those marks are one course setting (`lecture_log`) in the per-course SQLite database, so they travel with backups and sync. `rules/lecture-progress.js` is pure (no files, no store) and returns the state, the counts, the expected number by today and the catch-up wording. The home screen card, the banner and the optional desktop notice at start all call the same report (`cm:lectureProgress`), so they cannot disagree. `rules/lecture-schedule.js` (pure) adds which lecture is due by this week, which is next and which were missed, counting lectures in order and naming them only from the course's lecture list (the same `c.course.lectures()` that feeds Course and Content); `lecture-progress/ipc.js` attaches it as `schedule`. Nothing here reads the roster, and nothing is sent outside the computer.

Lecture files: `desktop/lecture-files/` (`types.js`, `classify.js`, `peek.js`, `describe.js`, `build.js`, `store.js`, `actions.js`, `ipc.js`, `README.md`) decides which files are lecture documents (PDF or Word only), what each is (slides or notes, handout, tutorial, supplement, reference, with a confidence), what is ignored and why, and what the lecturer can open, replace, take off or move to Removed; `app/lecture-viewer.js` shows a document. Test: `test/lecture-files.test.js`. Clicking a lecture card opens the lecture view (`app/lecture-view/`: `state.js` rules, `view.js` the view with Present, `present.js` full screen presentation of the slides PDF, `lecture-view.css`; README there). Test: `test/lecture-view.test.js`. Order of authority for a role: the lecturer's choice (`data/lecture-files.json`), the course's own list, then CM's guess with a visible confidence. Ignored files are counted by reason on Course and Content and can be added back.

Lecture detection: `desktop/autoload/lecture-names.js` finds lecture numbers in file and folder names (lecture1, Lecture_01, L1, Lec 2, week3, "08 Waves", numbers in folder names) and groups files by lecture, with gaps (one detector, uses the existing folder scan `autoload/scan.js`). `desktop/lecture-files/build.js` first decides which files are real lecture documents and what each is (see lecture-files/README.md), then `desktop/lecture-files/build.js` first decides which files are real lecture documents and what each is (see lecture-files/README.md), then `desktop/lecture-progress/overview.js` merges that with lectures.json and the banks into "Lecture 1" to the last, shown on Course and Content (`app/lecture-list.js`, `app/lecture-viewer.js`, call `cm:lectureOverview`). The last detected number pre-fills "Lectures planned" in Course settings. Tests: `test/lecture-names.test.js`, `test/lecture-overview.test.js`.

## Sending quiz questions to the review queue (2026-11-17)

`cm:autoQuestions` (`desktop/autoload-ipc.js`) parses the chosen files one at a time, yields to the event loop between files, reports `cm:autoQuestionsProgress` (`done`, `total`, `questions`) and saves all drafts with one `addDrafts` call. Errors come back as a plain message and the screen (`app/folder.js`) shows progress and failures instead of waiting silently. The duplicate checks in `desktop/authoring.js` use one `checkContext()` per batch (stem sets of the bank and the drafts built once), so checking N questions is linear; before, every question re-read the bank file and re-normalised every draft, which froze CM on large sets. Lecture titles read from files go through `desktop/autoload/topic-titles.js` (`cleanTitle`). Tests: `desktop/test/review-queue.test.js`.
## Folder load: one preview
Scan (`autoload/scan.js`, `folder.js`) then `placement.js` (pure) gives a row per file for the screen; the existing `cm:autoPlan` builds the working file and the import plan; `cm:importApply` loads. No new store or write path: the roster gate, ID checks and backup stay in `import-plan.js` and `import-apply.js`.

## Class Analytics board (2026-11-17)
`desktop/app/board/` draws the top of Class Analytics as white chart panels on the dark page. Data flow: `cmApp.stats` (class statistics) and `cmApp.lectureProgress` (kept in `window.cmLecture`, `cm:lecture` event on change) go into `model.js`, which returns plain data; chart modules (`donut.js`, `barline.js`, `ranked.js`, `kpi.js`, `findings.js`) turn it into inline SVG or HTML strings; `render.js` assembles panels; `interact.js` handles tabs and clicks and opens the existing student drill (`dashboard/interact.js` `open`). No library and no network: charts are drawn locally. Nothing is stored. The board adds no server calls and no new records, so it works the same offline and with 140 students. Details: `desktop/app/board/README.md`.

Sections and data sanity (2026-11-17): `board/sections.js` groups every Class Analytics metric under eight headings, once each; the explore charts and analytics cards are placed by section (`forScreen("ov-...")`, `cmAnalyticsPanel.mountInto`). `rules/class-stats.js` treats a session in which nobody checked in as not held (`attendance.notHeld`, listed on the page), so empty or test sessions no longer lower every rate or flag the whole class. At risk counts solid evidence only and names thin evidence separately. The deprecated Apps Script copy of the statistics is unchanged.

## Topic mastery (2026-11-17)

`desktop/rules/topics/` reads the same tabs as the class statistics (Item_Log, Attempts, Form Responses 1, Roster) and the course JSON files through `o.site`. Evidence rule: released live answers, each student's latest full practice attempt per lecture, the latest mock exam; the class view counts only students on the class list. Topic is the lecture in the question id, concept is the bank's own field or the slide in `ref`; a question with no lecture is unmapped, never guessed. Bands: 70 or more well mastered, 50 to 69 developing, under 50 needs attention, too early below 10 class answers (3 for a student). Output goes into `classStats().topics` (semester, per quiz, over time, per student) and `portalExtras().topics` (one student). Class Analytics correlations are computed in the window from the class statistics (`board/topics-model.js`): Pearson r with n, no coefficient under 10 pairs, a caution under 30 pairs or when |r| is under 0.3, always worded as an association. Nothing leaves the computer. The Apps Script copy does not have this (deprecated path).

Dashboard grid (2026-11-17): Class Analytics is a KPI row, a tab bar and one grid of white cards per tab (`board/sections.js`, `board/board.css`). Donut shares come from `board/shares.js` and draw through `board/donut.js`. Privacy and records stay below the tabs.

Compact dashboard (2026-11-17): the lecture plan is a strip beside small KPI tiles; each tab is a 12 column masonry grid. `board/layout.js` holds default widths and order, `board/arrange.js` applies and edits them and saves the lecturer's layout per course in localStorage (this computer only). Text is shortened to tooltips (info icons); empty cards collapse to one line.

## Lecturer message on student phones (2026-11-17)
The lecturer's "Message to all students" is stored with the quiz (`message` in the quiz control row, `rules/quiz-control.js`), is part of every quiz status answer (`status().message`) and therefore also of the status CM hands to the relay (`desktop/relay/live-quiz.js`), so it reaches phones with CM on or off. The cause of "students do not see it": `quiz.html` showed it only inside the question screen, so the waiting room and the results screen never showed it. Now `assets/lecturer-message.js` owns it: `jsonp()` in `quiz.html` passes every `action=status` answer through `LecturerMessage.apply`, which shows a prominent banner on whatever screen the phone is on (waiting room, question, between questions, results), replaces it with a new message, removes it when the answer carries none (Clear), and ignores failed or unknown answers. A phone that joins late reads the current status, so it sees the message at once; the waiting room checks every 4 to 6 seconds, a question every 3.5 to 4 seconds, the results screen every 4 to 5.5 seconds.

The lecturer's screen (`quiz-host.html`) takes its sentences and option lists from `assets/quiz-host-text.js`: "Message sent to N students" with the real joined count, "Message cleared", readable labels for "Student score shown" and "Ranking shown" (When released, Immediately, Never; stored values unchanged), and a Week list that always has the quiz's own week (never blank). Tests: `desktop/test/quiz-message.test.js`.

## Diagnostic quiz and exercises (2026-11-17)
A live quiz has one of two modes, chosen in the lecturer's quiz window before Start and stored with the quiz as `quiz_type` (column 24 of the Quiz_Control row, `rules/quiz-control.js`): **Exercises** (empty or `standard`, the normal practice questions, held for release, then Grades) and **Diagnostic quiz** (`concept`, a short concept check, not for marks). The names and files are the website's own (Concept diagnostic on `phys143-quiz-host.html`): a diagnostic draws only from `quizzes/lectureN_concept.json`, each question carrying a `tag` (the concept it tests), and a week is offered only when it is listed under `concept_weeks` in `apps_script/live_quizzes.json` (CM writes that list from the course's banks in `course.syncWeeks`).

A diagnostic is always paced (one question at a time) and is never held or released: `rules/quiz-results.js` `finalize` writes presence and hands the answers to `rules/quiz-diagnostic.js`, which keeps one row per student and question, with the concept, in the Diagnostic_Log tab. Nothing reaches Form Responses 1, Staged_Quiz, Master, Scores, Totals or Item_Log, so a diagnostic never changes a grade or the exercise statistics. `quiz-submit.js` refuses a whole-quiz submission to a diagnostic. Students still see their own score and the class ranking while the quiz runs, as on the website.

What shows where: the quiz window has the type list, a note, and the **Class diagnostic** (per concept, weakest first, and per question; counts only, no names; from `quiz-diagnostic.live`); phones and the projector read `quizType` from the status answer, which the relay carries unchanged, and show "Diagnostic quiz"; Class Analytics has the **Diagnostic quizzes** card (by week and concept, from `quiz-diagnostic.summary` through `cm:analyticsExtra`; a concept is judged only after 10 answers); Quizzes and Questions lists the number of diagnostic questions per lecture. Diagnostic_Log is in `db/id-guard.js` (IDs in one form) and is erased with the course on Reset.
