/* Lecturer requests to the class sheet's script (Apps Script web app).
   Any request that carries a password or a session is sent by POST, so it never appears in a web address.
   When the password is accepted the script answers with a signed session that replaces it, in this page
   and in the browser tab's storage. Public reads without a password stay as before (script tag, JSONP).
   Pages call HostPost.call(scriptUrl, "action=...&hostkey=...", function (data, milliseconds) {...}, timeoutMs). */
(function () {
  "use strict";
  var swap = {};
  function remember(old, tok) { // from now on the session stands in for the password the lecturer typed
    swap[old] = tok;
    try {
      var st = window.sessionStorage;
      for (var i = 0; i < st.length; i++) { var k = st.key(i); if (st.getItem(k) === old) st.setItem(k, tok); }
    } catch (e) { /* storage off */ }
  }
  function get(url, params, cb, ms) { // public read: a script tag, answered as JSONP
    var n = "cb" + Date.now() + Math.floor(Math.random() * 1e6), sc = document.createElement("script"), done = false, t, t0 = Date.now();
    function end(d) { if (done) return; done = true; clearTimeout(t); delete window[n]; if (sc.parentNode) sc.parentNode.removeChild(sc); cb(d, Date.now() - t0); }
    window[n] = end; sc.onerror = function () { end(null); }; t = setTimeout(function () { end(null); }, ms || 9000);
    sc.src = url + "?" + params + "&callback=" + n + "&_=" + Date.now(); document.head.appendChild(sc);
  }
  function post(url, params, cb, ms) {
    var b = new URLSearchParams(params), t0 = Date.now(), done = false, timer;
    b.delete("callback");
    var typed = b.get("hostkey");
    if (typed && swap[typed]) b.set("hostkey", swap[typed]);
    function end(d) { if (done) return; done = true; clearTimeout(timer); cb(d, Date.now() - t0); }
    timer = setTimeout(function () { end(null); }, ms || 30000);
    fetch(url, { method: "POST", body: b, cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var d = null; try { d = JSON.parse(t); } catch (e) { d = null; }
        var tok = d && d._session; if (tok) delete d._session;
        end(d);
        if (tok && typed && typed !== tok) remember(typed, tok); // after the page has saved what was typed
      }, function () { end(null); });
  }
  window.HostPost = {
    call: function (url, params, cb, ms) {
      if (/(^|&)hostkey=/.test(params) || /(^|&)action=password_recover(&|$)/.test(params)) post(url, params, cb, ms);
      else get(url, params, cb, ms);
    }
  };
})();
