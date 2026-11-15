# CM mailbox (optional)

A very small free service that holds practice results from students' phones, encrypted, while CM is off or out of reach. CM collects them when it is next open. Without it, phones keep each result and send it as soon as CM can be reached, so the mailbox only helps when students work while the lecturer's computer is off.

It cannot read what it holds (phones encrypt with CM's public key), has no names, and forgets everything after 14 days. Check-in and live quizzes do not use it.

## What you set up (about ten minutes, no card needed)

1. Create a free account at cloudflare.com (Workers and Pages are on the free plan).
2. In the Cloudflare dashboard: **Workers and Pages**, **Create**, **Create Worker**, name it `cm-mailbox`, **Deploy**.
3. Open the Worker, **Edit code**, delete what is there, paste the whole of `relay/worker.mjs` from this folder, **Deploy**.
4. In the dashboard: **Storage and Databases**, **KV**, **Create a namespace** named `cm-box`.
5. Open the Worker, **Settings**, **Bindings**, **Add**, **KV namespace**: variable name `BOX`, namespace `cm-box`. Save.
6. Same page, **Variables and Secrets**, add two **Secrets**: `DROP_TOKEN` (any 12 or more letters and digits; students' phones carry it) and `PULL_TOKEN` (a different, long random text, 24 or more characters; keep it private). Deploy.
7. Copy the Worker's address (ends in `workers.dev`). Check that `https://<address>/health` shows `{"ok":true}`.
8. In CM, open **Mailbox**, paste the address, the student code and the lecturer code, **Save**, then **Collect now**.

To stop using it: **Switch off** in CM (the Worker can then be deleted). Nothing else depends on it.

## Files

- `worker.mjs`: the Worker (`/put` for phones, `/pull` and `/ack` for CM, `/health`).
- Phone side: `assets/outbox.js` (queue and retries), `assets/relay-seal.js` (encryption).
- CM side: `desktop/relay/client.js` (collect, open, record once), `desktop/relay/crypto.js` (keys).
- Tests: `desktop/test/mailbox.test.js`.

Limits: 16 KB per item, 1000 waiting items per course, only practice results and question reports are accepted.
