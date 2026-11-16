# rules/ — the course rules as plain JavaScript

One file per area, each doing what one part of `apps_script/` does today, over a small store interface (`store.js`), so the same rule can later run on SQL, in CM, or in a hosted relay.
Stage 1 (this folder) only adds the modules and the tests that prove they give the same answers as the Apps Script; nothing in CM calls them yet.

| Module | Replaces (apps_script/src) | Status |
| --- | --- | --- |
| `access-codes.js` | `accessCodes_`, `codesMap_`, `codeExpired_`, `newAccessCode_` | ported, parity tested |
| `attendance.js` | `20-attendance.gs`: open, close, check-in (QR token, device, phone, location, one mark a day), submit, discard | ported, parity tested (`attendance-parity.test.js`); review, remove, approve, phone reset, status still in the script |

Store interface (`store.js`): `rows(tab)` (header first, or null), `setRows(tab, rows)`, `prop(key)`, `setProp(key, value)`, `now()`.
Rule of the port: same input, same output as the script (`test/rules-parity.test.js` runs both on the same workbook). Do not change behaviour in a port; change it afterwards, with its own test.
