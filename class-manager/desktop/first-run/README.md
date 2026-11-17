# first-run: password, roster, course material

For the person who maintains this code.

**Rules (Hope, 2026-11-16).**
1. One central lecturer password for CM and every course. It is chosen first, before anything else, and is asked for once, when CM opens. After sign-in no other password is asked for anything.
2. Then the class roster (Class Roster page, screenshots; see `../roster-shots/README.md`).
3. Then course material: point CM at the course folder (quizzes in the online format) and/or generate new quizzes (Anthropic API key, `../authoring.js`, drafts reviewed before students see them).
A later step never opens before an earlier one is done.

| File | Job |
| --- | --- |
| `stages.js` | The order, which calls wait for which stage (`NEEDS`), and the refusal message. Pure. |
| `central-login.js` | The one password: salted scrypt hash and recovery code in `<CM data>/central-login.json`, lockout after 8 wrong tries. |
| `quiz-bank.js` | Reads and checks a quiz bank in the online format; add-only merge by question id. Pure. |
| `bank-folder.js` | Finds `lectureN.json` (and `lectureN_concept.json`) in a folder, shows a plan, writes them into the course `quizzes/` folder unchanged. Read only on the folder. |
| `../course-folder.js` | Finds the course content in any chosen folder (the folder, a pack's `files/`, or a pack up to two levels below) and counts lectures, banks, questions and lecture files, naming any file listed but missing. Read only. Also used when a course is linked to a folder. |
| `ipc.js` | `cm:firstRunState`, `cm:bankFolderPick`, `cm:bankFolderLoad`. |
| `../app/login.html` | The sign-in screen; the same page chooses the password the first time. |
| `../app/bank-folder.js` | The course folder card in setup. |

**No per-course password.** Course-level passwords and recovery codes are gone: the course lecturer key is set from the CM password (`giveCentral`) and is never shown; the pages refuse `setkey` and `password_recover` (`stages.js`, `changesPassword`); the temporary key, the Host key button and the reset path were removed. Only a browser opened outside CM (for example a phone) asks for the CM password, once.

**How one password reaches every course.** `main.js` keeps the password in memory after sign-in and gives it to each course's own lecturer key (`giveCentral`, stamped per course so it is done once per change). The CM window signs in to lecturer pages by itself (`preload.js` reads `cm:sessionKey`). Phones or other browsers that open lecturer pages still need the password once.

**Online quiz format** (`quizzes/lectureN.json` on the website): `{ lecture, title, questions: [ { id, type (concept, calc, graph, misconception), q, options[4], answer (0 to 3), exp, ref, ... } ] }`. Extra fields (`source`, `tag`, `level`, `calc`) are kept. Tests load every online file.

**To change.** Order or what waits: `stages.js`. Password rules: `central-login.js` (`problem`). Bank rules: `quiz-bank.js`. Tests: `../test/first-run.test.js`.
