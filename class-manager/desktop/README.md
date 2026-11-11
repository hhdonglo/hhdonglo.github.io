# Class Manager app

A desktop app for lecturers. It runs the course pages, practice quizzes, mock exam, live class quiz and attendance from the lecturer's own computer, and keeps attendance, scores and marks on that computer. Nothing has to be set up: on first launch it creates its own results workbook and a host key.

## For colleagues: install and first class

**Install**

- **Windows**: run `Class-Manager-Windows.exe`. Windows may show "Windows protected your PC" because the app is not signed: choose **More info**, then **Run anyway**.
- **macOS**: open `Class-Manager-macOS.dmg` and drag Class Manager to Applications. The first time, open it with a right-click (or Control-click) and **Open**. If macOS still refuses, open **System Settings, Privacy and Security** and press **Open Anyway**.
- **Linux**: make `Class-Manager-Linux.AppImage` executable and run it.

The first time it runs, Windows and macOS ask whether the app may accept connections on the network. Allow it, at least on private networks; students' phones connect through it.

**Before class**

1. Open Class Manager. The home screen shows the address students open, a QR code for it, and your host key.
2. Under **Class list**, paste your class list (student ID, then name if you wish, one student per line) or choose a CSV file, and press **Save class list**.

**In class**

1. Choose how students connect, under **Students open** on the home screen:
   - **Same Wi-Fi or hotspot** (the default): the laptop and the phones join the same Wi-Fi. If the university network does not let phones reach the laptop, switch on a phone hotspot and connect the laptop and the class to it.
   - **Internet**: the app starts a temporary https address that students open from any network, including mobile data. Show the QR code; the address changes each time. Press **Stop internet access** at the end of the class. See "Internet access" below.
2. **Attendance**: Lecturer menu, log in with the host key, Take attendance. Show the QR code on the projector. Students scan it and type their student ID. Close attendance, then submit it.
3. **Live quiz**: Lecturer menu, Run quiz. Use join code `2627` followed by the week number (for example `26272` for week 2). Open **Projector display** on the projector. Students open the student address, choose Quiz, and enter their first name, student ID and the join code.
4. Practice questions and the mock exam need nothing from the lecturer; students open them from the portal at any time while the app is running, or the lecturer can give them the course pages another way.

**After class**

Under **Results and marks**, choose a tab (Attendance, Master, Totals and others) to see it, or press **Download as Excel** to save every tab of the current course in one workbook (one sheet per tab); **Export all tabs as CSV** saves one CSV file per tab instead. The Students screen has its own **Download as Excel**. Under Setup, **Download the Excel template** saves a class list to fill in: fill in the first sheet, save it, then choose it with **Choose a file** and check the preview before saving. **Attendance with names** shows names next to the attendance marks.

**Access codes and Teaching insights.** Before students first look at their progress, open **Access codes for students**, log in with the host key, press **Create codes for students without one**, then **Print slips** and hand each student their slip. **Student groups** makes groups for an activity and holds a mark for each group. **Teaching insights** shows the weakest lectures and questions and the students who may need attention.

All data stays on the laptop, in the data folder shown at the bottom of the home screen. Back it up with the rest of your files.

**Optional: Google Drive copy.** If this build has Google sign-in, press **Sign in with Google**. The app creates one Google Sheet in your own Drive and keeps a copy of every tab there, updated within a minute of each change. The app can see only the file it creates.

**Many courses.** One installation runs all your courses. The course list at the top of the home screen chooses the course, and every screen in that window then shows that course only. "Add a course…" and "Manage courses…" in the same list add, rename, archive and restore courses, and link a course to its own folder (for example a local copy of a GitHub repository holding its lectures and banks). Each course has its own class list, attendance, quizzes, groups, assignments, learning objectives, messages, host key, access codes, Google Sheet and Apps Script address; nothing is shared between courses. Students open each course at `/c/<course>/` on the app's address; addresses from before 0.8.0 still open the first course. On the first start of 0.8.0 the existing course becomes the first course with all its records.

## Internet access

Choosing **Internet** starts a Cloudflare quick tunnel: a free service that needs no account and no router settings. The first time, the app downloads Cloudflare's connector program (`cloudflared` version 2026.10.7, about 20 to 55 MB) from Cloudflare's GitHub releases into the app's data folder, and runs it only if its SHA-256 checksum matches the value in `tunnel.js`.

- The tunnel reaches a second server inside the app that listens on this computer only. Every request through it is treated as coming from outside: the app's own screens (`/app/`) are refused, and each visitor is limited to 240 requests a minute. Lecturer requests are refused through the internet address unless allowed in App Settings. Access codes and their lockouts work as on the local network. The address stops by itself after the time set in App Settings (3 hours unless changed), and the app shows how many visitors and requests came through it.
- Pages and QR codes that the lecturer opens (attendance, codes, calendar feed) use the https address while it is on.
- Limits: the address lasts only while the app is open and changes at each start. Cloudflare describes quick tunnels as a service for testing, with no uptime guarantee and a limit of about 200 requests in flight at once; this is usually enough for one class. Traffic passes through Cloudflare's network and is subject to Cloudflare's terms. For a permanent address, use the Google Apps Script set-up instead (Settings).

## Records, backups and restore

- Each course's records (`data/workbook.json`) are encrypted on this computer; the key is held by the system keychain where the computer has one (App Settings, Records protection and backups, says which).
- A backup is made when a course opens, every four hours and when the app closes, and is checked at once. The newest 14 are kept in the course's `backups/` folder. **Restore** next to a backup brings the records back; the records as they were are kept as a backup first.
- **Save a backup to a file** makes one file, encrypted with a passphrase, to keep elsewhere or to move a course to another computer. **Restore from a file** asks for the passphrase. A lost passphrase cannot be recovered.
- Settings, Access and safety: when internet access stops by itself, and where lecturer pages may be used.

## What runs where

- `main.js`: starts the classroom server on the local network (port 8143 by default), opens the home screen, handles the app's own buttons. Each course is served under `/c/<id>/`; each window belongs to the course in its address, and its buttons act on that course only.
- `courses.js`: the course registry (`courses.json`), each course's folders, the move of a 0.7.0 data folder into the first course, and the per-course `config.js`. No Electron dependency; tested in `test/courses.test.js`.
- `backend.js`: runs `apps_script/quiz_receiver.gs`, unchanged, against a workbook stored in the app's data folder, so every rule of the Google version (join codes, rounds, scoring, one check-in per ID per day, class list, Master and Totals) works the same way. Location checking for attendance is off, because phones share their location only with secure (https) addresses.
- `google.js`: optional Google sign-in and the copy to a Google Sheet.
- `tunnel.js`: internet access through a Cloudflare quick tunnel (above).
- `authoring.js`: the resource library, search, summaries, question generation, import and the bank overlay (below).
- `app/home.html`: the home screen. `app/author.html`: Resources and questions.
- The course pages are the ones in the folder above, packed into the app.

## Build the installers

The workflow `.github/workflows/class-manager-app.yml` builds the macOS, Windows and Linux installers on GitHub whenever this folder changes, or on demand from the Actions tab (**Class Manager app, Run workflow**). The installers are in the run's **Artifacts**. Download them and share them with colleagues by email, a shared drive or a GitHub release.

To build on your own computer (needs Node.js 22):

```bash
cd class-manager/desktop
npm ci
npm start              # run the app without building an installer
npm run dist:mac       # or dist:win, dist:linux
```

The installers are not signed. Signing removes the warnings on first launch:

- macOS needs an Apple Developer account (99 US dollars a year), a Developer ID certificate, and notarisation.
- Windows needs a code-signing certificate from a certificate authority.

Both can be added later to the build settings without changing the app.

## Switch on Google sign-in (once, by the publisher)

Google requires every app that signs users in to be registered once. This is done by whoever publishes the app, not by each colleague.

1. Open https://console.cloud.google.com/, create a project (for example "Class Manager").
2. **APIs and Services, Library**: enable the **Google Sheets API** and the **Google Drive API**.
3. **Google Auth Platform** (or OAuth consent screen): user type **External**, app name "Class Manager", support email, and the scopes `openid`, `email` and `.../auth/drive.file`. While the app is in Testing, add colleagues' Google addresses as test users (up to 100). To let anyone sign in, choose **Publish app**; `drive.file` is not a sensitive scope, so Google's review is light.
4. **Clients, Create client**, type **Desktop app**. Download the JSON file.
5. Save it as `class-manager/desktop/google-oauth.json` and build the installers again. (A colleague can also put the file in the app's settings folder, next to `settings.json`.)

For a desktop app Google does not treat the client secret as secret, and the sign-in uses PKCE, so shipping the file inside the app is the normal practice. It gives no access to the publisher's own Google account or files: each colleague signs in to their own account, and the app can open only the Sheet it created for them.

## Resources and questions

Open it from the home screen ("Open resources and questions").

- **Library.** Add slides, notes and handouts (PDF, Word .docx, PowerPoint .pptx, Markdown, text) by choosing or dropping files. Copies are kept in the app's data folder (`authoring/library`); the text is extracted page by page or slide by slide, cut into passages of about 900 characters and indexed for search (BM25). A scanned PDF has no text layer and cannot be read.
- **Summaries.** With an Anthropic API key, Claude writes a summary from the document alone (overview, concepts, equations with their symbols, worked examples, citing the page or slide). Without a key, an extractive summary lists the document's most representative sentences, word for word, with its key terms.
- **Generate quizzes.** Choose the lecture, the documents, the number of quizzes (up to six) and of questions (up to 20 each, 60 in all), the difficulty and the question types, and optionally a focus. The passages that best match the focus are retrieved and sent to Claude with the existing questions of that lecture, so that they are not repeated. Every question has four options, one correct answer, an explanation and a reference, and arrives as a draft. The options are shuffled so the correct letter is balanced.
- **Import questions.** Word, PDF, Markdown or text in the template below; each question is checked and shown before it is added to the drafts.
- **Write a question.** A form; save as a draft, or save and approve.
- **Review drafts.** Edit, approve or discard; print the selected questions as a quiz with an answer key on a separate page. A question with an error cannot be approved.
- **Question banks.** Approved questions are kept in `authoring/banks/lectureN.json` with IDs such as `L5-U01` (never reused) and served as part of `quizzes/lectureN.json`, so the practice page, the live quiz, the mock examination, My progress and Teaching insights use them. A lecture without a bank gains one, and its week is added to the live quiz weeks. Withdrawing a question returns it to the drafts.

**The API key** is entered once under Settings, stored in the app's data folder encrypted with the system keychain where available, and sent only to the Anthropic API. The default model is `claude-opus-5-5` (editable). Requests stream, use adaptive thinking and a JSON schema for the answer, and allow Anthropic's server-side fallback if a request is declined. Use is charged to the key's account. Only the lecturer's documents and instructions are sent; no student data. Without a key, everything except Claude summaries and generation works.

**Question template** (also in `app/question-template.md` and `.docx`, which the Import tab saves for you):

```
Lecture: 5
Difficulty: moderate

Q1. A 2.0 kg book is raised by 1.5 m. What is the change in its gravitational potential energy? Take g = 9.80 m/s^2.
A) 49.0 J
B) 19.6 J
C) 29.4 J
D) 14.7 J
Answer: C
Explanation: The change is mg(y_2 - y_1) = (2.0)(9.80)(1.5) = 29.4 J.
Type: calc
Reference: Lecture 5 slides, slide 12
```

A question starts with `Q1.`, `1.` or `Question:`; exactly four options, `A)` to `D)` (`A.`, `(A)`, `a)` also work); the answer as `Answer: C` or an asterisk before the correct option. Optional lines: Explanation, Type (concept, calc, graph, misconception), Difficulty (easy, moderate, difficult), Lecture, Reference, Source. Lines before the first question set defaults. `x^2`, `10^-3`, `v_0` and `v_{max}` become superscripts and subscripts.

This feature is in the desktop app only; the web version's pages read the banks from the site, where new questions are added by editing `quizzes/lectureN.json`.

## Calendar, messages and announcements in the app

They are part of the server script, so the app has them built in (see "Calendar, messages and announcements" in the folder's README). The calendar feed is at `http://<this computer's address>:8143/calendar.ics`. Messages and announcements are stored in the local workbook and delivered when each person next opens the page, which works only while this computer is on, the app is open and students are on the same network. For messages that reach students at any time, deploy the same script on Google (README, "Apps Script and the Google Sheet") and enter its address under Settings.
