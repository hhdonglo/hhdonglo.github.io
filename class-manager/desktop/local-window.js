/* Is this window one of CM's own windows on this computer? Used before CM hands the signed-in password to a window (preload.js),
   so that the quiz and the other lecturer windows opened from CM need no Login of their own.
   A page in another browser, or on another device, is never a CM window: it has no preload and is not asked here. */
"use strict";

// url: the address the window shows. port: CM's server port. addresses: this computer's own network addresses.
function isThisComputerUrl(url, port, addresses) {
  let u; try { u = new URL(String(url)); } catch (e) { return false; }
  if (u.protocol !== "http:" || Number(u.port || 80) !== Number(port)) return false;
  const h = u.hostname.replace(/^\[|\]$/g, "");
  return h === "127.0.0.1" || h === "::1" || h === "localhost" || (addresses || []).indexOf(h) >= 0;
}
module.exports = { isThisComputerUrl };
