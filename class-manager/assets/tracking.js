/* Optional student ID and result sending for the quizzes (weekly practice and mock exam).
   Strictly voluntary: nothing is sent unless the student has typed an ID, and the quizzes work fully without one.
   The ID is kept only in this browser (localStorage) and can be cleared at any time. No cookies, no analytics.

   Attempts are sent to the class server (window.CM.scriptUrl); without one the ID box stays hidden
   (add ?trackpreview=1 to a quiz address to preview the box; nothing is sent in preview). */
(function () {
  'use strict';
  var ID_KEY = 'cm.studentid.v1';
  var preview = /[?&]trackpreview=1/.test(window.location.search);
  var live = !!(window.CM || {}).scriptUrl; // attempts go to the class server
  var enabled = live || preview;

  function getId() {
    try { var v = window.localStorage.getItem(ID_KEY); return v ? String(v) : ''; } catch (e) { return ''; }
  }
  function setId(v) {
    try { if (v) window.localStorage.setItem(ID_KEY, v); else window.localStorage.removeItem(ID_KEY); } catch (e) { /* ignore */ }
  }
  function clean(v) { return String(v || '').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }

  /* Mount the optional box once, just below the quiz card. */
  function mount(app) {
    if (!enabled || !app || document.getElementById('quiz-track')) return;
    var box = document.createElement('div');
    box.id = 'quiz-track';
    box.className = 'note quiz-note quiz-track';
    box.innerHTML = '<label for="track-id"><strong>Student ID (optional)</strong></label> ' +
      '<input id="track-id" type="text" inputmode="text" maxlength="30" autocomplete="off" spellcheck="false" aria-describedby="track-note"> ' +
      '<button type="button" class="btn" id="track-save">Save ID</button> <button type="button" class="btn" id="track-clear">Clear my ID</button>' +
      '<p id="track-note" class="track-note">Optional. If you enter an ID, your score for each completed attempt is sent to the lecturer so progress can be followed. Leave it blank to use the quiz without sending anything. ' +
      'Your ID is kept only in this browser.</p><p class="track-state" role="status" id="track-state"></p>';
    app.parentNode.insertBefore(box, app.nextSibling);
    var input = box.querySelector('#track-id'), state = box.querySelector('#track-state');
    input.value = getId();
    function say(t) { state.textContent = t; }
    if (input.value) say('Results will be sent with the ID ' + input.value + '.');
    box.querySelector('#track-save').addEventListener('click', function () {
      var v = clean(input.value); input.value = v; setId(v);
      say(v ? 'Saved. Results will be sent with the ID ' + v + '.' : 'No ID saved. Nothing will be sent.');
    });
    box.querySelector('#track-clear').addEventListener('click', function () { input.value = ''; setId(''); say('ID cleared. Nothing will be sent.'); });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); box.querySelector('#track-save').click(); } });
  }

  /* One shared route for attempts and reports: the lecturer's Apps Script web app, no Submit step for the student.
     done(true) once the request has left the browser, done(false) if it could not be sent. */
  var SCRIPT_URL = (window.CM || {}).scriptUrl || '';
  function post(kind, fields, done) {
    var body = new URLSearchParams();
    body.append('kind', kind);
    Object.keys(fields).forEach(function (k) { body.append(k, fields[k]); });
    try {
      fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', credentials: 'omit', body: body })
        .then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
  }

  /* Send one record for a completed attempt. Returns false (and sends nothing) when no ID is stored.
     done(true) after the request leaves the browser, done(false) if it could not be sent. */
  function send(rec, done) {
    var id = enabled ? clean(getId()) : '';
    if (!id) return false;
    if (preview && !live) { window.setTimeout(function () { done(true); }, 0); return true; }
    post('attempt', { id: id, quiz: rec.quiz, attempt: String(rec.attempt), score: String(rec.score), total: String(rec.total),
      seconds: rec.seconds == null ? '' : String(rec.seconds), wrong: (rec.wrong || []).join(', '), asked: (rec.asked || []).join(', ') }, done);
    return true;
  }

  window.CM_TRACK = { mount: mount, send: send, post: post, enabled: enabled };
})();
