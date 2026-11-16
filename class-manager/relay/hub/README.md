# CM relay (hub)

One hosted Cloudflare Worker, run by the CM owner, that lets students' phones take part when the lecturer's computer is off. Lecturers and students never create a Cloudflare account and never type a relay address: the address is built into CM.

## How it works
- **Registration is automatic.** The first time CM needs the relay it makes a course key (ECDSA P-256) and registers itself: `GET /v1/challenge`, solve the small proof of work, `POST /v1/register`. The course id is made from the public key, so nobody can claim another course. There is no invite code and no account.
- **CM's requests are signed** with the course key (`src/auth.js`): method, path, time, a never-repeated nonce and a hash of the body. Used for `/v1/pull`, `/v1/ack`, `/v1/state`, `/v1/close`.
- **Phones need only the course id.** `GET /v1/course/<id>` gives the sealing key and the live state; `POST /v1/drop` leaves a sealed item (encrypted on the phone, the relay cannot read it).
- **Live state** (`/v1/state`): small named values CM sets (for example the open question). The class rules that use them are ported in later stages (`desktop/rules/`).

## Live attendance (laptop off)
- `src/attend.js`. CM (signed) calls `POST /v1/live/open` with the class list and a hash of each access code (the relay never holds a raw code), the session secret and the location mode; `POST /v1/live/events` and `/v1/live/ack` collect what happened; `POST /v1/live/close` stops the session and forgets the class list and secret.
- A phone calls `POST /v1/attend` with the course id, its Student ID, a device token, the QR token and its access code. The relay applies the same rules as `desktop/rules/attendance.js` (QR token every 30 s with one cycle of grace, access code, one mark per ID per day, one phone per ID per session, one phone per student for the term, location check) and answers at once. `test/attend.test.js` runs both on the same cases.
- Events (`ok`, `pending`, `flag`, `bind`) are kept until CM collects them, at most 14 days. While a class runs the relay can read Student IDs and device hashes; closing the session removes the class list.
- Quizzes on the relay are the next stage.

## Abuse controls (no human action)
Rate limits per network address and per day for new courses, a proof of work (18 bits, about a second for CM), caps on items, bytes and state per course, a ceiling on all courses, optional `BUILD_KEYS` (only listed builds may register), a kill switch (`REGISTRATION_OPEN="0"`), and forgetting: unpulled items after 14 days, unused courses after 60 days, old nonces and counters daily (`src/db.js`, the scheduled cleanup).

## Privacy
Items are sealed on the phone. Live state and the class list pushed for rules are readable by the relay while a class runs (see `RULES-AND-RELAY-PLAN.md`). A course is isolated by its key; `POST /v1/close` deletes everything for it.

## Files
- `worker.mjs` entry and routing; `src/http.js` replies; `src/registry.js` registration and the public course page; `src/auth.js` signatures; `src/limits.js` rate limits and proof of work; `src/mailbox.js` drop, pull, ack; `src/live.js` state and close; `src/db.js` tables, limits, cleanup; `src/crypto.js` hashing and verification.
- Tests: `test/relay.test.js` with `test/fake-d1.js` (D1 is SQLite, so the whole relay is tested without Cloudflare).
- Setup: `../deploy.mjs`, guided and one command. `node deploy.mjs --dry-run` shows the plan and changes nothing; `node deploy.mjs` creates the database `cm-relay-db` and the Worker `cm-relay` on the free workers.dev address; `node deploy.mjs --update` publishes new code. It reads your other Workers, databases and domains only to check for a clash, stops if a CM relay already exists, and never changes anything else. Token: Workers Scripts Edit, D1 Edit, Account Settings Read; read from `CLOUDFLARE_API_TOKEN` or typed, never saved. Tests: `test/deploy.test.js` (fake Cloudflare).

The older mailbox (`../worker.mjs`, KV and tokens) keeps working until CM moves to this relay.

## CM's side
`desktop/relay/hub.js` (register by itself, sign requests, collect, push state, close), `desktop/relay/address.js` (the address built into the installer: `desktop/relay/address.json`, written by the build from the repository variable `CM_RELAY_URL`; empty means no relay and CM uses the older mailbox if set up by hand). The phone side is `assets/outbox.js` (`/v1/drop` with only the course id). Tests: `desktop/test/relay-hub.test.js` runs CM against the real hub code with a fake D1.
