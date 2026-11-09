# Class manager

A self-contained course management and assessment package for one course, taken from the PHYS 143 part of hhdonglo.github.io. It runs on its own: it does not read any file outside this folder, and it can be served from any static web host (GitHub Pages, a university server, or a laptop in class).

It contains:

- **Course pages**: course overview with the weekly programme, one page per lecture with its PDFs, and the student portal.
- **Practice and assessment**: a practice quiz per lecture, a timed mock exam built from past examination questions, and the question banks with the tools that write and check them.
- **Live class tools**: the live quiz (student page, lecturer dashboard, projector display), attendance check-in with a rotating QR code, the lecturer menu and the Control Centre (class list, results, tidy to class list).
- **Server**: the Google Apps Script that stores quiz answers, attendance, the class list and marks in a private Google Sheet.

No student data, class list or host key is stored in this folder.

**Desktop app.** `desktop/` turns this folder into an installable app for colleagues (Windows, macOS, Linux). It runs everything from the lecturer's laptop with no Google account and no setup, and keeps results on that laptop. See [`desktop/README.md`](desktop/README.md).

## Layout

```
class-manager/
  config.js                  the one file to edit: course labels and the Apps Script address
  index.html                 student portal (this week's lecture, check-in, live quiz, own results)
  course.html                course overview and weekly programme
  introduction.html          introduction lecture page
  lecture-N.html             one page per lecture (N = 1 to 12)
  introduction-practice.html, lecture-N-practice.html
                             practice quiz per lecture (no practice page for lecture 6 yet)
  mock-exam.html             mock exam: 50 past examination questions, 2 hours 30 minutes
  quiz.html                  live quiz, student page
  attend.html                attendance check-in, student page (opened by the QR code)
  lecturer.html              lecturer login and menu (needs the host key)
  quiz-host.html             live quiz dashboard
  quiz-display.html          live quiz projector view
  attendance.html            start and close attendance, live count, QR code
  control.html               Control Centre: class list, results, tidy to class list
  data/
    lectures.json            weekly programme and every lecture page (titles, summaries, PDF paths)
    portal.json              portal settings: current week, contact times, handouts
    pages/phys143.json       course overview text
    courses.json, site.json  small files read by the page renderer
  quizzes/lectureN.json      public question banks, read by practice, mock exam and live quiz
  PHYS143/                   lecture PDFs (slides, handouts, tutorials, supplements)
  apps_script/
    quiz_receiver.gs         the Apps Script server (paste into the Google Sheet)
    live_quizzes.json        weeks available to the live quiz
  assets/                    styles, page scripts, QR code library, KaTeX, icons
  tools/
    quiz_src/                question sources in Python (build.py writes quizzes/)
    validate_quizzes.py      checks every bank
    check_calcs.py           recomputes every calculation answer
    test_practice.mjs        browser test of the practice pages
  sw.js, manifest.webmanifest  lets students add the portal to the home screen
```

## Learning support

Added in November 2026, for students and for the lecturer. All of it is computed from records the system already keeps.

- **My progress** (portal): a student enters their student ID and a personal access code, and sees attendance, released quiz scores, practice history, progress by lecture (Secure, Developing, Needs work), the lectures to focus on, and the questions to revisit with the slide to look at. The access code closes the earlier gap where an ID alone opened a student's record.
- **Access codes** (`codes.html`, host key): creates a code for every student on the class list, replaces a lost code, and prints a slip per student to hand out in class.
- **Teaching insights** (`insights.html`, host key): attendance rate, live quiz averages, practice activity, lectures ranked by proportion correct, the questions to look at first (proportion correct, most chosen wrong option, discrimination, students who were confident and wrong), and a list of students who may need attention, with thresholds the lecturer sets. It also writes the private Question_Stats tab.
- **Confidence rating** (live quiz): after answering, a student may say Sure, Fairly sure or Guessing. It never changes the mark.
- **Projector**: during review, each option shows its percentage and the share of the class that answered correctly.
- **Attendance**: the check-in page can remember the student's ID on that phone and confirms the time of the check-in.
- **Question draw**: a random value made once per workbook is mixed into the draw, so a new class does not meet last year's live quiz in the same order.

- **Student groups** (`groups.html`, host key): makes a set of groups for an activity, at random, mixed by quiz results or mixed by attendance, from the whole class list or only the students checked in at the latest session. Size is set by students per group or by number of groups; sizes differ by at most one. Earlier pairings are avoided where possible, groups can be locked and kept when the set is made again, students can be moved by hand, and each group can be given a mark that is copied to every member (Groups tab, and a "Group: name" column in Master and Scores, not counted in the live quiz total). Projector view, CSV and print. Students see their groups, the other members and the mark under My progress.

New private tabs: Groups (one row per student per set), Item_Log (one row per student per live quiz question), Access_Codes and Question_Stats. Practice attempts now also record the IDs of the questions asked, and live answers record the confidence. `clearSemesterRecords` clears the three new tabs with the other term records.

The web version needs `apps_script/quiz_receiver.gs` from this folder deployed in its own Google Sheet for these features; the desktop app has them built in.

## Run it locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/. Course pages, practice quizzes and the mock exam work offline from the Apps Script. The portal status, live quiz, attendance and results need the Apps Script web app (below) and an internet connection.

## Configure it

Edit `config.js`:

- `courseCode`, `courseTitle`, `institution`: shown in the header and footer of every page.
- `scriptUrl`: the Apps Script web app address. Every live page and the optional result sending read it from here.

The QR codes and join addresses on the attendance, quiz dashboard and projector pages are drawn for wherever the pages are served, so they need no editing when the package moves.

## Deploy it as its own site

1. Create a new GitHub repository (for example `class-manager`) and copy the contents of this folder into its root.
2. In the repository settings, open Pages and serve from the `main` branch, root folder.
3. Set `SITE` near the top of `apps_script/quiz_receiver.gs` to the new address without a final slash (for example `https://hhdonglo.github.io/class-manager`). The script reads the question banks and `live_quizzes.json` from there.
4. Paste the script into the Google Sheet and deploy it (next section). If the deployment address changes, update `scriptUrl` in `config.js`.

The package currently uses the same Apps Script and Google Sheet as the PHYS 143 pages on hhdonglo.github.io. Both can run side by side, because the question banks are identical in both places.

## Apps Script and the Google Sheet

1. Open the Google Sheet, then **Extensions, Apps Script**.
2. Replace the script with `apps_script/quiz_receiver.gs` and **Save**.
3. On a first setup, run `setup` once. It creates the tabs and settings.
4. **Deploy, Manage deployments**, edit the web app, choose **New version**, and **Deploy**. Keep "Execute as: Me" and "Who has access: Anyone". Editing the existing deployment keeps the same address.
5. Test before class: open the lecturer menu with the host key, run a short quiz, and open and close attendance.

The tabs, actions, join codes, attendance rules and privacy rules are unchanged from the original system and are described in sections 8 to 12 of the README of hhdonglo.github.io and in its `QUIZ_SETUP.md`.

The class list is loaded into the Roster tab from the lecturer's computer with `roster_sync.sh`, which stays on that computer and is not part of this package. Single changes can be made in **Control Centre, Class list**.

## Question banks

- Write or edit questions in `tools/quiz_src/lectureN.py`, then run `python3 tools/quiz_src/build.py N`.
- Check with `python3 tools/validate_quizzes.py` and `python3 tools/check_calcs.py`.
- Some banks hold past examination questions that were added to `quizzes/lectureN.json` directly (for example lecture 2 has 35 questions while its Python source writes 20). Running `build.py` for such a lecture replaces those questions, so edit the JSON directly for those lectures or add the questions to the source first.
- A bank becomes available to the live quiz when its week is listed under `weeks` in `apps_script/live_quizzes.json`.

## Use it for another course

1. Change the labels and the address in `config.js`.
2. Replace `data/lectures.json`, `data/portal.json` and `data/pages/phys143.json` with the new course's programme and text, and put its PDFs in a folder named in `data/lectures.json`.
3. Add banks to `quizzes/` and list the weeks in `apps_script/live_quizzes.json`.
4. Give the new course its own Google Sheet and Apps Script deployment, so that marks and attendance stay separate.

## Privacy

- Never put the host key, the class list, student names or any secret in this folder or on a page.
- Public rankings show first names and scores only. Attendance and marks stay in the private Sheet.
- Practice pages keep progress in the student's browser. Nothing is sent unless the student types an ID.
- A student's own record opens only with the student ID and that student's access code. Six wrong tries lock that ID for ten minutes.
