# Test the mailbox on a real Cloudflare Worker (staging)

For Hope. This checks the real thing, not a copy. It needs your free Cloudflare account, so Claude cannot do it for you. It takes about fifteen minutes and a staging Worker can be deleted afterwards without touching a real course.

## 1. Make a separate staging Worker

Follow steps 1 to 7 of README.md in this folder, with these differences:
- name the Worker `cm-mailbox-staging` and the KV namespace `cm-box-staging`;
- choose throwaway codes: `DROP_TOKEN` (12 or more letters and digits) and `PULL_TOKEN` (24 or more, different);
- stop after step 7 (do not paste anything into CM yet).

## 2. Run the check from your computer

In a terminal, in the `class-manager` folder (Node 22 or newer):

```
node relay/staging-check.mjs https://cm-mailbox-staging.<your-name>.workers.dev <DROP_TOKEN> <PULL_TOKEN>
```

It uses a throwaway course name and key pair. Expected output: nine lines starting with `PASS` and then `All checks passed: this Worker works end to end.` If any line says `FAIL`, copy the whole output to Claude.

## 3. Then try it with CM and a phone

1. In CM (a build from 0.22.1 or later), open **Mailbox**, paste the staging address and the two codes, **Save**.
2. On a phone, open the student page, turn the phone to airplane mode, answer one practice question, then turn airplane mode off. The page should say the result was saved and then sent.
3. In CM press **Collect now**. The practice attempt should appear in the course. Press it again: nothing new (each result is recorded once).
4. With CM closed, answer another practice question on the phone, open CM, press **Collect now**. It should arrive.

## 4. Clean up

Delete the `cm-mailbox-staging` Worker and the `cm-box-staging` namespace, or keep them for the next test. For real use, make a separate Worker with real codes (README.md).
