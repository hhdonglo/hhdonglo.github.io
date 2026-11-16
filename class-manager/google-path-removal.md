# Google and Apps Script path removal (step 10): list for Hope's approval

Nothing is merged until Hope says so on this list. The website's own copy of the script and `apps_script/` source (`.gs`) are kept.

## Deleted files
- `desktop/google.js` (Google sign-in and the one-way copy to a Sheet)
- `apps_script/REDEPLOY.md` (redeploy steps for lecturers)

## Removed code and settings
- `desktop/main.js`: IPCs `cm:googleSignIn`, `cm:googleSignOut`, `cm:sync`; `google.bin` and `google-oauth.json` handling; the `scriptUrl` setting.
- `desktop/preload.js`, `desktop/courses.js`: the matching bridge calls and per-course Sheet fields.
- `desktop/app/home.html`: the Google card.
- `desktop/package.json`: `google-oauth.json` in the packaged files.
- `desktop/test/courses.test.js`: tests of the removed fields.

## Docs edited
- `desktop/README.md` (Google copy, `google.js`, "Switch on Google sign-in"), `ARCHITECTURE.md` (mode C, `google.bin`, `google.js`, Google line, new refactor section), `STRUCTURE.md` (settings and data folder rows, Google copy row, registration limit).

## Effect
Data stays on the lecturer's computer, or reaches phones through the relay. Existing `google.bin` files are ignored. No data is deleted. Tests: 403 pass with both engines.
