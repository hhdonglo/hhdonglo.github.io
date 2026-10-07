/* PHYS 143 mock examination. Plain JavaScript, no libraries. Mounts into #quiz-app on mock-exam.html.
   Questions come only from the past-examination questions already in quizzes/lectureN.json (those whose "source" begins "Past exam").
   Format: 50 questions, 2 hours 30 minutes, no answers shown until submission. Progress is stored only in this browser. */
(function () {
  'use strict';

  var LECTURES = {
    1: 'Vectors', 2: 'Motion', 3: 'Newton’s laws', 4: 'Work and kinetic energy',
    5: 'Potential energy and energy conservation', 7: 'Impulse and momentum', 8: 'Rotation',
    9: 'Temperature and heat', 10: 'Thermal properties of matter',
    11: 'First law of thermodynamics', 12: 'Second law of thermodynamics'
  };
  var ORDER = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
  var EXAM_SIZE = 50;
  var EXAM_MS = 150 * 60 * 1000;
  var STORE_KEY = 'phys143.mock.v1';
  var LETTERS = ['A', 'B', 'C', 'D', 'E'];

  /* Same Google Form as the practice pages (see assets/practice.js). */
  var REPORT_FORM = {
    FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSeks0aQI_OLforxFg-5oOxyVQw5mdNA0dbtPQqUmHAPNz_mkg/viewform',
    ENTRY: { lecture: 'entry.639134261', id: 'entry.917742440', question: 'entry.1866410730', answer: 'entry.1771614469' }
  };

  var app = document.getElementById('quiz-app');
  if (!app) return;

  /* ---------- storage (every access guarded) ---------- */
  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var s = raw ? JSON.parse(raw) : null;
      if (s && typeof s === 'object') return s;
    } catch (e) { /* storage unavailable */ }
    return {};
  }
  var store = loadStore();
  function saveStore() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(label, cls, fn) {
    var b = el('button', { type: 'button', 'class': 'btn ' + (cls || '') }, label);
    b.addEventListener('click', fn);
    return b;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent; }
  function clip(t, n) { t = plain(String(t == null ? '' : t)).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function clear() { app.innerHTML = ''; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + ':' + pad(m) + ':' + pad(s % 60);
  }
  function words(ms) {
    var m = Math.round(ms / 60000), h = Math.floor(m / 60);
    return (h ? h + ' h ' : '') + (m % 60) + ' min';
  }
  function focusHeading() { var h = app.querySelector('[data-focus]'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }

  /* ---------- the pool: past-examination questions only ---------- */
  var pool = null; /* { byId: {id: {q, n}}, byLecture: {n: [ids]} } */
  function loadPool(done, fail) {
    var left = ORDER.length, failed = false, byId = {}, byLecture = {};
    ORDER.forEach(function (n) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'quizzes/lecture' + n + '.json');
      xhr.onload = function () {
        if (failed) return;
        try {
          var d = JSON.parse(xhr.responseText);
          byLecture[n] = [];
          d.questions.forEach(function (q) {
            if (/^Past exam/.test(q.source || '')) { byId[q.id] = { q: q, n: n }; byLecture[n].push(q.id); }
          });
        } catch (e) { failed = true; fail(); return; }
        if (--left === 0) { pool = { byId: byId, byLecture: byLecture }; done(); }
      };
      xhr.onerror = function () { if (!failed) { failed = true; fail(); } };
      xhr.send();
    });
  }

  /* Allocation across lectures: one question from every lecture that has one, the rest in proportion to the number of past questions each lecture has (largest remainders). */
  function allocate(counts, size) {
    var keys = Object.keys(counts).filter(function (k) { return counts[k] > 0; });
    var total = keys.reduce(function (s, k) { return s + counts[k]; }, 0);
    if (total <= size) { var all = {}; keys.forEach(function (k) { all[k] = counts[k]; }); return all; }
    var alloc = {}, rest = size - keys.length;
    keys.forEach(function (k) { alloc[k] = 1; });
    var shares = keys.map(function (k) { var x = rest * (counts[k] - 1) / (total - keys.length); return { k: k, whole: Math.floor(x), frac: x - Math.floor(x) }; });
    var used = 0;
    shares.forEach(function (s) { alloc[s.k] += s.whole; used += s.whole; });
    shares.sort(function (a, b) { return b.frac - a.frac; });
    for (var i = 0; used < rest && i < shares.length; i++) { if (alloc[shares[i].k] < counts[shares[i].k]) { alloc[shares[i].k]++; used++; } }
    return alloc;
  }
  function draw() {
    var counts = {};
    ORDER.forEach(function (n) { counts[n] = pool.byLecture[n].length; });
    var alloc = allocate(counts, EXAM_SIZE), ids = [];
    Object.keys(alloc).forEach(function (k) { ids = ids.concat(shuffle(pool.byLecture[k]).slice(0, alloc[k])); });
    return shuffle(ids);
  }
  function poolSize() { return ORDER.reduce(function (s, n) { return s + pool.byLecture[n].length; }, 0); }

  /* ---------- reports ---------- */
  function reportUrl(item, sel) {
    var q = item.q, E = REPORT_FORM.ENTRY;
    var shown = clip(q.options[q.answer], 200) + (sel != null && sel !== q.answer ? ' (my answer: ' + clip(q.options[sel], 200) + ')' : '');
    return REPORT_FORM.FORM_URL + '?' + ['usp=pp_url',
      E.lecture + '=' + encodeURIComponent('Lecture ' + item.n + ': ' + LECTURES[item.n] + ' (mock exam)'),
      E.id + '=' + encodeURIComponent(q.id),
      E.question + '=' + encodeURIComponent(clip(q.q, 500)),
      E.answer + '=' + encodeURIComponent(shown)].join('&');
  }

  /* ---------- timer ---------- */
  var tick = null, keyHandler = null;
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } keyHandler = null; }
  document.addEventListener('keydown', function (ev) { if (keyHandler && app.contains(document.activeElement)) keyHandler(ev); });

  /* ---------- introduction ---------- */
  function intro() {
    stopTick();
    clear();
    var size = Math.min(EXAM_SIZE, poolSize());
    app.appendChild(el('h3', { 'data-focus': '' }, 'Before you begin'));
    var ul = el('ul', { 'class': 'mock-rules' });
    [
      size + ' multiple-choice questions, drawn at random from past PHYS 143 examination questions across Lectures 1 to 12 (Lecture 6 has none), in mixed order.',
      'Time allowed: 2 hours 30 minutes. The timer is always on screen and cannot be paused. The paper is submitted automatically when it reaches zero.',
      'No answers or feedback are shown until you submit. You may change an answer and move between questions at any time before then.',
      'For practice, not assessment. Progress and best scores are stored only in this browser.'
    ].forEach(function (t) { ul.appendChild(el('li', null, t)); });
    app.appendChild(ul);
    if (size < EXAM_SIZE) app.appendChild(el('p', { 'class': 'note quiz-note' }, 'Only ' + size + ' past-examination questions are available, so this paper has ' + size + ' questions.'));
    var run = store.run;
    var row = el('div', { 'class': 'row' });
    if (run && run.ids && run.start) {
      var left = run.start + EXAM_MS - Date.now();
      if (left <= 0) { submit(run, 'time'); return; }
      app.appendChild(el('p', null, '<strong>An attempt is in progress.</strong> Time remaining: ' + words(left) + '.'));
      row.appendChild(btn('Resume the exam', 'primary', function () { exam(store.run); }));
    } else {
      row.appendChild(btn('Start the exam', 'primary', start));
    }
    app.appendChild(row);
    if (store.best) app.appendChild(el('p', { 'class': 'muted' }, 'Best score on this device: ' + store.best.score + ' out of ' + store.best.total + ' (' + (store.attempts || 1) + ' attempt' + ((store.attempts || 1) === 1 ? '' : 's') + ').'));
    focusHeading();
  }

  function start() {
    var ids = draw(), perm = {};
    ids.forEach(function (id) {
      var opts = pool.byId[id].q.options, order = [];
      for (var i = 0; i < opts.length; i++) order.push(i);
      order = shuffle(order);
      /* an option such as "all of the above" always stays last */
      var tail = order.filter(function (o) { return /\b(all|none|both|neither) of the above\b/i.test(plain(opts[o])); });
      perm[id] = order.filter(function (o) { return tail.indexOf(o) === -1; }).concat(tail);
    });
    store.run = { ids: ids, perm: perm, answers: {}, idx: 0, start: Date.now() };
    saveStore();
    exam(store.run);
  }

  /* ---------- the examination ---------- */
  function exam(run) {
    stopTick();
    clear();
    document.title = 'Mock exam | PHYS 143 | Hope Donglo';
    var total = run.ids.length;
    var bar = el('div', { 'class': 'mock-bar' });
    var timer = el('span', { 'class': 'mock-timer', role: 'timer', 'aria-label': 'Time remaining' });
    var count = el('span', { 'class': 'mock-count' });
    bar.appendChild(el('span', { 'class': 'mock-lbl' }, 'Time remaining'));
    bar.appendChild(timer);
    bar.appendChild(count);
    bar.appendChild(btn('Submit', 'primary mock-submit', askSubmit));
    app.appendChild(bar);
    var live = el('p', { 'class': 'vh', role: 'status', 'aria-live': 'polite' });
    app.appendChild(live);
    var body = el('div', { 'class': 'mock-body' });
    app.appendChild(body);
    var gridWrap = el('div', { 'class': 'mock-grid-wrap' });
    app.appendChild(gridWrap);
    var warned = {};

    function answered() { return Object.keys(run.answers).length; }
    function refresh() {
      var left = run.start + EXAM_MS - Date.now();
      timer.textContent = clock(left);
      timer.classList.toggle('low', left <= 10 * 60 * 1000);
      [30, 10, 5, 1].forEach(function (m) {
        if (left <= m * 60000 && left > 0 && !warned[m] && left > (m * 60000 - 2000)) { warned[m] = true; live.textContent = m + ' minute' + (m === 1 ? '' : 's') + ' remaining.'; }
      });
      count.textContent = answered() + ' of ' + total + ' answered';
      if (left <= 0) { stopTick(); submit(run, 'time'); }
    }

    function askSubmit() {
      var open = total - answered();
      var box = gridWrap.querySelector('.mock-confirm');
      if (box) { box.querySelector('button').focus(); return; }
      box = el('div', { 'class': 'mock-confirm', role: 'alertdialog', 'aria-label': 'Submit the exam' });
      box.appendChild(el('p', null, '<strong>Submit now?</strong> ' + (open ? open + ' question' + (open === 1 ? ' is' : 's are') + ' unanswered. ' : 'All questions are answered. ') + 'You cannot return to the exam after submitting.'));
      var r = el('div', { 'class': 'row' });
      var yes = btn('Submit the exam', 'primary', function () { stopTick(); submit(run, 'manual'); });
      r.appendChild(yes);
      r.appendChild(btn('Keep working', '', function () { box.parentNode.removeChild(box); }));
      box.appendChild(r);
      gridWrap.insertBefore(box, gridWrap.firstChild);
      yes.focus();
    }

    function drawGrid() {
      var g = gridWrap.querySelector('.mock-grid');
      if (!g) { g = el('div', { 'class': 'mock-grid', role: 'group', 'aria-label': 'Go to question' }); gridWrap.appendChild(g); }
      g.innerHTML = '';
      run.ids.forEach(function (id, i) {
        var b = el('button', { type: 'button', 'class': 'mock-cell' + (run.answers[id] != null ? ' done' : '') + (i === run.idx ? ' cur' : ''), 'aria-label': 'Question ' + (i + 1) + (run.answers[id] != null ? ', answered' : ', not answered') + (i === run.idx ? ', current' : '') }, String(i + 1));
        b.addEventListener('click', function () { run.idx = i; saveStore(); show(); });
        g.appendChild(b);
      });
    }

    function show() {
      var id = run.ids[run.idx], item = pool.byId[id], q = item.q, perm = run.perm[id];
      body.innerHTML = '';
      body.appendChild(el('p', { 'class': 'qtype' }, 'Question ' + (run.idx + 1) + ' of ' + total));
      var qt = el('h3', { 'class': 'qtext', 'data-focus': '' }, q.q);
      qt.style.color = 'inherit'; qt.style.fontSize = '1.1rem';
      body.appendChild(qt);
      var ul = el('ul', { 'class': 'opts', 'aria-label': 'Answer options' });
      perm.forEach(function (orig, pos) {
        var li = el('li');
        var chosen = run.answers[id] === orig;
        var b = el('button', { type: 'button', 'class': 'opt' + (chosen ? ' sel' : ''), 'aria-pressed': chosen ? 'true' : 'false', 'data-orig': String(orig) },
          '<span class="k" aria-hidden="true">' + LETTERS[pos] + '</span><span class="txt"><span class="vh">Option ' + LETTERS[pos] + ': </span>' + q.options[orig] + '</span><span class="tag">' + (chosen ? '&#10003; Selected' : '') + '</span>');
        b.addEventListener('click', function () {
          if (run.answers[id] === orig) delete run.answers[id]; else run.answers[id] = orig;
          saveStore(); show(); refresh(); drawGrid();
          var nb = body.querySelector('.opt[data-orig="' + orig + '"]'); if (nb) nb.focus({ preventScroll: true });
        });
        li.appendChild(b); ul.appendChild(li);
      });
      body.appendChild(ul);
      var nav = el('div', { 'class': 'row' });
      var prev = btn('Previous', '', function () { run.idx--; saveStore(); show(); drawGrid(); });
      if (run.idx === 0) { prev.disabled = true; }
      var next = btn(run.idx === total - 1 ? 'Review and submit' : 'Next', 'primary', function () {
        if (run.idx === total - 1) askSubmit(); else { run.idx++; saveStore(); show(); drawGrid(); }
      });
      nav.appendChild(prev); nav.appendChild(next);
      body.appendChild(nav);
      body.appendChild(el('p', { 'class': 'muted mock-hint' }, 'Select an option again to clear it. Keys: 1 to 4 or A to D select an answer.'));
      drawGrid();
    }

    keyHandler = function (ev) {
      var id = run.ids[run.idx], perm = run.perm[id];
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.key.length !== 1) return;
      var idx = '12345'.indexOf(ev.key);
      if (idx === -1) idx = 'abcde'.indexOf(ev.key.toLowerCase());
      if (idx === -1 || idx >= perm.length) return;
      ev.preventDefault();
      var orig = perm[idx];
      run.answers[id] = orig;
      saveStore(); show(); refresh(); drawGrid();
      var nb = body.querySelector('.opt[data-orig="' + orig + '"]'); if (nb) nb.focus({ preventScroll: true });
    };

    show(); refresh();
    tick = setInterval(refresh, 1000);
    focusHeading();
  }

  /* ---------- submission and results ---------- */
  function submit(run, how) {
    stopTick();
    var score = 0, per = {}, items = [];
    run.ids.forEach(function (id, i) {
      var item = pool.byId[id], sel = run.answers[id], ok = sel === item.q.answer;
      if (ok) score++;
      if (!per[item.n]) per[item.n] = { asked: 0, right: 0 };
      per[item.n].asked++; if (ok) per[item.n].right++;
      items.push({ item: item, sel: sel, ok: ok, pos: i + 1, perm: run.perm[id] });
    });
    var total = run.ids.length;
    var used = Math.min(EXAM_MS, Date.now() - run.start);
    store.attempts = (store.attempts || 0) + 1;
    if (!store.best || score / total > store.best.score / store.best.total) store.best = { score: score, total: total, date: Date.now() };
    store.run = null;
    saveStore();
    var wrong = run.ids.filter(function (id) { return run.answers[id] !== pool.byId[id].q.answer; });
    var sent = window.PHYS143_TRACK ? window.PHYS143_TRACK.send({ quiz: 'Mock exam', attempt: store.attempts, score: score, total: total, seconds: Math.round(used / 1000), wrong: wrong }, function (ok) {
      var s2 = document.getElementById('quiz-send-state'); if (s2) s2.textContent = ok ? 'Result sent to the lecturer.' : 'Result not sent.';
    }) : false;
    result({ sent: sent, score: score, total: total, used: used, how: how, per: per, items: items });
  }

  function result(r) {
    stopTick();
    clear();
    document.title = 'Mock exam score | PHYS 143 | Hope Donglo';
    app.appendChild(el('h3', { 'data-focus': '' }, 'Mock exam: your result'));
    app.appendChild(el('p', { 'class': 'score' }, r.score + ' out of ' + r.total));
    var unans = r.items.filter(function (x) { return x.sel == null; }).length;
    app.appendChild(el('p', null, Math.round(100 * r.score / r.total) + ' per cent. Time used: ' + words(r.used) + ' of 2 h 30 min' + (r.how === 'time' ? ' (submitted automatically when time ran out)' : '') + '. Unanswered: ' + unans + '.'));
    if (r.sent) app.appendChild(el('p', { 'class': 'muted', id: 'quiz-send-state', role: 'status' }, 'Sending your result…'));
    if (store.best) app.appendChild(el('p', { 'class': 'muted' }, 'Best score on this device: ' + store.best.score + ' out of ' + store.best.total + '.'));

    app.appendChild(el('h4', null, 'By lecture'));
    var t = el('table', { 'class': 'mock-table' });
    t.innerHTML = '<thead><tr><th scope="col">Lecture</th><th scope="col">Correct</th><th scope="col">Asked</th></tr></thead>';
    var tb = el('tbody');
    ORDER.forEach(function (n) {
      var p = r.per[n]; if (!p) return;
      tb.appendChild(el('tr', null, '<th scope="row">' + n + '. ' + LECTURES[n] + '</th><td>' + p.right + '</td><td>' + p.asked + '</td>'));
    });
    t.appendChild(tb);
    app.appendChild(el('div', { 'class': 'mock-tablewrap' }, '')).appendChild(t);

    app.appendChild(el('h4', null, 'Review of every question'));
    var ol = el('ol', { 'class': 'mock-review' });
    r.items.forEach(function (x) {
      var q = x.item.q, li = el('li', { 'class': x.ok ? 'ok' : 'no' });
      li.appendChild(el('p', { 'class': 'qtype' }, 'Lecture ' + x.item.n + ' · ' + q.source));
      li.appendChild(el('p', { 'class': 'mock-q' }, '<strong>' + x.pos + '.</strong> ' + q.q));
      li.appendChild(el('p', { 'class': 'mock-res' }, (x.ok ? '✓ Correct.' : (x.sel == null ? '✗ Not answered.' : '✗ Not correct.')) + (x.sel != null && !x.ok ? ' You chose: <strong>' + q.options[x.sel] + '</strong>.' : '') + ' <span>Correct answer: <strong>' + q.options[q.answer] + '</strong>.</span>'));
      li.appendChild(el('p', null, q.exp));
      if (q.ref) li.appendChild(el('p', { 'class': 'ref' }, 'Review: ' + q.ref));
      var rp = el('p', { 'class': 'mock-rep' });
      rp.appendChild(el('a', { 'class': 'btn report-btn', href: reportUrl(x.item, x.sel), target: '_blank', rel: 'noopener noreferrer', title: 'Report a problem or suggest a correction', 'aria-label': 'Report a problem or suggest a correction for question ' + x.pos + ' (opens a form in a new tab)' }, '<span aria-hidden="true">⚑</span> Report a problem'));
      li.appendChild(rp);
      ol.appendChild(li);
    });
    app.appendChild(ol);
    var row = el('div', { 'class': 'row' });
    row.appendChild(btn('Take another mock exam', 'primary', intro));
    app.appendChild(row);
    focusHeading();
    window.scrollTo(0, Math.max(0, app.getBoundingClientRect().top + window.pageYOffset - 80));
  }

  /* ---------- start ---------- */
  if (window.PHYS143_TRACK) window.PHYS143_TRACK.mount(app);
  loadPool(function () {
    if (!pool || poolSize() === 0) { clear(); app.appendChild(el('p', null, 'The mock exam is not available at the moment.')); return; }
    var run = store.run;
    if (run && run.ids && run.start && run.ids.every(function (id) { return pool.byId[id]; })) {
      if (run.start + EXAM_MS <= Date.now()) { submit(run, 'time'); return; }
      intro();
    } else { store.run = null; intro(); }
  }, function () { clear(); app.appendChild(el('p', null, 'The mock exam could not be loaded. Please check your connection and reload the page.')); });
})();
