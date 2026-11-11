# Class manager

A self-contained course management and assessment package for any course. It ships with no course content: the course details, lectures, files and question banks are the lecturer's own. It runs on its own: it does not read any file outside this folder, and it can be served from any static web host (GitHub Pages, a university server, or a laptop in class).

It contains:

- **Course pages**: course overview with the weekly programme, one page per lecture with its PDFs, and the student portal.
- **Practice and assessment**: a practice quiz per lecture, a timed mock exam built from past examination questions, and the question banks with the tools that write and check them.
- **Live class tools**: the live quiz (student page, lecturer dashboard, projector display), attendance check-in with a rotating QR code, the lecturer menu and the Control Centre (class list, results, tidy to class list).
- **Server**: the Google Apps Script that stores quiz answers, attendance, the class list and marks in a private Google Sheet.

No student data, class list or host key is stored in this folder.

**Desktop app.** `desktop/` turns this folder into an installable app for colleagues (Windows, macOS, Linux). It runs everything from the lecturer's laptop with no Google account, keeps results on that laptop, and on first launch asks for the course details, the class list and the course materials. See [`desktop/README.md`](desktop/README.md).

## Lecturer password

The lecturer signs in with a password that the lecturer chooses (the host key of earlier versions). A new Sheet or desktop course starts with a temporary key; the first time, sign in on `lecturer.html` with it and follow "choose your own password" (`password.html`).

- **Set.** Open `password.html`, enter the temporary key, then your new password twice (10 to 100 characters; a few words are fine). The page then shows a **recovery code** once. Write it down or keep it in a password manager.
- **Change.** Open `password.html` (also "Change password" on the lecturer menu). It needs the current password. A new recovery code is shown and the old one stops working. All lecturer sign-ins end.
- **Forgot it.** On the login page choose "Forgot your password?", enter the recovery code and a new password. The code works once; a new one is shown. Five wrong codes block recovery for an hour.
- **Lost both.** Google Sheet version: the Sheet's owner opens Extensions, Apps Script, chooses `resetHostKey` and Run; the temporary key appears in the execution log. Desktop app: on the home screen choose "Reset password (lost it)" and confirm; the temporary key appears at the top. Either way, choose a new password straight away.
- **Safety.** Only a slow salted hash is stored. Ten wrong passwords in ten minutes lock sign-in for the rest of that time. Code: `apps_script/src/06-password.gs`; tests: `desktop/test/password.test.js`.

## Layout

```
class-manager/
  config.js                  the one file to edit for the web version: course labels and the Apps Script address
  index.html                 student portal (this week's lecture, check-in, live quiz, own results)
  course.html                course overview and weekly programme
  templates/                 lecture and practice page templates (the desktop app serves lecture-N.html from them)
  mock-exam.html             mock exam: 50 past examination questions, 2 hours 30 minutes
  quiz.html                  live quiz, student page
  attend.html                attendance check-in, student page (opened by the QR code)
  lecturer.html              lecturer login and menu (needs the lecturer password)
  password.html              choose, change or recover the lecturer password
  quiz-host.html             live quiz dashboard
  quiz-display.html          live quiz projector view
  attendance.html            start and close attendance, live count, QR code
  control.html               Control Centre: class list, results, tidy to class list
  data/
    lectures.json            weekly programme and every lecture page (empty until lectures are added)
    portal.json              portal settings: current week, contact times, handouts
    pages/course.json        course overview text
    site.json                small file read by the page renderer
  quizzes/lectureN.json      question banks of the course (none are shipped)
  apps_script/
    quiz_receiver.gs         the Apps Script server (paste into the Google Sheet); built from src/ by build.js
    live_quizzes.json        weeks available to the live quiz (empty until banks are added)
  assets/                    styles, page scripts, QR code library, KaTeX, icons
  course-packs/phys143/      the PHYS 143 course as a course pack source: course.json, files/ (lecture pages,
                             PDFs, banks, data) and tools/ (bank sources and checks). Not part of the app.
  sw.js, manifest.webmanifest  lets students add the portal to the home screen
```

## Learning support

Added in November 2026, for students and for the lecturer. All of it is computed from records the system already keeps.

- **My progress** (portal): a student enters their student ID and a personal access code, and sees attendance, released quiz scores, practice history, progress by lecture (Secure, Developing, Needs work), the lectures to focus on, and the questions to revisit with the slide to look at. The access code closes the earlier gap where an ID alone opened a student's record.
- **Access codes** (`codes.html`, host key): creates a code for every student on the class list, replaces a lost code, and prints a slip per student to hand out in class.
- **Teaching insights** (`insights.html`, host key): attendance rate, live quiz averages, practice activity, lectures ranked by proportion correct, the questions to look at first (proportion correct, most chosen wrong option, discrimination, students who were confident and wrong), and a list of students who may need attention, with thresholds the lecturer sets. It also writes the private Question_Stats tab.
- **Confidence rating** (live quiz): after answering, a student may say Sure, Fairly sure or Guessing. It never changes the mark.
- **Projector**: during review, each option shows its percentage and the share of the class that answered correctly.
- **Attendance**: a check-in needs the student's ID and personal access code, which the phone remembers after the first check-in. The first phone a student uses is registered to them for the term (Attendance_Phones tab); a check-in from a phone registered to someone else, or from a phone other than the student's own, is held and not counted until the lecturer approves it under "Check-ins to review" on the attendance page. The lecturer can also remove a check-in, mark a student present by hand and forget a registered phone there. The page confirms the time of the check-in.
- **Question draw**: a random value made once per workbook is mixed into the draw, so a new class does not meet last year's live quiz in the same order.

- **Student groups** (`groups.html`, host key): makes a set of groups for an activity, at random, mixed by quiz results or mixed by attendance, from the whole class list or only the students checked in at the latest session. Size is set by students per group or by number of groups; sizes differ by at most one. Earlier pairings are avoided where possible, groups can be locked and kept when the set is made again, students can be moved by hand, and each group can be given a mark that is copied to every member (Groups tab, and a "Group: name" column in Master and Scores, not counted in the live quiz total). Projector view, CSV and print. Students see their groups, the other members and the mark under My progress.

New private tabs: Groups (one row per student per set), Item_Log (one row per student per live quiz question), Access_Codes and Question_Stats. Practice attempts now also record the IDs of the questions asked, and live answers record the confidence. `clearSemesterRecords` clears the three new tabs with the other term records.

## Calendar, messages and announcements

- **Calendar** (`calendar.html`): lectures, tutorials, laboratories, quizzes, examinations, deadlines and office hours, in month, week and list views. Each event can carry an agenda, resources (course pages or web addresses), a course week, and a linked attendance check-in or live quiz; from an event the lecturer opens attendance, the quiz controls, or sets the live quiz to that week. Events repeat weekly (or every two weeks, or daily) with titles taken from the course weeks. Events marked "Lecturer only" are never sent without the host key. Students add events to Google Calendar or Outlook, download them as an .ics file, or subscribe to the feed (`?action=calendar_ics` on the Apps Script address, or `/calendar.ics` in the desktop app). The portal shows the next three events.
- **Messages** (`messages.html`): students sign in with their Student ID and access code; the lecturer with the host key. Conversations: the whole class, each lecturer-made group, groups that students make themselves (up to 12 members, five groups per student), a private conversation between each student and the lecturer, and, if the lecturer allows it, between two students. Messages are stored in the Messages tab and delivered when the recipient next opens the page, with unread counts and Sent or Read on one's own messages. A student sees only conversations they belong to; names come from the class list and Student IDs are shown only to the lecturer.
- **Moderation**: the lecturer sees every conversation, removes and restores messages, pauses a student's messages, writes rules that students see, makes the whole-class conversation lecturer-only, switches chat off for students, allows or forbids student-made groups and messages between students, and downloads every message as CSV. Messages are limited to 1,000 characters and eight a minute per student.
- **Announcements**: title, text, an optional link, an optional calendar event, pinned or not, shown from a chosen date and time, to everyone on the portal, to signed-in students only, or to chosen groups. Students see new ones marked on the portal and on the messages page.

New private tabs: Calendar, Messages, Chat_Groups, Chat_Read and Announcements. Settings for chat are kept in the script properties.

Limits. In the desktop app, messages, announcements and the calendar live on the lecturer's computer: they reach students only while that computer is on, the app is open and phones are on the same network, and they wait there until then. The Google-hosted version of the same script keeps them online at all times and needs no extra setup beyond the existing deployment. Pages check for new messages every eight seconds while open.

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

The web values of the PHYS 143 deployment (Apps Script address, report form, ranking sheet) are kept in `course-packs/phys143/course.json` under `web`.

## Apps Script and the Google Sheet

1. Open the Google Sheet, then **Extensions, Apps Script**.
2. Replace the script with `apps_script/quiz_receiver.gs` and **Save**.
3. On a first setup, run `setup` once. It creates the tabs and settings.
4. **Deploy, Manage deployments**, edit the web app, choose **New version**, and **Deploy**. Keep "Execute as: Me" and "Who has access: Anyone". Editing the existing deployment keeps the same address.
5. Test before class: open the lecturer menu with the host key, run a short quiz, and open and close attendance.

**Pages and script must match from 0.9.0.** From version 0.9.0 the pages send every request by POST and the script refuses host keys and access codes in web addresses. Publish the pages and redeploy the script (step 4) together; the Control Centre shows a warning while the versions differ. After the update, lecturers and students sign in once more; students who chose "Remember" are then remembered by a session that lasts 14 days, not by their code.

The tabs, actions, join codes, attendance rules and privacy rules are unchanged from the original system and are described in sections 8 to 12 of the README of hhdonglo.github.io and in its `QUIZ_SETUP.md`.

The class list is loaded into the Roster tab from the lecturer's computer with `roster_sync.sh`, which stays on that computer and is not part of this package. Single changes can be made in **Control Centre, Class list**.

## Question banks

- Write or edit questions in `tools/quiz_src/lectureN.py`, then run `python3 tools/quiz_src/build.py N`.
- Check with `python3 tools/validate_quizzes.py` and `python3 tools/check_calcs.py`.
- Some banks hold past examination questions that were added to `quizzes/lectureN.json` directly (for example lecture 2 has 35 questions while its Python source writes 20). Running `build.py` for such a lecture replaces those questions, so edit the JSON directly for those lectures or add the questions to the source first.
- A bank becomes available to the live quiz when its week is listed under `weeks` in `apps_script/live_quizzes.json`.

## Set it up for a course (web version)

In the desktop app the first-launch setup does all of this. For the web version:

1. Fill in the labels and the address in `config.js`.
2. Fill in `data/lectures.json`, `data/portal.json` and `data/pages/course.json` with the course's programme and text, put its PDFs in a folder named in `data/lectures.json`, and copy `templates/lecture.html` and `templates/practice.html` to `lecture-N.html` and `lecture-N-practice.html` (replace {{N}} and {{NN}}), or copy `files/` of a course pack into this folder.
3. Add banks to `quizzes/` and list the weeks in `apps_script/live_quizzes.json`.
4. Give the new course its own Google Sheet and Apps Script deployment, so that marks and attendance stay separate.

## Privacy

- Never put the host key, the class list, student names or any secret in this folder or on a page.
- Public rankings show first names and scores only. Attendance and marks stay in the private Sheet.
- Practice pages keep progress in the student's browser. Nothing is sent unless the student types an ID.
- Messages are visible to the people in the conversation and to the lecturer, who can read every conversation. Students are told this on the page.
- Summaries and question generation (desktop app) send only the lecturer's documents and instructions to Anthropic; nothing about students is ever sent.
- A student's own record opens only with the student ID and that student's access code. Six wrong tries lock that ID for ten minutes.

## Course packs

A course pack is a .zip with `course.json` (the course settings) and `files/` (lectures, PDFs, banks and the data files above, at their paths in this folder). The desktop app imports and exports packs from Course settings and lectures. To build the PHYS 143 pack: `cd desktop && node make-course-pack.js ../course-packs/phys143 PHYS143-course-pack.zip`.
