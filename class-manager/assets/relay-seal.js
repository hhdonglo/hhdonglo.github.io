/* The phone's side of the mailbox: encrypts a submission with the course's public key (see desktop/relay/crypto.js).
   Uses the browser's built-in WebCrypto; nothing is sent anywhere here. seal(publicKeyBase64, text) -> Promise of {k, iv, c}. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(globalThis.crypto);
  else root.CM_SEAL = factory(root.crypto);
})(typeof self !== "undefined" ? self : this, function (webcrypto) {
  "use strict";
  var enc = new TextEncoder();
  function b64(buf) { var s = "", b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(t) { var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function seal(publicKeyB64, text) {
    var subtle = webcrypto.subtle, iv = webcrypto.getRandomValues(new Uint8Array(12));
    return Promise.all([
      subtle.importKey("spki", unb64(publicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]),
      subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])
    ]).then(function (keys) {
      return Promise.all([subtle.encrypt({ name: "AES-GCM", iv: iv }, keys[1], enc.encode(text)), subtle.exportKey("raw", keys[1])]).then(function (r) {
        return subtle.encrypt({ name: "RSA-OAEP" }, keys[0], r[1]).then(function (wrapped) { return { k: b64(wrapped), iv: b64(iv), c: b64(r[0]) }; });
      });
    });
  }
  return { seal: seal };
});
