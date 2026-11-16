# Redeploy the CM Apps Script (keeps the same web app address)

Version to expect afterwards: 2026-11-16-ids-1 (the Control Centre shows the same number).

## Before you change the script (for whoever edits it)

1. Edit the modules in `apps_script/src/`, never `quiz_receiver.gs` itself.
2. Any change to the script means every lecturer must redeploy it, so bump `SCRIPT_VERSION` in `src/60-portal.gs` (the date and a short word, for example `2026-11-20-roster-1`) and the same string in `EXPECT_VERSION` in `control.html`.
3. Run `node apps_script/build.js`, then `node apps_script/version-lock.js`, then `npm test` in `desktop/`. `test/versions.test.js` fails if the script changed but its version did not.
4. Copy the new `quiz_receiver.gs` and this file to the project files folder, and tell the lecturer to redeploy.
5. The web path (the website's own script, `apps_script/quiz_receiver.gs` at the repository root, version in `phys143-control.html`) is separate: redeploy it only if you changed that file.

## To redeploy (for the lecturer)

1. Open `quiz_receiver.gs` from the release folder. Select all (Ctrl+A or Cmd+A) and copy.
2. Open your Google Sheet, then Extensions > Apps Script.
3. In the editor, open the file that holds the current code (Code.gs). Click in it, select all, paste, so the old code is replaced. Do not add a second file.
4. Click Save (disk icon).
5. Click Deploy > Manage deployments. Click the pencil (Edit) on the existing Web app deployment.
6. Under Version choose "New version" and click Deploy. Do NOT use "New deployment": that gives a new address.
7. Keep the settings as they were (Execute as: Me; Who has access: Anyone). If Google asks you to authorise, approve it.

## Check afterwards

- Open the Control Centre (control.html). It says "Script and page versions match" when the deployed script is the current one, and names both versions when it is not.
- In the lecturer sign-in, a wrong password says the password is wrong, and an unknown join code says the join code is not known.
- A join code like 26271 opens Week 1 when you are signed in.
- A student ID written as 22583439.0 in a class list or file is the same student as 22583439.
