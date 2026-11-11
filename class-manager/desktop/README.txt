CLASS MANAGER (BETA): INSTALLATION AND INSTRUCTIONS
===================================================

Class Manager is a desktop app for lecturers, for any course. It shows how
your class is doing, and it collects what is needed to show that: attendance,
live quizzes and practice questions. Every record stays on your computer.

This is a Beta version. Keep a copy of your class records elsewhere (Part 9
shows how) and report problems through the Contact page of
https://hhdonglo.github.io/contact.html

These instructions are also in the app: press "Instructions" in the sidebar.

CONTENTS
  1. Install the app
  2. Set up your course (once)
  3. Before the first class
  4. Run a class
  5. After class: results, groups and Learning Progress
  6. Your password, the host key and access codes
  7. Students on mobile data (Internet mode, optional)
  8. Keep notes and records in your own cloud storage (optional)
  9. Backups
 10. Questions, materials and the Anthropic key (optional)
 11. Many courses
 12. Where your data is
 13. If something goes wrong

Words used in this guide
  Host key        A private key shown at the top of the window. Lecturer
                  pages ask for it. Once you choose a password, the password
                  is used instead.
  Access code     A personal code for each student, printed on a slip.
  Student address The web address (and QR code) that students open on their
                  phones.


1. INSTALL THE APP
------------------

The installers are not yet signed, so your computer asks for confirmation
the first time you open the app. This is expected.

Windows
  1. Double-click Class-Manager-Windows.exe.
  2. If "Windows protected your PC" appears, choose "More info", then "Run
     anyway".

macOS
  1. Open Class-Manager-macOS.dmg and drag Class Manager to Applications.
  2. Open Applications, right-click (or Control-click) Class Manager and
     choose "Open", then "Open" again.
  3. If macOS still refuses, open System Settings, Privacy and Security,
     and press "Open Anyway".

Linux
  1. Make Class-Manager-Linux.AppImage executable (right-click, Properties,
     Permissions, or the command chmod +x).
  2. Double-click it.

The first time the app starts, Windows and macOS ask whether it may accept
network connections. Choose Allow (at least on private networks). Students'
phones reach the app through this connection.


2. SET UP YOUR COURSE (ONCE)
----------------------------

The app opens with a short setup. You can skip any step and come back later:
a reminder list stays on "Class Overview" until the steps are done.

Step 1. Course details
  1. Type the course code and title, your name, the semester and the
     teaching dates.
  2. Add the optional items if you wish (institution, contact for students,
     header colour, logo).
  3. Press Save.
  Change these later under "Course and Content", then "Course settings and
  lectures".

Step 2. Class list
  The class list decides who counts. Attendance and marks are kept only for
  students on it.
  1. Open "Class Roster" in the sidebar and press "Add or replace students".
  2. Either press "Choose a file" (a CSV or Excel .xlsx file) or paste the
     list. For a ready-made file, press "Download the Excel template", fill
     in the first sheet and save it.
  3. For each column, say what it holds: student ID, first name, last name.
     (A single Name column also works.)
  4. Check the preview. Names should be in the right columns.
  5. Press "Save class list".
  To add students later, repeat the steps. "View the list" shows who is
  saved.

Step 3. Course materials (optional now)
  1. Under "Course and Content", press "Course settings and lectures".
  2. Add each lecture: number, title, a short summary, and its learning
     objectives. Attach the slides, handout and tutorial sheet.
  3. If a colleague gave you a course pack (.zip), press "Import a course
     pack" instead. It brings in a whole course at once. "Export this course
     as a pack" makes one of your own.
  Students find the lectures on their portal.


3. BEFORE THE FIRST CLASS
-------------------------

1. Open "Class Roster" and check that the class list is complete.
2. Make access codes (needed for attendance, see Part 6):
   a. Open "Class Roster", then "Access codes".
   b. Type your host key or password when asked.
   c. Press "Create codes for students without one".
   d. Press "Print slips" and hand each student their slip.
3. Choose how students connect (Part 4, step 1).


4. RUN A CLASS
--------------

Open "Class Tools" in the sidebar. This is the control point for a class.

Step 1. Let students connect
  1. On the "Class Overview" or "Class Tools" screen, choose how phones
     connect:
     - Same Wi-Fi or hotspot (the default): your computer and the students'
       phones use the same Wi-Fi.
     - Internet: for phones on mobile data (Part 7).
  2. Press "Scan code" to show the address and QR code full screen on
     the projector.
  3. If phones cannot open the address, the Wi-Fi is keeping devices apart.
     This is common at universities. Switch on a phone hotspot and join the
     computer and the students' phones to it, or choose Internet.

Step 2. Take attendance
  1. Press "Take attendance" (Class Tools or Class Overview). Type your
     host key or password, then press "Start attendance".
  2. Show the QR code on the projector. It changes during the session, so
     it must be scanned in the room.
  3. Each student scans it and types their student ID and personal access
     code. The first time takes a minute. Later check-ins take one tap,
     because the phone remembers.
  4. Press "Close attendance and record absences" when you are done and
     look at the list. Then open the "Control Centre" and submit the
     session to the attendance record. A session counts only once
     submitted.

  Nobody can check in for a friend. A check-in is held under "Check-ins to
  review" when the ID is right but the phone is not the one registered to
  that student (a new phone, a flat battery, or someone else's phone).
  Approve it only if you can see the student in the room. On the same list
  you can remove a check-in, mark a student present by hand, and release a
  registered phone when a student changes phone.

Step 3. Run a live quiz
  1. Press "Run a quiz" and choose the lecture. (A lecture needs approved
     questions, see Part 10.)
  2. Open the "Projector display" on the projector. It shows the join code
     and the questions. Press "Start quiz".
  3. Students open the student address, choose Quiz, and enter their first
     name, student ID and the join code. The join code is 2627 followed by
     the week number (week 2 is 26272).
  4. Move through the questions. On a question that splits the class,
     press "Discuss and vote again": students explain their answers to a
     neighbour, then answer again. The movement is shown afterwards.
  5. Press "Release results" when you are ready. Nothing counts in the records
     until you release it.

Practice questions and the mock examination need nothing from you.
Students open them from their portal whenever the app is open.


5. AFTER CLASS: RESULTS, GROUPS AND LEARNING PROGRESS
-----------------------------------------------------

The sidebar shows the results. Everything is worked out on your computer
from attendance, quiz and practice records. Nothing is estimated.

Class Overview (the first screen)
  - "Is the class learning?" gives a verdict with its evidence: do students
    answer the same questions better when they return, how quiz scores
    trend, which wrong answers many students share, and participation. It
    needs two released quizzes with at least 10 students, or 30 repeated
    answers. It never judges from one quiz.
  - "Areas to target" ranks topics, questions, students, sessions and
    quizzes that need attention, with a suggested action.

Students
  A table of every student: attendance, quiz results, practice, and a
  suggested engagement group (On track, Working hard but struggling,
  Disengaged, Needs a check-in). The groups are suggestions for you to
  review. Students never see them. Press a student for their full record,
  or press "Find a student" (top of the window) and type an ID or name.

Learning Progress
  1. Open "Learning Progress" in the sidebar. It needs students to have
     answered quiz questions.
  2. For progress by topic, give each question a learning objective:
     press "Learning objectives" on that screen, choose a lecture, and
     accept the suggestions or choose an objective for each question.
  3. The screen then shows the effect of pair discussion (before and after
     the second vote), the number of students secure on each objective, a
     map of students against objectives, class progress over time, and
     learning gain. Open a row to see a student.

Groups
  1. Open "Class Tools", then "Student groups". Type the host key or
     password.
  2. Name the set (for example Lab 1). Choose how to make groups: random,
     mixed by quiz results, or mixed by attendance. Choose who is included
     and the group size.
  3. Press "Make groups". Lock any group you want to keep, then make the
     set again for the rest.
  4. Use "Projector view", "Download CSV" or "Print".
  5. Record a mark for each group. Marks are copied to every member and
     students see their group and mark under My progress.
  For work done in groups over several days, use "Group assignments"
  (Learning Progress screen). Set a task, then record marks and peer
  ratings.

Grades and Results
  1. Open "Grades and Results" and choose a tab (Attendance, Master,
     Totals and others). Click a heading to sort.
  2. "Download as Excel" saves every tab of the course in one workbook.
     "Export all tabs as CSV" saves one file per tab. Names are written as
     First name and Last name columns.
  3. "Attendance with names" shows names next to the marks.
  Students and Class Roster have their own Excel and CSV downloads.

Teaching insights, Calendar and Messages
  Under "Class Tools". Teaching insights shows the weakest lectures and
  questions. Calendar and Messages hold the course calendar,
  announcements to the class and moderated class messages. Messages are
  delivered when each person next opens their page while the app is open.


6. YOUR PASSWORD, THE HOST KEY AND ACCESS CODES
-----------------------------------------------

Host key
  The app makes a host key the first time it runs. It is shown at the top
  of the window with a Copy button. Lecturer pages (attendance, quiz
  controls, groups, codes) ask for it. Keep it private. Students never
  need it.

Choose your own password (recommended)
  1. Open "Class Tools", then "Lecturer password".
  2. Type the temporary key (the host key) where it asks for the current
     password.
  3. Type your new password twice. Use at least 10 characters. A few
     words are fine.
  4. Press "Save password".
  5. A recovery code is shown once. Write it down or put it in a password
     manager. Without it a lost password cannot be recovered by the page.
  From now on, use your password wherever the host key was asked for. The
  top of the window then says "your password".

If you forget your password
  - With the recovery code: on the lecturer login, choose "I forgot my
    password", type the code and a new password. A new recovery code is
    shown. The old one stops working.
  - Without it: open "Class Tools" and press "Reset password (lost it)".
    Confirm. A temporary key appears on the home screen, the recovery code
    is removed and every lecturer sign-in ends. Choose a new password
    straight away.

Access codes
  Each student has a personal code. It proves a check-in or a view of
  progress is theirs.
  1. "Class Roster", then "Access codes". Sign in.
  2. "Create codes for students without one".
  3. "Print slips" and hand them out.
  "New codes for expired ones" and the reissue option on the same page
  make new codes. Print and hand out the new slips.


7. STUDENTS ON MOBILE DATA (INTERNET MODE, OPTIONAL)
----------------------------------------------------

Use this when the Wi-Fi keeps phones apart, or students are not in the
room.
  1. Open "Class Tools" (or "Class Overview") and choose Internet as the
     way students connect.
  2. Wait for the new address and QR code. Show them. The address changes
     each time you start.
  3. At the end of class, press "Stop internet access". Closing the app
     also stops it, and it stops by itself after the time set in App
     Settings.

How it works: the app uses Cloudflare's free quick tunnel. It needs no
account and no router settings. The first time, the app downloads
Cloudflare's connector (cloudflared) and checks it before running it, so
an internet connection is needed. Class traffic passes through
Cloudflare's network under Cloudflare's terms, and the service has no
uptime guarantee. The app's own screens are never reachable from the
internet. Lecturer pages are refused there unless you allow them under App
Settings, "Access and safety".

This option has not been tested in many real classes. Try it once before
you rely on it.


8. KEEP NOTES AND RECORDS IN YOUR OWN CLOUD STORAGE (OPTIONAL)
--------------------------------------------------------------

This is off until you switch it on. The app keeps no keys of its own: you
use your own account.

Link a place
  1. Open "App Settings", then "Link storage (optional)".
  2. Under "Where to keep the copies", choose one:
     - A folder that Google Drive, OneDrive, Dropbox, MEGA, iCloud Drive
       or similar keeps in the cloud. Press "Choose a folder" and choose a
       folder inside it. This is the simplest choice.
     - Your own WebDAV (for example Nextcloud), a private GitHub
       repository, your own Dropbox app, or S3-compatible storage. The
       screen explains how to get the details for each.
  3. Choose a passphrase of at least 10 characters, and type it twice.
     Copies are encrypted with it. Without it a copy cannot be opened and
     it cannot be recovered. Write it down.
  4. Press "Link and make the first copy".

Choose what is kept in step
  Under "What is kept in step with the cloud", each item has its own
  setting:
  - Lecturer notes
  - Course materials
  - Class list
  - Attendance
  Choose either "This computer only" (the default) or "Kept here and in the
  cloud, in step". Items kept in step are saved on your computer at once,
  sent to the cloud a few seconds later, and brought in from your other
  computers regularly. If you have no connection, the app carries on and
  catches up later. Switching an item never deletes anything.
  - Class list and attendance are encrypted. Notes and materials are
    ordinary readable files, with no student data.
  - If a file changed here and elsewhere, yours is kept and the cloud one
    is saved beside it as "<name>.from-cloud".
  - Quizzes, scores, messages, access codes and the resource library are
    not yet kept in step. Use backups (Part 9) for these.

Press "Sync now" to do it immediately, "Copy now" to make an encrypted copy,
and "Stop linking" to stop. Nothing is deleted when you stop.


9. BACKUPS
----------

Automatic
  The app makes a backup when a course opens, every four hours and when the
  app closes. Each is read back at once to check it. The newest 14 are kept
  in the course's data folder.

Restore a backup
  1. Open "App Settings", then "Records protection and backups".
  2. Find the backup in the list and press "Restore".
  3. Confirm. The records as they are now are kept as a backup first.

Back up now, or to a file
  - "Back up now" makes one immediately.
  - "Save a backup to a file" makes a single file, encrypted with a
    passphrase you choose. Keep it on a USB drive or in cloud storage, or
    use it to move the course to another computer. "Restore from a file"
    brings it back and asks for the passphrase. A lost passphrase cannot be
    recovered.

The records are encrypted on your computer. The key is kept in the
computer's keychain where it has one. App Settings says whether it does.


10. QUESTIONS, MATERIALS AND THE ANTHROPIC KEY (OPTIONAL)
---------------------------------------------------------

Open "Course and Content", then "Open resources and questions".

Add teaching material
  Press "Add files to the library" and choose PDF, Word (.docx),
  PowerPoint (.pptx), Markdown or text files. You can search them and read
  summaries. A scanned PDF with no text layer cannot be read.

Add quiz questions
  1. Open the "Import questions" tab and press "Save the template"
     (Word or Markdown).
  2. Fill in the template (Word, Markdown or text).
  3. Choose your file. Each question is checked and shown to you first.
  4. Press "Add" to put the good ones in your drafts.
  5. Open "Review drafts" and approve each question. Nothing reaches
     students until you approve it. You can also write questions by hand.

Draft questions from your materials (needs a key)
  This and the full summaries use your own Anthropic API key.
  1. Enter the key once under Settings on this screen.
  2. Choose documents and a focus, then generate.
  3. Review every draft before it is used.
  Use is charged to your key. Only your documents and instructions are
  sent. No student data is sent. Without a key, all else works, including a
  simpler summary.


11. MANY COURSES
----------------

One installation runs all your courses.
  - The course list at the top of the window chooses the course. Every
    screen then shows that course only.
  - "Add a course..." and "Manage courses..." in the same list add, rename,
    archive and restore courses. Archiving stops a course's pages but keeps
    its records.
  - Each course has its own class list, attendance, quizzes, groups, host
    key, password and access codes. Nothing is shared. A student on two
    courses has two records and two codes.
  - Students open each course at its own address, which ends in /c/ and the
    course's short name.
  - You can keep a course's lectures in a folder you choose, such as a
    local copy of a GitHub repository ("Manage courses"). Student records
    are never written to it.
  - Do not go back to an older version of the app after using this one.


12. WHERE YOUR DATA IS
----------------------

All records stay on this computer, in the data folder shown at the bottom
of the window and under "App Settings", then "Data" ("Open data folder"):
  Windows: %APPDATA%\Class Manager
  macOS:   ~/Library/Application Support/Class Manager
  Linux:   ~/.config/Class Manager
Each course has its own folder inside it, under "courses".

If this build offers "Sign in with Google" (App Settings), the app keeps a
copy of every tab in a Google Sheet in your own Drive. It can see only the
file it makes.


13. IF SOMETHING GOES WRONG
---------------------------

Phones cannot open the address
  - Check the phones and the computer are on the same Wi-Fi.
  - Allow the app through the firewall on private networks.
  - If the network keeps devices apart, use a phone hotspot or Internet.

Internet access does not start
  Check your internet connection and try again. The first start downloads
  the connector. A firewall that blocks outgoing connections to Cloudflare
  stops it.

A student's check-in is waiting
  Open the attendance page and look at "Check-ins to review" (Part 4).

A student cannot check in
  They need their ID and personal access code. Create or reprint codes
  (Part 6).

A student changed phone
  Release the old phone on the "Check-ins to review" list.

I forgot my password
  See Part 6.

The records file could not be read
  App Settings, "Records protection and backups", shows the problem. The
  damaged file is kept, not overwritten. Restore a backup (Part 9).

Text is too small or too large
  Press Cmd and plus or minus (Ctrl on Windows and Linux). Cmd or Ctrl and 0
  returns to normal. Cmd or Ctrl and / shows all keyboard shortcuts.

The app says a port is in use
  Another program uses port 8143. The app picks a free one. The address
  shown under "Class Tools" is always right. The port can be set under App
  Settings.
