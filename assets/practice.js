/* PHYS 143 practice engine for one lecture page. Plain JavaScript, no libraries, no network calls other than loading quizzes/lectureN.json. Mounts into #quiz-app (data-lecture = lecture number). */
(function () {
  'use strict';

  var LECTURES = {
    1: 'Vectors', 2: 'Motion', 3: 'Newton’s laws', 4: 'Work and kinetic energy',
    5: 'Potential energy and energy conservation', 7: 'Impulse and momentum', 8: 'Rotation',
    9: 'Temperature and heat', 10: 'Thermal properties of matter',
    11: 'First law of thermodynamics', 12: 'Second law of thermodynamics'
  };
  var ORDER = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
  var QUIZ_LENGTH = 20;
  var STORE_KEY = 'phys143.practice.v1';
  var LETTERS = ['A', 'B', 'C', 'D'];
  var TYPE_LABEL = { concept: 'Concept', calc: 'Calculation', graph: 'Graph or diagram', misconception: 'Common misconception' };

  var app = document.getElementById('quiz-app');
  if (!app) return;
  var started = false;
  window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};

  /* ---------- storage (every access guarded) ---------- */
  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      var s = raw ? JSON.parse(raw) : null;
      if (s && typeof s === 'object' && s.lectures) return s;
    } catch (e) { /* storage unavailable */ }
    return { lectures: {} };
  }
  var store = loadStore();
  function saveStore() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  function rec(n) {
    if (!store.lectures[n]) store.lectures[n] = { best: null, attempts: 0, missed: [], run: null };
    return store.lectures[n];
  }

  /* ---------- helpers ---------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* Exactly `size` ids: a random draw without repeats when the pool is larger; otherwise every question, then reshuffled passes, never the same question twice in a row. */
  function buildOrder(ids, size) {
    if (ids.length >= size) return shuffle(ids).slice(0, size);
    var out = [];
    while (out.length < size) {
      var pass = shuffle(ids);
      if (out.length && ids.length > 1 && pass[0] === out[out.length - 1]) { var t = pass[0]; pass[0] = pass[1]; pass[1] = t; }
      for (var i = 0; i < pass.length && out.length < size; i++) out.push(pass[i]);
    }
    return out;
  }
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
  function clear() { app.innerHTML = ''; }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent; }
  function setTitle() { /* the lecture page keeps its own title */ }
  function focusHeading() {
    if (!started) return;
    var h = app.querySelector('[data-focus]');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: false }); }
  }
  function when(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  /* ---------- reports: a prefilled Google Form, no account needed ----------
     CONFIG: replace the three values below once the form exists (see EDITING.md, "Reports from students").
     FORM_URL  : the form's address ending in /viewform
     ENTRY     : the entry.NNNNNNNNN id of each field, from the form's "Get pre-filled link"
     Until FORM_URL is set the report link stays hidden (add ?reportpreview=1 to a practice page to preview it). */
  var REPORT_FORM = {
    FORM_URL: 'https://docs.google.com/forms/d/e/PLACEHOLDER_FORM_ID/viewform',
    ENTRY: { lecture: 'entry.1111111111', id: 'entry.2222222222', question: 'entry.3333333333', answer: 'entry.4444444444', comment: 'entry.5555555555' }
  };
  var reportLive = REPORT_FORM.FORM_URL.indexOf('PLACEHOLDER') === -1 || /[?&]reportpreview=1/.test(window.location.search);
  function clip(t, n) { t = plain(String(t == null ? '' : t)).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function reportUrl(n, quiz, q, sel) {
    var E = REPORT_FORM.ENTRY, shown = clip(q.options[q.answer], 200) + (sel != null && sel !== q.answer ? ' (my answer: ' + clip(q.options[sel], 200) + ')' : '');
    var parts = ['usp=pp_url',
      E.lecture + '=' + encodeURIComponent('Lecture ' + n + (LECTURES[n] ? ': ' + LECTURES[n] : '')),
      E.id + '=' + encodeURIComponent(q.id),
      E.question + '=' + encodeURIComponent(clip(q.q, 500)),
      E.answer + '=' + encodeURIComponent(shown)];
    return REPORT_FORM.FORM_URL + '?' + parts.join('&');
  }
  function reportNote() {
    if (!reportLive || document.getElementById('quiz-report-note')) return;
    var p = el('p', { id: 'quiz-report-note', 'class': 'note quiz-note' },
      'Found a mistake or have a better explanation? After answering a question, use “Report a problem or suggest a correction”. It opens a short form with the question already filled in, and no account is needed. Reports go to the lecturer.');
    app.parentNode.insertBefore(p, app.nextSibling);
  }

  /* ---------- loading data ---------- */
  function loadLecture(n, ok, fail) {
    if (window.PHYS143_QUIZ[n]) { ok(window.PHYS143_QUIZ[n]); return; }
    fetch('quizzes/lecture' + n + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('missing'); return r.json(); })
      .then(function (d) { window.PHYS143_QUIZ[n] = d; ok(d); })
      .catch(fail);
  }

  /* ---------- views ---------- */
  function unavailable(n) {
    setTitle('Lecture ' + n);
    clear();
    app.appendChild(el('h3', { 'data-focus': '' }, 'Lecture ' + n + (LECTURES[n] ? ': ' + LECTURES[n] : '')));
    app.appendChild(el('p', null, LECTURES[n]
      ? 'The practice questions for this lecture are not available yet. Please check again later.'
      : 'There are no practice questions for this lecture.'));
    focusHeading();
  }

  function intro(n, quiz) {
    setTitle('Lecture ' + n + ': ' + quiz.title);
    clear();
    var r = rec(n);
    app.appendChild(el('h3', { 'data-focus': '' }, 'Lecture ' + n + ': ' + quiz.title));
    app.appendChild(el('p', null, QUIZ_LENGTH + ' questions, drawn and shuffled afresh each time. Select an answer to see at once whether it is correct. If it is wrong, the page shows the correct answer with a short explanation and where to look in the deck.'));
    var info = [];
    if (r.best) info.push('Best score: ' + r.best.score + ' out of ' + r.best.total + ' (' + when(r.best.date) + ').');
    if (r.attempts) info.push('Attempts on this device: ' + r.attempts + '.');
    if (info.length) app.appendChild(el('p', { 'class': 'muted' }, info.join(' ')));
    var row = el('div', { 'class': 'row' });
    if (r.run && r.run.v === 2) {
      row.appendChild(btn('Resume (question ' + (r.run.idx + 1) + ' of ' + r.run.order.length + ')', 'primary', function () { runQuiz(n, quiz); }));
      row.appendChild(btn('Start again', '', function () { startRun(n, quiz, 'all'); }));
    } else {
      row.appendChild(btn('Start ' + QUIZ_LENGTH + ' questions', 'primary', function () { startRun(n, quiz, 'all'); }));
    }
    var missed = (r.missed || []).filter(function (id) { return byId(quiz, id); });
    if (missed.length) row.appendChild(btn('Practise ' + missed.length + ' missed question' + (missed.length === 1 ? '' : 's'), '', function () { startRun(n, quiz, 'missed'); }));
    app.appendChild(row);
    focusHeading();
  }

  function byId(quiz, id) {
    for (var i = 0; i < quiz.questions.length; i++) if (quiz.questions[i].id === id) return quiz.questions[i];
    return null;
  }

  function startRun(n, quiz, mode) {
    var r = rec(n);
    var pool = quiz.questions.map(function (q) { return q.id; });
    if (mode === 'missed') {
      pool = pool.filter(function (id) { return (r.missed || []).indexOf(id) !== -1; });
      if (!pool.length) pool = quiz.questions.map(function (q) { return q.id; });
    }
    var order = mode === 'missed' ? shuffle(pool).slice(0, QUIZ_LENGTH) : buildOrder(pool, QUIZ_LENGTH);
    var perms = order.map(function () { return shuffle([0, 1, 2, 3]); });
    r.run = { v: 2, mode: mode, order: order, perms: perms, idx: 0, answers: {} };
    saveStore();
    runQuiz(n, quiz);
  }

  function runQuiz(n, quiz) {
    var r = rec(n), run = r.run;
    if (run && run.v !== 2) { r.run = run = null; saveStore(); }
    if (!run) { intro(n, quiz); return; }
    if (run.idx >= run.order.length) { result(n, quiz); return; }
    var q = byId(quiz, run.order[run.idx]);
    if (!q) { run.idx++; saveStore(); runQuiz(n, quiz); return; }
    var perm = run.perms[run.idx], pos0 = run.idx;
    var answered = Object.prototype.hasOwnProperty.call(run.answers, pos0);
    var chosen = answered ? run.answers[pos0] : null;
    setTitle('Lecture ' + n + ' question ' + (run.idx + 1));
    clear();

    var total = run.order.length;
    var prog = el('div', { 'class': 'progress' });
    prog.appendChild(el('span', null, 'Lecture ' + n + ': question ' + (run.idx + 1) + ' of ' + total));
    var done = 0; run.order.forEach(function (id, i) { if (Object.prototype.hasOwnProperty.call(run.answers, i)) done++; });
    var score = 0; run.order.forEach(function (id, i) { var qq = byId(quiz, id); if (qq && run.answers[i] === qq.answer) score++; });
    prog.appendChild(el('span', null, 'Correct so far: ' + score + ' of ' + done));
    app.appendChild(prog);
    var bar = el('div', { 'class': 'bar', role: 'progressbar', 'aria-label': 'Progress', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done) });
    bar.appendChild(el('span', { style: 'width:' + Math.round(100 * done / total) + '%' }));
    app.appendChild(bar);

    app.appendChild(el('p', { 'class': 'qtype' }, (TYPE_LABEL[q.type] || 'Question') + (q.source ? ' · ' + q.source : '')));
    var qt = el('h3', { 'class': 'qtext', 'data-focus': '' }, q.q);
    qt.style.color = 'inherit';
    qt.style.fontSize = '1.1rem';
    app.appendChild(qt);

    var ul = el('ul', { 'class': 'opts', 'aria-label': 'Answer options' });
    var buttons = [];
    perm.forEach(function (orig, pos) {
      var li = el('li');
      var b = el('button', { type: 'button', 'class': 'opt', 'data-orig': String(orig) },
        '<span class="k" aria-hidden="true">' + LETTERS[pos] + '</span><span class="txt"><span class="vh">Option ' + LETTERS[pos] + ': </span>' + q.options[orig] + '</span><span class="tag"></span>');
      b.addEventListener('click', function () { choose(orig); });
      li.appendChild(b); ul.appendChild(li); buttons.push(b);
    });
    app.appendChild(ul);
    var fb = el('div', { 'class': 'fb-wrap', role: 'status' });
    app.appendChild(fb);
    var nav = el('div', { 'class': 'row' });
    app.appendChild(nav);

    function showFeedback(sel) {
      var right = sel === q.answer;
      buttons.forEach(function (b) {
        var o = Number(b.getAttribute('data-orig'));
        b.disabled = true;
        var tag = b.querySelector('.tag');
        if (o === q.answer) { b.classList.add('correct'); tag.innerHTML = '&#10003; Correct answer'; }
        else if (o === sel) { b.classList.add('wrong'); tag.innerHTML = '&#10007; Your answer'; }
        else b.classList.add('dim');
      });
      var d = el('div', { 'class': 'fb ' + (right ? 'ok' : 'no') });
      if (right) {
        d.appendChild(el('p', { 'class': 'head' }, '✓ Correct'));
      } else {
        d.appendChild(el('p', { 'class': 'head' }, '✗ Not correct'));
        d.appendChild(el('p', null, 'You chose: <strong>' + q.options[sel] + '</strong>'));
        d.appendChild(el('p', null, 'The correct answer is: <strong>' + q.options[q.answer] + '</strong>'));
      }
      d.appendChild(el('p', null, q.exp));
      if (q.ref) d.appendChild(el('p', { 'class': 'ref' }, 'Review: ' + q.ref));
      if (reportLive) {
      var rp = el('p', { 'class': 'report' });
      var ra = el('a', { href: reportUrl(n, quiz, q, sel), target: '_blank', rel: 'noopener noreferrer' }, 'Report a problem or suggest a correction');
      rp.appendChild(ra); d.appendChild(rp);
      }
      fb.innerHTML = '';
      fb.appendChild(d);
      nav.innerHTML = '';
      var last = run.idx >= run.order.length - 1;
      var nb = btn(last ? 'See my score' : 'Next question', 'primary', function () { run.idx++; saveStore(); runQuiz(n, quiz); });
      nav.appendChild(nb);
      nav.appendChild(btn('Save and leave', '', function () { currentKeys = null; intro(n, quiz); }));
      nb.focus();
    }

    function choose(orig) {
      if (Object.prototype.hasOwnProperty.call(run.answers, pos0)) return;
      run.answers[pos0] = orig;
      saveStore();
      showFeedback(orig);
    }

    if (answered) showFeedback(chosen);
    else {
      nav.appendChild(btn('Save and leave', '', function () { currentKeys = null; intro(n, quiz); }));
      focusHeading();
    }
    currentKeys = function (ev) {
      if (Object.prototype.hasOwnProperty.call(run.answers, pos0)) return;
      var idx = '1234'.indexOf(ev.key);
      if (idx === -1) idx = 'abcd'.indexOf(ev.key.toLowerCase());
      if (idx !== -1 && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); choose(perm[idx]); }
    };
  }

  function result(n, quiz) {
    var r = rec(n), run = r.run;
    currentKeys = null;
    var wrongIds = [], score = 0;
    run.order.forEach(function (id, i) {
      var q = byId(quiz, id);
      if (q && run.answers[i] === q.answer) score++;
      else if (wrongIds.indexOf(id) === -1) wrongIds.push(id);
    });
    var total = run.order.length;
    var first = !r.best || (run.mode === 'all' && (score / total) > (r.best.score / r.best.total));
    r.attempts = (r.attempts || 0) + 1;
    if (run.mode === 'all') {
      if (first) r.best = { score: score, total: total, date: Date.now() };
      r.missed = wrongIds;
    } else {
      /* missed-only run: keep questions still wrong, drop those now correct */
      r.missed = (r.missed || []).filter(function (id) { return wrongIds.indexOf(id) !== -1 || run.order.indexOf(id) === -1; });
    }
    var summary = { mode: run.mode, score: score, total: total, wrong: wrongIds };
    r.run = null;
    saveStore();

    setTitle('Lecture ' + n + ' score');
    clear();
    app.appendChild(el('h3', { 'data-focus': '' }, 'Lecture ' + n + ': your score'));
    app.appendChild(el('p', { 'class': 'score' }, score + ' out of ' + total));
    var pct = Math.round(100 * score / total);
    app.appendChild(el('p', null, pct + ' per cent. ' + (pct >= 80 ? 'A strong result. Check the questions you missed.' : pct >= 50 ? 'A fair start. Review the explanations for the questions you missed, then retry them.' : 'Revisit the deck and the supplement, then retry the questions you missed.')));
    if (summary.mode === 'all' && r.best) app.appendChild(el('p', { 'class': 'muted' }, 'Best score on this device: ' + r.best.score + ' out of ' + r.best.total + '.'));
    if (wrongIds.length) {
      app.appendChild(el('h4', null, 'Questions to review'));
      var ol = el('ol', { 'class': 'review' });
      wrongIds.forEach(function (id) {
        var q = byId(quiz, id);
        ol.appendChild(el('li', null, q.q + '<br><strong>Correct answer:</strong> ' + q.options[q.answer] + (q.ref ? '<br><span class="muted" style="font:.85rem system-ui,sans-serif">Review: ' + q.ref + '</span>' : '')));
      });
      app.appendChild(ol);
    }
    var row = el('div', { 'class': 'row' });
    if (wrongIds.length) row.appendChild(btn('Retry the ' + wrongIds.length + ' missed question' + (wrongIds.length === 1 ? '' : 's'), 'primary', function () { startRun(n, quiz, 'missed'); }));
    row.appendChild(btn('Start a new set of ' + QUIZ_LENGTH, wrongIds.length ? '' : 'primary', function () { startRun(n, quiz, 'all'); }));
    app.appendChild(row);
    focusHeading();
  }

  /* ---------- routing ---------- */
  var currentKeys = null;
  document.addEventListener('keydown', function (ev) { if (currentKeys && app.contains(document.activeElement)) currentKeys(ev); });

  function route() {
    currentKeys = null;
    var n = Number(app.getAttribute('data-lecture'));
    if (!LECTURES[n]) { unavailable(n); return; }
    loadLecture(n, function (quiz) {
      var r0 = rec(n);
      if (r0.run && r0.run.v === 2) runQuiz(n, quiz);
      else if (!r0.attempts) startRun(n, quiz, 'all'); /* first visit: the first question appears at once */
      else intro(n, quiz);
      started = true;
    }, function () { unavailable(n); started = true; });
  }
  reportNote();
  route();
})();
