# Linked folder (module README)

**Purpose.** Keep an encrypted copy of one course's records in a folder that a cloud sync app (Google Drive, OneDrive, Dropbox, MEGA, iCloud Drive, Box, pCloud, Nextcloud) or a private git repository carries off the computer. Off until the lecturer links a folder.

**Files**

| File | Responsibility |
| --- | --- |
| `linked-folder.js` | Link, copy now, automatic copy, list, open (restore) and unlink. Settings in the course's data folder (`linked-folder.json`, and `linked-folder.key` for a remembered passphrase). No Electron. |
| `storage-providers.js` | Names the service from the folder path, and gives one sentence of advice. The list of services is the `PROVIDERS` array: add a line to support another. |
| `app/linked-folder.js` | The "Link storage" card in App Settings. |
| `main.js` (section "linked folder") | Folder dialog and the `cm:linked*` calls; copies run after each automatic backup. |
| `test/linked-folder.test.js` | Tests, run with `npm test`. |

**Rules to keep**

- Only encrypted files are written into the linked folder. Never write the workbook, class list or exports there in readable form.
- A passphrase has at least 10 characters. It is stored only encrypted by the system keychain, and never when no keychain exists.
- Every copy is read back with the passphrase before it counts.
- Copies are written under a temporary name and renamed, so a sync app never uploads a half-written file.
- The newest 14 copies are kept; older ones are removed from the linked folder only.
- Linking and unlinking never delete anything already in the folder.

**To change**

- A new service: add it to `PROVIDERS` in `storage-providers.js` and a case to `test/linked-folder.test.js`.
- How many copies are kept: `KEEP` in `linked-folder.js`.
- The wording on screen: `app/home.html` (card `lf`) and `app/linked-folder.js`.
