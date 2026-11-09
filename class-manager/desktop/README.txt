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
  key is shown on the home screen. Type it when a lecturer page asks for it,
  and keep it private.
- A short setup then asks for what the app needs to know about the course.
  Each step can be skipped and finished later: a checklist stays on the home
  screen until all three are done, and "Course settings and lectures" on the
  home screen changes any of it afterwards.
    1. Course details: course code and title, lecturer, semester and teaching
       dates; optionally the institution, a contact for students, a header
       colour, a logo and a notice for the course pages.
    2. Class list: choose a CSV or Excel (.xlsx) file, or paste the list. Say
       which column holds the student ID and which holds the name, check the
       preview and save. "Download a sample class list" saves a template.
    3. Course materials: add each lecture (number, title, summary, learning
       objectives) and its files (slides, handout, tutorial sheet and others);
       add teaching material to the library; import existing question files.
       A course pack (.zip) brings in a whole prepared course at once, and
       "Export this course as a pack" makes one to move the course to another
       computer or share it with a colleague.


3. BEFORE THE FIRST CLASS
-------------------------

1. Check that the class list is complete (home screen, "Class list").
2. To let students see their own progress, open "Access codes for students",
   type the host key, press "Create codes for students without one", then
   "Print slips", and hand each student their slip.


4. CONNECTING STUDENTS
----------------------

Under "Students open" on the home screen, choose how students connect, then
show the address and the QR code on the projector.

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
  print the slips first (Access codes for students).

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

- Under "Results and marks", choose a tab (Attendance, Master, Totals and
  others) to view it.
- "Export all tabs" saves every tab as a CSV file that opens in Excel.
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

On the home screen, press "Open resources and questions".

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

All records stay on this computer, in the data folder shown at the bottom of
the home screen:
  Windows: %APPDATA%\Class Manager
  macOS:   ~/Library/Application Support/Class Manager
  Linux:   ~/.config/Class Manager
Back up this folder with the rest of your files.

Optional: if this build offers "Sign in with Google", the app keeps a copy of
every tab in one Google Sheet in your own Drive, and can see only that file.


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

The host key is not shown
  If the host key was changed on the quiz dashboard, the home screen no
  longer shows it. Use the new key.

The app reports that a port is in use
  Another program uses port 8143. The app then chooses a free port by
  itself; the address on the home screen is always the right one. The port
  can also be set under Settings.
