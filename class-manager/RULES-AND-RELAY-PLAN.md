# Retiring the Apps Script path in CM: design, removal list and staged plan

Hope's decisions (2026-11-16): phones must work with the lecturer's computer off; neither students nor lecturers need a Cloudflare account; deprecate the Apps Script path in CM now; the copy on the hhdonglo website stays untouched; focus on a robust app.

## 1. The relay design with no accounts for anyone

One hosted relay, run by Hope, for all lecturers (a Cloudflare Worker with D1 in Hope's own account; nobody else needs one).
- **Lecturer (automatic, no invite code, nothing for Hope to do):** the first time CM needs the relay it creates a course key pair on the lecturer's computer and registers the course by itself: it sends the public key, the relay accepts any new course and answers with a course id. From then on every request from CM is signed with the course key. Anyone who has the CM installer can use phones and live classes at any time.
- **Student:** scans the QR code or opens the link. The phone talks to the relay with the course id and the student's access code. No account.
- **What lives on the relay while a class runs:** the open quiz and question, the QR secret, the sealed class list (ID and code hash per student), presence, answers and check-ins. CM pushes control changes (start, next, close) signed with the course key, and pulls the records into `course.db` every few minutes and at the end of class. When CM is off the relay still answers phones from the last state it was given (for example an open attendance session or a running quiz that was started earlier).
- **Retention:** records are deleted from the relay 7 days after CM has pulled them (14 days at most if never pulled), and the class list is deleted when the course is closed. The mailbox already works like this.
- **Rules:** one shared rules package (`desktop/rules/`) runs in CM and in the Worker, so both behave the same (one mark per ID per day, device binding, code checks).

### Abuse controls that need no human
- **Registration rate limits:** a few new courses per hour per network address, and a global ceiling per day; over the limit CM waits and retries, nothing for Hope to approve.
- **Proof of work on registration:** CM solves a small puzzle (a second or two) before a new course is accepted; this makes bulk sign-up costly for a bot and invisible to a lecturer.
- **Caps per course:** at most a set number of students (for example 500), answers, check-ins and bytes per course and per day; bigger bodies refused.
- **Expiry of unused courses:** a course that has had no signed request for 60 days is deleted with all its data; a course with live data and no pull is cleaned by the retention rule.
- **Optional installer-bound keys:** the installer can carry a build key that CM includes at registration, so Hope can switch off registrations from one leaked or abused build without touching lecturers on other builds. Off by default; no manual step in normal use.
- **Phones are rate limited per course and per network address** (the access code check already refuses repeated wrong tries).
- **A kill switch for Hope** (turn registration off, delete a course) exists but is never needed for normal use.

### What automatic registration means
- **Cost:** the relay's free tier covers one class easily, but open registration means cost scales with how many lecturers use it. Caps, expiry and delete-after-pull keep stored data small; Hope should watch the usage page. If it grows past the free tier, Cloudflare Workers paid plan is a flat monthly fee, and a per-course cap bounds the worst case.
- **Abuse risk:** an open endpoint can be used for spam or storage. The controls above limit this to small, short-lived, rate-limited data that is deleted by itself. It cannot remove the risk entirely; it keeps it small and self-cleaning.
- **Privacy:** because any lecturer can register, the relay holds many lecturers' classes. Each course is isolated by its own key (a course can read and change only its own data), data is encrypted at rest, and retention is short. Hope, as operator, could still read readable IDs while a class runs (option 1 below); this must be said in the privacy notice shown to lecturers and students. Lecturers at an institution should confirm their own data rules before using live classes with the relay.
- **No accounts:** students and lecturers never sign in; the course key is the lecturer's identity, and the access code is the student's.

### Where student IDs live (trade-offs)
1. **IDs readable on the relay while the class runs (recommended).** Needed to check "is this ID on the list" and "one mark per ID per day". Encrypted at rest, short retention, a privacy notice, Hope is the operator. Honest note: Hope (as relay operator) could read them. Institutional data rules are Hope's call.
2. **Keyed hashes of IDs.** The relay then never stores a readable ID, but IDs are short numbers so a hash can be guessed if the key is known to the relay (it must be, to check). It protects against casual exposure only, not against the operator.
3. **Sealed only, no live checks (the mailbox today).** Strongest privacy, but the relay cannot enforce roster, one per day or device rules, and a quiz cannot run with CM off. Not enough for "phones work with the laptop off".

## 2. What will be removed from CM and what stays (nothing removed yet)
Removal happens in the last stage, after the rules are ported and the relay works. Exactly:
- **Google Sheets copy and sign-in:** `desktop/google.js`, the Google card and its script in `desktop/app/home.html`, the IPCs `cm:googleSignIn`, `cm:googleSignOut`, sync-now in `desktop/main.js`, the `google-oauth.json` and `google.bin` files, and the tests that cover them.
- **The Web script URL setting:** `scriptUrl` in `desktop/main.js` and the "use a web script" option in setup, so CM no longer sends phones to a Google deployment.
- **Docs and deploy steps:** `apps_script/REDEPLOY.md`, the Apps Script redeploy notes in `ARCHITECTURE.md`, `STRUCTURE.md` and the release notes (no more "redeploy" step for lecturers).
- **Stays:** `apps_script/src/*.gs` and `quiz_receiver.gs` keep running inside CM through the local shim as the engine until each area is ported (stage 2); after the last area is ported the shim and the `.gs` files leave CM's package. The website's copy and the repository folder used by the website are not touched.
- **What Hope must do:** nothing for stages 1 and 2. For the relay stage: create one Cloudflare Worker and D1 database, set the secrets, and watch the usage (steps will be in `relay/README.md`). No invite codes and nothing per lecturer. Lecturers redeploy nothing.

## 3. Staged work (each stage is one PR, tested, not merged without Hope's "publish")
1. **Rules package and parity harness (this PR).** `desktop/rules/` with the store interface, access codes ported, tests that run the script and the module on the same workbook and compare. Nothing calls the module yet; no behaviour change.
2. **Port the areas, one per PR, each with parity tests:** attendance, then roster and class list, then quiz control and answers, then student views, then lecturer views and stats. After each, CM can call the module instead of the script for that area (behind a setting that Hope can turn off).
3. **Relay with live state:** Worker and D1 using the same rules; automatic registration with proof of work and rate limits; caps; expiry of unused courses; push and pull; retention job; tests with a fake D1; a setup guide.
4. **Phone path:** pages talk to the relay (with the outbox, as today) and fall back to CM's own server when on the same network.
5. **Deprecate:** remove what section 2 lists, update docs and release notes, one draft release. Nothing is removed before Hope says so for that PR.

## 4. Risks
- Rules drifting between the old script and the new modules: parity tests on every area.
- Student IDs held by a hosted relay: retention, privacy notice, institutional rules (Hope).
- Open registration: cost and abuse (see the controls), no human approval step.
- Real phones, the tunnel, Cloudflare and D1 are untested; 200 phones at once is untested.
- The port is large (about 3,750 lines); one area per PR keeps it reviewable.
- Installers are unsigned and the desktop window has not been click-tested.
