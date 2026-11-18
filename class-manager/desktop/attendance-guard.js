// Where attendance check-ins may come from, and whether the phone's location is checked.
// - Through the internet address (or while it is on): the location check is on, so a student far from the classroom is refused ("too far").
//   The radius is the one the lecturer chooses when starting the session (attendance page).
// - On the local network: phones cannot share their location on a plain http address, so the location check is off, and the check-in is accepted
//   only from an address on a private network (the same Wi-Fi, a hotspot), never from a public address that reached this computer some other way.
// Pure: no Electron, tested in test/guard.test.js.
"use strict";

// 10/8, 172.16/12, 192.168/16, link-local, loopback, and the IPv6 equivalents.
function isPrivateAddress(addr) {
  const a = String(addr || "").replace(/^::ffff:/, "").toLowerCase();
  if (a === "::1" || a === "127.0.0.1" || /^127\./.test(a)) return true;
  if (/^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = /^172\.(\d+)\./.exec(a);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/.test(a) || /^fe80:/.test(a);
}

// -> { geo: "enforce" | "off", refuse: null | { ok: false, why } }
function guardFor(where, settings) {
  const on = !settings || settings.geoInternet !== false;
  const geo = on && (where.remote || where.tunnelOn) ? "enforce" : "off";
  const refuse = where.action === "attend" && !where.remote && !isPrivateAddress(where.remoteAddress) ? { ok: false, why: "not on network" } : null;
  return { geo, refuse };
}

module.exports = { isPrivateAddress, guardFor };
