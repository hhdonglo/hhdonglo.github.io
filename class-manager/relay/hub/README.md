# CM relay (hub)

One hosted Cloudflare Worker, run by the CM owner, that lets students' phones take part when the lecturer's computer is off. Lecturers and students never create a Cloudflare account and never type a relay address: the address is built into CM.

## How it works
- **Registration is automatic.** The first time CM needs the relay it makes a course key (ECDSA P-256) and registers itself: `GET /v1/challenge`, solve the small proof of work, `POST /v1/register`. The course id is made from the public key, so nobody can claim another course. There is no invite code and no account.
- **CM's requests are signed** with the course key (`src/auth.js`): method, path, time, a never-repeated nonce and a hash of the body. Used for `/v1/pull`, `/v1/ack`, `/v1/state`, `/v1/close`.
- **Phones need only the course id.** `GET /v1/course/<id>` gives the sealing key and the live state; `POST /v1/drop` leaves a sealed item (encrypted on the phone, the relay cannot read it).
- **Live state** (`/v1/state`): small named values CM sets (for example the open question). The class rules that use them are ported in later stages (`desktop/rules/`).

## Abuse controls (no human action)
Rate limits per network address and per day for new courses, a proof of work (18 bits, about a second for CM), caps on items, bytes and state per course, a ceiling on all courses, optional `BUILD_KEYS` (only listed builds may register), a kill switch (`REGISTRATION_OPEN="0"`), and forgetting: unpulled items after 14 days, unused courses after 60 days, old nonces and counters daily (`src/db.js`, the scheduled cleanup).

## Privacy
Items are sealed on the phone. Live state and the class list pushed for rules are readable by the relay while a class runs (see `RULES-AND-RELAY-PLAN.md`). A course is isolated by its key; `POST /v1/close` deletes everything for it.

## Files
- `worker.mjs` entry and routing; `src/http.js` replies; `src/registry.js` registration and the public course page; `src/auth.js` signatures; `src/limits.js` rate limits and proof of work; `src/mailbox.js` drop, pull, ack; `src/live.js` state and close; `src/db.js` tables, limits, cleanup; `src/crypto.js` hashing and verification.
- Tests: `test/relay.test.js` with `test/fake-d1.js` (D1 is SQLite, so the whole relay is tested without Cloudflare).
- Setup: `deploy.mjs` (guided, one command; see the plan).

The older mailbox (`../worker.mjs`, KV and tokens) keeps working until CM moves to this relay.
