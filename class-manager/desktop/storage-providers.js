/* Storage providers: recognises which cloud service a synced folder belongs to, from its path.
   Google Drive, OneDrive, Dropbox, MEGA, iCloud Drive, Box, pCloud and similar services each install a desktop
   client that keeps one folder in step with the cloud. Class Manager only writes files into such a folder; the
   client does the upload. So no sign-in, key or developer registration is needed inside Class Manager.
   A folder that holds a git repository (GitHub or another host) is recognised too, so the app can say that the
   files are not sent anywhere until the lecturer commits them, and that the repository must be private.
   No Electron and no disk access except looking for .git, so it is tested with plain Node (test/linked-folder.test.js). */
"use strict";
const fs = require("fs");
const path = require("path");

// Order matters: the first match wins.
const PROVIDERS = [
  { id: "gdrive", name: "Google Drive", re: /google ?drive|googledrive-|\/my drive(\/|$)|\\my drive(\\|$)/i },
  { id: "onedrive", name: "OneDrive", re: /onedrive/i },
  { id: "dropbox", name: "Dropbox", re: /dropbox/i },
  { id: "mega", name: "MEGA", re: /[\\/]mega(sync)?([\\/]|$)|[\\/]mega ?drive([\\/]|$)/i },
  { id: "icloud", name: "iCloud Drive", re: /com~apple~clouddocs|icloud ?drive/i },
  { id: "box", name: "Box", re: /[\\/]box( sync)?([\\/]|$)/i },
  { id: "pcloud", name: "pCloud", re: /pcloud/i },
  { id: "nextcloud", name: "Nextcloud", re: /nextcloud/i },
  { id: "sync", name: "Sync.com", re: /[\\/]sync\.com([\\/]|$)|[\\/]sync( |$)/i }
];

// The service a folder seems to belong to: { id, name } or { id: "git", name: "Git repository" } or { id: "plain", name: "A folder" }.
function detect(folder) {
  const p = String(folder || "");
  for (const x of PROVIDERS) if (x.re.test(p)) return { id: x.id, name: x.name };
  let up = p;
  for (let i = 0; i < 6 && up; i++) { // the folder, or one of the few above it, is a git working copy
    try { if (fs.existsSync(path.join(up, ".git"))) return { id: "git", name: "Git repository" }; } catch (e) { /* no access */ }
    const next = path.dirname(up); if (next === up) break; up = next;
  }
  return { id: "plain", name: "A folder" };
}

// One sentence for the lecturer about what happens to the copies in this kind of folder.
function advice(provider) {
  if (provider.id === "git") return "This folder is a git repository. Copies are written here but are not sent anywhere until you commit and push them. Keep the repository private.";
  if (provider.id === "plain") return "This folder does not look like a cloud folder, so the copies stay on this computer unless something else syncs it.";
  return provider.name + " will upload the copies when its app is running and signed in on this computer.";
}

module.exports = { detect, advice, PROVIDERS };
