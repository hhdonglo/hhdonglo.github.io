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

1. Connect the laptop and the students' phones to the same Wi-Fi. If the university network does not let phones reach the laptop, switch on a phone hotspot and connect the laptop and the class to it.
2. **Attendance**: Lecturer menu, log in with the host key, Take attendance. Show the QR code on the projector. Students scan it and type their student ID. Close attendance, then submit it.
3. **Live quiz**: Lecturer menu, Run quiz. Use join code `2627` followed by the week number (for example `26272` for week 2). Open **Projector display** on the projector. Students open the student address, choose Quiz, and enter their first name, student ID and the join code.
4. Practice questions and the mock exam need nothing from the lecturer; students open them from the portal at any time while the app is running, or the lecturer can give them the course pages another way.

**After class**

Under **Results and marks**, choose a tab (Attendance, Master, Totals and others) to see it, or press **Export all tabs** to save every tab as a CSV file that opens in Excel. **Attendance with names** shows names next to the attendance marks.

All data stays on the laptop, in the data folder shown at the bottom of the home screen. Back it up with the rest of your files.

**Optional: Google Drive copy.** If this build has Google sign-in, press **Sign in with Google**. The app creates one Google Sheet in your own Drive and keeps a copy of every tab there, updated within a minute of each change. The app can see only the file it creates.

**Another course.** Under Settings, change the course code, title and institution. To replace the lectures and questions, see the README one folder up.

## What runs where

- `main.js`: starts the classroom server on the local network (port 8143 by default), opens the home screen, handles the app's own buttons.
- `backend.js`: runs `apps_script/quiz_receiver.gs`, unchanged, against a workbook stored in the app's data folder, so every rule of the Google version (join codes, rounds, scoring, one check-in per ID per day, class list, Master and Totals) works the same way. Location checking for attendance is off, because phones share their location only with secure (https) addresses.
- `google.js`: optional Google sign-in and the copy to a Google Sheet.
- `app/home.html`: the home screen.
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
