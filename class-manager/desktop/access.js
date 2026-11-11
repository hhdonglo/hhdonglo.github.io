/* Who may use the lecturer pages of the desktop server, and the app settings that decide it.
   - Through the internet address (the tunnel): never, unless the lecturer turns it on ("lecturerOnline").
   - From the local network: allowed by default; "lecturerFrom: computer" limits it to this computer.
   A request carries lecturer credentials when it has the hostkey field (the host key or a lecturer session).
   Students' requests are not affected. */
"use strict";

const SECURITY_DEFAULTS = { tunnelHours: 3, lecturerFrom: "network", lecturerOnline: false, geoInternet: true };

function cleanSecurity(s, cur) {
  s = s || {}; cur = Object.assign({}, SECURITY_DEFAULTS, cur || {});
  const h = s.tunnelHours == null ? cur.tunnelHours : Number(s.tunnelHours);
  return {
    tunnelHours: [0, 1, 2, 3, 4, 6, 8, 12].includes(h) ? h : SECURITY_DEFAULTS.tunnelHours, // 0: stays on until stopped
    lecturerFrom: (s.lecturerFrom == null ? cur.lecturerFrom : s.lecturerFrom) === "computer" ? "computer" : "network",
    lecturerOnline: s.lecturerOnline == null ? !!cur.lecturerOnline : s.lecturerOnline === true,
    geoInternet: s.geoInternet == null ? cur.geoInternet !== false : s.geoInternet === true // check students' location when they check in through the internet address
  };
}

// null when the request may go on; otherwise the answer to send instead.
function lecturerRefusal(params, where, settings) {
  if (!params || !params.hostkey) return null;
  const s = cleanSecurity({}, settings);
  if (where.remote && !s.lecturerOnline) return { ok: false, why: "host key not accepted", detail: "Lecturer pages are not available through the internet address. Open them on this computer or on the local network, or allow them in App Settings." };
  if (!where.remote && !where.thisComputer && s.lecturerFrom === "computer") return { ok: false, why: "host key not accepted", detail: "Lecturer pages are available on this computer only. Change this in App Settings." };
  return null;
}

module.exports = { SECURITY_DEFAULTS, cleanSecurity, lecturerRefusal };
