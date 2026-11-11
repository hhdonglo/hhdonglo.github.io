CLASS MANAGER (BETA): INSTALLATION AND INSTRUCTIONS
===================================================

Class Manager is a desktop app for lecturers, for any course. It runs live
class quizzes, attendance, practice questions and a mock examination from the
lecturer's own computer, and keeps every record on that computer.

This is a Beta version and is not yet fully tested. Keep a copy of class
records elsewhere, and report problems through the Contact page of
https://hhdonglo.github.io/contact.html

These instructions are also in the app: press "Instructions" on the home
screen.


1. INSTALLATION
---------------

The installers are not yet signed, so the system asks for confirmation the
first time.

Windows
  Run Class-Manager-Windows.exe. If "Windows protected your PC" appears,
  choose "More info", then "Run anyway".

macOS
  Open Class-Manager-macOS.dmg and drag Class Manager to Applications. The
  first time, right-click (or Control-click) the app and choose "Open". If
  macOS still refuses, open System Settings, Privacy and Security, and choose
  "Open Anyway".

Linux
  Make Class-Manager-Linux.AppImage executable (chmod +x, or Properties,
  Permissions) and run it.


2. FIRST LAUNCH
---------------

- When the app first starts, Windows and macOS ask whether it may accept
  network connections. Allow it, at least on private networks: students'
  phones connect through it.
- The app creates its results workbook and a host key automatically. The host
  key is shown in the bar at the top of the window, with a Copy button. Type
  it when a lecturer page asks for it,
  and keep it private.
- A short setup then asks for what the app needs to know about the course.
  Each step can be skipped and finished later: a reminder bar stays at the top
  of "In Class" until all three are done (it can be hidden), and "Course
  settings and lectures" under "Course and Content" changes any of it
  afterwards.
    1. Course details: course code and title, lecturer, semester and teaching
       dates; optionally the institution, a contact for students, a header
       colour, a logo and a notice for the course pages.
    2. Class list: choose a CSV or Excel (.xlsx) file, or paste the list. Say
       which column holds the student ID and which holds the name, check the
       preview and save. "Download the Excel template" saves a workbook
       to fill in (a CSV copy can be chosen in the save window).
    3. Course materials: add each lecture (number, title, summary, learning
       objectives) and its files (slides, handout, tutorial sheet and others);
       add teaching material to the library; import existing question files.
       A course pack (.zip) brings in a whole prepared course at once, and
       "Export this course as a pack" makes one to move the course to another
       computer or share it with a colleague.


3. BEFORE THE FIRST CLASS
-------------------------

1. Check that the class list is complete ("Class Roster" in the sidebar).
2. To let students see their own progress, open "Access codes",
   type the host key, press "Create codes for students without one", then
   "Print slips", and hand each student their slip.


4. CONNECTING STUDENTS
----------------------

Under "In Class" (the first screen), choose how students connect, then show
the address and the QR code on the projector. "Copy link" copies the address;
"How this works" explains the two ways of connecting.

Same Wi-Fi or hotspot (the default)
  The computer and the students' phones join the same Wi-Fi network. If
  phones cannot open the address, the network keeps devices apart, which is
  common on university Wi-Fi. In that case switch on a phone hotspot and
  connect both the computer and the students' phones to it, or choose
  Internet.

Internet
  The app creates a temporary https address that students open from any
  network, including mobile data, while the app is open.
  - It uses Cloudflare's free quick tunnel service, which needs no account
    and no router settings. Class traffic passes through Cloudflare's
    network and is subject to Cloudflare's terms.
  - The first time, the app downloads Cloudflare's connector program
    (cloudflared) and checks it before running it. An internet connection is
    needed for this.
  - The address changes each time it is started, so show the new QR code.
  - The service offers no uptime guarantee. It is usually enough for one
    class.
  - Press "Stop internet access" at the end of the class. Closing the app
    also stops it.
  - The app's own screens are never reachable from the internet, and the
    lecturer pages still need the host key.
  - This option has not yet been tested in real classes. Try it once before
    relying on it.


5. IN CLASS
-----------

Attendance
  Lecturer menu, type the host key, Take attendance. Show the QR code on the
  projector. The code changes during the session, so it must be scanned in
  the room. Students scan it and type their student ID and personal access
  code; each student is marked once per day. Create the access codes and
  print the slips first (Access codes).

  No one can check in for a friend. A classmate's ID is refused without that
  student's access code, and the first phone a student checks in with is
  registered to them for the term. A check-in from a phone registered to
  someone else, or from a phone other than the student's own (a flat battery,
  a broken phone), is not counted: it waits under "Check-ins to review" until
  you approve it. Approve it only when you can see the student in the room.
  On the same list you can remove a check-in, mark a student present by hand,
  and forget a registered phone when a student changes phone.

  The ID and code are remembered on the phone, so later check-ins take one
  tap. Close attendance, review the list, then submit it.

Live quiz
  Lecturer menu, Run quiz. A quiz can be run for every lecture that has
  approved questions in its bank. The join code is 2627 followed by the
  week number (for example 26272 for week 2). Open "Projector display" on the projector.
  Students open the student address, choose Quiz, and enter their first
  name, student ID and the join code.

Practice questions and mock examination
  Students open them from the portal at any time while the app is running.
  Practice questions appear for each lecture that has a question bank; the
  mock examination draws on questions marked as past examination questions.


6. AFTER CLASS
--------------

The app opens on "Class Overview", which shows how the class is doing. The
figures are worked out on this computer from the attendance, quiz and
practice records; nothing is estimated.

- "Is the class learning?" gives a verdict (Learning, Mixed, Not yet
  learning, or Not enough data) with the evidence behind it: whether
  students answer the same questions better when they come back, the trend
  of quiz scores, wrong answers shared by many students, and participation
  and attendance. It needs at least two released quizzes with 10 or more
  students, or 30 repeated answers, and never judges from one quiz.
- "Areas to target" ranks the topics, questions, students, sessions and
  quizzes that most need attention, each with its evidence, sample size and
  a suggested action.
- "Students" lists every student with attendance, absences in a row,
  arrival time, quiz results, change and percentile, practice, and a
  suggested engagement group (On track, Working hard but struggling,
  Disengaged, Needs a check-in). The groups are suggestions for you to
  review, are never shown to students, and their thresholds can be changed.
- "Attendance" and "Quizzes and Questions" show rates by session, arrival
  times, score distributions, and each question's difficulty and options.

The QR code, attendance and quizzes are under "Class Tools".

- Under "Grades and Results", choose a tab (Attendance, Master, Totals and
  others) to view it.
- "Download as Excel" saves every tab of the current course in one Excel
  workbook, one sheet per tab. "Export all tabs as CSV" saves one CSV file
  per tab instead. The Students screen has its own "Download as Excel".
- "Attendance with names" shows names next to the attendance marks.
- "Teaching insights" shows the weakest lectures and questions, and the
  students who may need attention.
- "Student groups" forms groups for an activity and records a mark for each
  group.
- "Calendar" and "Messages and announcements" keep the course calendar,
  announcements to the class, and moderated class messages. Messages are
  delivered when each person next opens the page, while the app is open.


7. RESOURCES AND QUESTIONS
--------------------------

Under "Course and Content", press "Open resources and questions".

- Add PDF, Word (.docx), PowerPoint (.pptx), Markdown or text files to the
  library to search them and read summaries. A scanned PDF without a text
  layer cannot be read.
- Quiz questions can be imported from a file (the Import tab saves a
  template), written by hand, or drafted from the library. Every question is
  reviewed by the lecturer before it is used.
- Drafting questions and full summaries need the lecturer's own Anthropic API
  key, entered under Settings in that screen. Use is charged to that key's
  account. Only the lecturer's documents and instructions are sent; no
  student data. Without a key, everything else works, including a simpler
  summary.


8. DATA, BACKUP AND PRIVACY
---------------------------

MANY COURSES. One installation runs all your courses. The course list at the
top of the window chooses the course; every screen in that window then shows
that course only, and windows opened from it (attendance, quiz, projector)
belong to it. "Add a course..." and "Manage courses..." in the same list add,
rename, archive and restore courses. Each course has its own class list,
attendance, quizzes, groups, assignments, learning objectives, messages, host
key, student access codes, Google Sheet and Apps Script address. Nothing is
shared: a student who takes two courses has two records and two codes. A class
can go on in one course (students checking in, a quiz running) while you look
at another; the course list marks a course that has a class running.
Students open each course at its own address, which ends in /c/ and the
course's short name. Addresses printed before version 0.8.0 still open the
first course. Archiving a course stops its pages; its records stay.
A course's lectures, files and question banks are kept in the app, or in a
folder you link under "Manage courses", for example your own copy of a GitHub
repository. If the folder is a Git repository, "Update from repository" runs
git pull. Student records are never written to a linked folder.
The first time 0.8.0 starts, the course you had becomes the first course,
with all its records.

All records stay on this computer, in the data folder shown in the status bar
at the bottom of the window and under "App Settings" (each course has its own
folder inside it, under "courses"):
  Windows: %APPDATA%\Class Manager
  macOS:   ~/Library/Application Support/Class Manager
  Linux:   ~/.config/Class Manager
Back up this folder with the rest of your files.

Optional: if this build offers "Sign in with Google", the app keeps a copy of
every tab in a Google Sheet in your own Drive, one Sheet for each course, and
can see only those files. One sign-in serves every course.


9. TROUBLESHOOTING
------------------

Phones cannot open the address
  Check that the phones and the computer are on the same network. Allow the
  app through the firewall on private networks. If the network keeps devices
  apart, use a phone hotspot or choose Internet.

Internet access does not start
  Check the computer's internet connection and try again. The first start
  needs to download the connector program. A firewall that blocks outgoing
  connections to Cloudflare will stop it.

Text is too small or too large
  Press Cmd and plus or minus (Ctrl on Windows and Linux) to change the size
  of everything in the app, and Cmd or Ctrl and 0 for the normal size. The
  app remembers the size. Press Cmd or Ctrl and / for all keyboard shortcuts.

The host key is not shown
  If the host key was changed on the quiz dashboard, the app no longer
  shows it. Use the new key.

The app reports that a port is in use
  Another program uses port 8143. The app then chooses a free port by
  itself; the address under "In Class" is always the right one. The port
  can also be set under "App Settings".
