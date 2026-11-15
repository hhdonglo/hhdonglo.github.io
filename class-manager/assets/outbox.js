/* The phone's outbox: nothing a student sends is lost because CM, the Wi-Fi or the internet was away for a moment.
   Every submission is first saved on the phone with a unique key (ckey), then sent; it stays saved and is tried again
   (after 5 s, then slower, and whenever the phone is back online) until CM accepts it. CM remembers the key, so a repeat is never counted twice.
   If CM cannot be reached and the course has a mailbox (CM.relay), the submission is sealed on the phone and left there for CM to collect.
   States shown to the student: "saved" (on the phone, will send), "received" (CM accepted it), "held" (in the mailbox, CM will collect it).
   Live check-in and live quiz answers do not use this: they need the room's CM and give an immediate answer. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else {
    var mem = {}; // phones with storage switched off still get the retries while the page stays open
    var st = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); } };
    try { var t = root.localStorage; t.setItem("cm.outbox.test", "1"); t.removeItem("cm.outbox.test"); st = t; } catch (e) { /* use memory */ }
    root.CM_OUTBOX = factory({ storage: st, fetch: root.fetch.bind(root), get config() { return root.CM || {}; }, get seal() { return root.CM_SEAL && root.CM_SEAL.seal; }, addEventListener: root.addEventListener.bind(root) }, true);
  }
})(typeof self !== "undefined" ? self : this, function createOutbox(env, auto) {
  "use strict";
  var KEY = "cm.outbox.v1", MAX_ITEMS = 200, RELAY_KINDS = { attempt: 1, report: 1 };
  var storage = env.storage, doFetch = env.fetch, setT = env.setTimeout || setTimeout, now = env.now || Date.now;
  var cfg = function () { return env.config || {}; };
  var timer = null, inflight = null, listeners = [];

  function read() { try { var v = JSON.parse(storage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function write(items) { try { storage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS))); return true; } catch (e) { return false; } }
  function emit(item, state) { listeners.forEach(function (f) { try { f(item, state); } catch (e) { /* a listener must not stop the outbox */ } }); }
  function newKey() { var r = ""; for (var i = 0; i < 4; i++) r += Math.floor(Math.random() * 1e9).toString(36); return now().toString(36) + "." + r; }

  function body(item) { var b = new URLSearchParams(); b.append("kind", item.kind); Object.keys(item.fields).forEach(function (k) { b.append(k, item.fields[k]); }); b.append("ckey", item.ckey); return b; }

  // true: accepted by CM (or sent to the Google address, which does not answer). false: could not be reached.
  function toClass(item) {
    var url = cfg().scriptUrl; if (!url) return Promise.resolve(false);
    return doFetch(url, { method: "POST", body: body(item), cache: "no-store", credentials: "omit" })
      .then(function (r) { return r.ok ? r.text().then(function (t) { try { var d = JSON.parse(t); return !(d && d.ok === false && d.retry); } catch (e) { return true; } }) : false; },
        function () { // a Google address cannot be read from a page; send without reading the answer
          return doFetch(url, { method: "POST", mode: "no-cors", body: body(item), credentials: "omit" }).then(function () { return /script\.google\.com/.test(url); }, function () { return false; });
        });
  }
  function toRelay(item) {
    var r = cfg().relay; if (!r || !r.url || !r.key || !RELAY_KINDS[item.kind] || !env.seal) return Promise.resolve(false);
    var payload = JSON.stringify({ ckey: item.ckey, params: Object.assign({ kind: item.kind }, item.fields) });
    return env.seal(r.key, payload).then(function (sealed) {
      return doFetch(r.url.replace(/\/$/, "") + "/put", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course: r.course, drop: r.drop, sealed: sealed }) })
        .then(function (x) { return x.ok; }, function () { return false; });
    }).catch(function () { return false; });
  }

  function step(item) {
    return toClass(item).then(function (ok) {
      if (ok) return "received";
      item.tries = (item.tries || 0) + 1;
      if (item.tries < 2) return null; // CM may only be busy: try again before using the mailbox
      return toRelay(item).then(function (held) { return held ? "held" : null; });
    });
  }
  function flush() {
    if (inflight) return inflight;
    var items = read(), left = [], chain = Promise.resolve();
    items.forEach(function (item) {
      chain = chain.then(function () { return step(item); }).then(function (state) {
        if (state) emit(item, state); else { left.push(item); emit(item, "saved"); }
      });
    });
    inflight = chain.then(function () { write(left); inflight = null; if (left.length) schedule(left); }, function () { inflight = null; });
    return inflight;
  }
  function schedule(items) {
    if (timer) return;
    var tries = Math.max.apply(null, items.map(function (i) { return i.tries || 0; }).concat([0]));
    var wait = Math.min(300000, 5000 * Math.pow(3, Math.min(tries, 4)));
    timer = setT(function () { timer = null; flush(); }, wait);
  }

  function send(kind, fields, done) {
    var item = { ckey: newKey(), kind: kind, fields: fields, created: now(), tries: 0 };
    var items = read(); items.push(item);
    var kept = write(items); // false when the phone's storage is off: then it is sent once, as before
    if (done) listeners.push(function (it, state) { if (it.ckey === item.ckey) done(state); });
    if (!kept) { toClass(item).then(function (ok) { emit(item, ok ? "received" : "lost"); }); return item.ckey; }
    emit(item, "saved");
    flush();
    return item.ckey;
  }

  var api = { send: send, flush: flush, pending: function () { return read().length; }, onState: function (f) { listeners.push(f); } };
  if (auto && env.addEventListener) { env.addEventListener("online", function () { flush(); }); setT(function () { flush(); }, 1500); }
  return api;
});
