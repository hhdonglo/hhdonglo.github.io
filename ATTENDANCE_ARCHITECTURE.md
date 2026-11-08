# PHYS 143 attendance: architecture

Written from the code on `main` (host page `phys143-attendance.html`, student page `phys143-attend.html`, `apps_script/quiz_receiver.gs`, `QUIZ_SETUP.md`). Not tested on real phones or the live sheet.

## 1. Purpose and design choice
Record who is physically in class, with no server of our own: static pages on GitHub Pages plus one Google Apps Script web app bound to a Google Sheet. The lecturer's phone or laptop runs the host page; students use the student page. The sheet is the only database.

## 2. Components
| Part | What it is | Who uses it |
|---|---|---|
| `phys143-lecturer.html` | Lecturer menu, key login, link to **Take attendance** | Lecturer |
| `phys143-attendance.html` | Host page: asks for the classroom location, shows the changing QR, live count, close button | Lecturer (projected in class, never put on slides) |
| `phys143-attend.html` | Student page: Student ID, Present button, privacy notice | Students (opened by scanning the QR) |
| `assets/qrcode.js` | Vendored MIT QR generator, draws the QR in the lecturer's browser | Host page |
| `apps_script/quiz_receiver.gs` | Web app (`doGet`) and all logic | Both pages |
| Google Sheet "PHYS 143 Quizzes (Responses)" | Storage (private tabs below) | Lecturer only |

All calls are JSONP `GET` requests to the script URL (`?action=...&callback=...`), because the pages are on a different origin and the script returns JSONP.

## 3. Endpoints (`doGet`, attendance part)
| `action` | Caller | Needs host key | What it does |
|---|---|---|---|
| `hostcheck` | Lecturer menu | key checked | Is this key right? |
| `attend_open` | Host page | yes | Opens a session: new label `dd/MM/yyyy #n`, random secret, classroom position and radius; refuses without a position unless `nogeo=1` |
| `attend_status` | Host page (polled every ~4 s, and at each QR change) | yes | Counts, current QR token, seconds left |
| `attend_close` | Host page | yes | Writes 1 or 0 for every rostered student into `Attendance`, copies IDs not on the roster into `Not_On_List`, flags devices with more than one ID |
| `attend` | Student page | no (the QR token is the credential) | The check-in, section 5 |

The host key is checked by `hostOk_`: stored as `sha256:salt:hex` in the Key tab, and 30 wrong keys lock host actions for 10 minutes.

## 4. Sheet tabs (all private)
- **Roster**: Student ID and optional name (private; names never returned to any page; filled by `attendance_tools/roster_sync.sh` on the lecturer's Mac, never in git).
- **Attendance_Control**: one row per session. A Code (internal id), B Label, C Status, D Opened, E Closed, F Secret (makes the QR token), G Lat, H Lon, I Radius m.
- **Attendance_Log**: one row per accepted check-in: Timestamp, Session, Student ID, On roster, Device (salted hash), Location (`ok 40 m`, `far 1200 m`, `no location`).
- **Attendance_Flags**: every refused or suspicious attempt: Timestamp, Session, Student ID, Device hash prefix, Reason. Never counts as presence.
- **Attendance**: the result. Student ID in column A, one column per session date, 1 or 0 (Sakai import format).
- **Not_On_List**: IDs that checked in but are not on the roster (red rows).

## 5. The check-in, step by step (`attCheckIn_`)
1. The student scans the projector QR. It opens `phys143-attend.html?t=<8 hex>`. The page gets a random device token from `localStorage` (created once) and asks the browser for the phone's location.
2. The student enters the ID. The page sends `id`, `dev`, `t`, and `lat`, `lon` (rounded to 4 decimals, about 11 m) and `acc`.
3. The script, in order:
   1. finds the open session (cached 5 s); none: `closed`;
   2. ID must be 4 to 12 digits: else `bad id`;
   3. device token at least 16 characters: else `update page`; it is then replaced by a salted hash;
   4. more than 6 failures for this phone or this ID in 10 minutes: `slow down`;
   5. the QR token must match this 30 s slot or one of the two before: else `old link` (counts as a failure);
   6. location (section 7): `too far` or `no location` in enforce mode;
   7. one mark per ID per day (across sessions): repeat returns "already marked", adds nothing;
   8. one Student ID per device per session: a second ID from the same phone is refused (`device used`) and flagged;
   9. appends the row to `Attendance_Log`.
4. The reply tells the student only whether their own ID is on the roster.

## 6. The changing QR
Every `ATT_SLOT_SEC` (30 s) the token is `HMAC-SHA256(secret, "qr:" + slot)`, first 4 bytes as 8 hex characters. `attend_status` returns the current token; the host page redraws the QR when it changes. The check-in accepts the current token and `ATT_LINK_GRACE_SLOTS` (2) before it, so a scan stays valid 60 to 90 s. No code is typed. The secret never leaves the script and the sheet.

## 7. The location check (`attGeo_`)
At start the host browser supplies the classroom position; it is stored in Attendance_Control (G to I) with the radius chosen in the menu (250 m, 500 m default, 1 km, 2 km; the script accepts 50 m to 5 km). For each check-in the script computes the haversine distance, subtracts the phone's reported accuracy (capped at `ATT_GEO_ACC_CAP` = 150 m) and compares with the radius. `ATT_GEO_MODE`: `enforce` (default, refuses), `flag` (accepts, logs and flags), `off`. Only the distance and an ok/far/none word are stored, never the student's coordinates.

## 8. Trust boundaries
- **Trusted:** the sheet and script (Google account of the lecturer); the host key.
- **Untrusted:** everything from students' phones: ID, device token, token, location, accuracy. Location and device token are client-supplied and can be faked.
- **Public:** the site (static, no IDs or secrets in the repo), the script URL, the QR image on screen.
- **Secrets:** host key (hashed in the Key tab; sent in the URL of host calls), session secret (Attendance_Control F), hash salt (script properties).

## 9. Data protection measures (Ghana Data Protection Act, 2012)
- Minimisation: ID, time, a distance result and a hashed phone code. Names only in the private Roster (never returned), no student coordinates.
- Phone code: stored only as a salted HMAC (16 hex); the salt is in script properties and is deleted at semester end, which makes old codes unlinkable.
- Student coordinates are rounded to about 11 m before leaving the phone and are never written anywhere by the script.
- IDs are never shown on any public page; the host page shows counts only; the roster is not in git.
- Privacy notice on the student page (purpose, what is kept, who sees it, how long, contact).
- Retention: run `attPurgeSemester` from the editor at semester end: empties the Device column, deletes all Flags rows, clears secrets and classroom positions, deletes the salt. Attendance marks stay as the course record.
- Residual: Student IDs and rounded coordinates travel in the URL of a `GET` to Google Apps Script, so they can appear in Google's request logs; the host key travels the same way. A change to `POST` would reduce this but is a larger change.

## 10. Failure modes and what the user sees
| Situation | Student sees | Lecturer action |
|---|---|---|
| Scanned a stale QR (over ~90 s) | "This link has expired. Scan the QR code again." | None |
| Opened the page without scanning | "Scan the QR code on the screen" | None |
| Outside the radius | "too far from the classroom" | Increase radius if wrong |
| Location blocked (often in an app's built-in browser) | "needs your location ... open in Chrome or Safari" | Mark by hand if needed |
| Second ID on one phone | "already checked in another student, see your lecturer" | See Attendance_Flags |
| Old cached page after a deploy | "reload this page" | Hard refresh |
| Script not redeployed after a site change | Blank QR or checks refused | Paste, Save, Deploy > New version |
| Host phone cannot give a location | Prompt "Start WITHOUT the location check?" | Cancel and allow location, or accept |
| Heavy load | Slow responses (script caches roster 5 min and session 5 s; log append is lock-free) | Wait |

## 11. Deployment
1. Paste `apps_script/quiz_receiver.gs`, Save. Never press Run on `doGet` (it fetches the site list and spins).
2. Deploy > Manage deployments > edit > New version.
3. Merge the site change, wait for the Pages build (about 7 to 8 minutes), hard-refresh the host page.
4. Test as in `QUIZ_SETUP.md`.

## 12. Settings (top of the attendance blocks in the script)
`ATT_SLOT_SEC` 30, `ATT_LINK_GRACE_SLOTS` 2, `ATT_DEVICE_IDS` 1, `ATT_MAX_FAILS` 6, `ATT_GEO_MODE` 'enforce', `ATT_GEO_RADIUS_M` 500, `ATT_GEO_ACC_CAP` 150.

## 13. What it cannot stop
A classmate in or near the room sending a freshly scanned link or a photo of the screen within about 90 s; a phone with a faked location; someone in the corridor inside the radius; a private window giving a fresh device token. These are reduced, not removed: refused or odd attempts appear in Attendance_Flags and a head count against the "N present" figure is a cheap spot-check.
