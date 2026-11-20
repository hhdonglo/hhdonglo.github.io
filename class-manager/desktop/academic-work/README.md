# Academic Work

Open **Academic Work** from the CM desktop sidebar. The command center shows planning counts for all active workspaces and enabled course measures where available. Choose **All workspaces** for the broad view. Use Ctrl/⌘+K for search and commands.

## Workspaces and records

Courses keep their existing identity, services, and sealed workbooks. Personal, research, supervision, committee, conference, talk, meeting, and reminder workspaces have a stable identifier and creation marker. Archive retires a workspace from search, the timeline, and notification delivery. Restore makes its records available again.

Workspace plans, discussions, links, tags, and file references live in the local profile's sealed `academic-work.cmv`. This is a separate platform store. Course workbook backups continue to cover course memory. Preserve the local CM profile and its vault access to recover platform records on this computer. Back up the linked original files separately. The sealed `academic-index.cmv` is rebuildable from authoritative records.

Cross-workspace search includes workspace metadata, academic plans, generic course events, and discussions explicitly shared with search, along with filenames of their available attachments. It never searches other courses' rosters. Course student lookup still uses the course that opened Academic Work. Files remain in the selected folders. CM can read PDFs in an isolated native reader and preview plain text, Markdown, and CSV as text. Folder moves or missing files can make a link unavailable. Cross-workspace links keep their original workspace identity and recheck approval when opened.

## Scheduling

Goals record progress from 0 to 100%. Tasks, meetings, events, and reminders can have a scheduled time. Optional reminders can be due at or before that time. The desktop app delivers notifications while it is open and signed in, and picks up missed reminders on the next launch. Reminders require desktop notification permission. Calendar export writes an iCalendar file for import into an external calendar. CM scheduling is local and requires no calendar account. Meeting launch opens Google Meet, Microsoft Teams, or Zoom through the system browser using a validated provider URL.

## Email setup

The Email view provides read-only access to the latest 20 inbox messages from one Gmail and one Outlook account. Message bodies are rendered as text and kept out of the academic index and local records. Tokens are sealed on the computer and connecting requires OS credential storage. Sign in and grant access in the system browser. Disconnect removes the local connection. You can revoke the application's grant in the provider's account settings.

- **Gmail.** Enable the Gmail API and create a Desktop app OAuth client. Enter that client's ID and secret in CM. Google classifies the requested read-only scope as restricted. The application registration and consent configuration must allow the account you use. [Desktop OAuth setup](https://developers.google.com/identity/protocols/oauth2/native-app) · [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- **Outlook.** Register a public client under Mobile and desktop applications. Use `http://localhost/oauth/callback` as the redirect and grant delegated Microsoft Graph `Mail.Read`. The registration must allow the account type you use. Enter the application client ID in CM. [Microsoft app registration](https://learn.microsoft.com/en-us/graph/auth-register-app-v2) · [Loopback redirect rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)

Automated coverage includes sealed persistence, workspace and course scope, source approval revocation, archive and restore, delivery deduplication, iCalendar output, mail adapter requests, and the OAuth loopback callback. Provider account authorization requires configured OAuth registrations and real account consent.
