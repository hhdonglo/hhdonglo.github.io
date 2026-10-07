/* Optional student ID and result sending for the PHYS 143 quizzes (weekly practice and mock exam).
   Strictly voluntary: nothing is sent unless the student has typed an ID, and the quizzes work fully without one.
   The ID is kept only in this browser (localStorage) and can be cleared at any time. No cookies, no analytics.

   CONFIG: TRACK_FORM is the one place to set up. Create a second Google Form (see EDITING.md, "Optional student ID and progress"),
     FORM_URL : the form's address ending in /viewform (this file posts to the same address ending in /formResponse)
     ENTRY    : the entry.NNNNNNNNN number of each field, from the form's "Get pre-filled link"
   Until FORM_URL is set the ID box stays hidden (add ?trackpreview=1 to a quiz address to preview the box; nothing is sent in preview). */
(function () {
  'use strict';
  var TRACK_FORM = {
    FORM_URL: 'https://docs.google.com/forms/d/e/PLACEHOLDER_TRACKING_FORM/viewform',
    ENTRY: { id: 'entry.0000000001', quiz: 'entry.0000000002', attempt: 'entry.0000000003', score: 'entry.0000000004', total: 'entry.0000000005', seconds: 'entry.0000000006', when: 'entry.0000000007', wrong: 'entry.0000000008' }
  };
  var ID_KEY = 'phys143.studentid.v1';
  var preview = /[?&]trackpreview=1/.test(window.location.search);
  var live = TRACK_FORM.FORM_URL.indexOf('PLACEHOLDER') === -1;
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
      'Your ID is kept only in this browser. Please do not enter your name.</p><p class="track-state" role="status" id="track-state"></p>';
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

  /* Send one record for a completed attempt. Returns false (and sends nothing) when no ID is stored.
     done(true) after the request leaves the browser, done(false) if it could not be sent. */
  function send(rec, done) {
    var id = enabled ? clean(getId()) : '';
    if (!id) return false;
    if (preview && !live) { window.setTimeout(function () { done(true); }, 0); return true; }
    var E = TRACK_FORM.ENTRY, body = new URLSearchParams();
    body.append(E.id, id);
    body.append(E.quiz, rec.quiz);
    body.append(E.attempt, String(rec.attempt));
    body.append(E.score, String(rec.score));
    body.append(E.total, String(rec.total));
    body.append(E.seconds, rec.seconds == null ? '' : String(rec.seconds));
    body.append(E.when, new Date().toISOString());
    body.append(E.wrong, (rec.wrong || []).join(', '));
    var url = TRACK_FORM.FORM_URL.replace(/\/viewform.*$/, '/formResponse');
    try {
      fetch(url, { method: 'POST', mode: 'no-cors', credentials: 'omit', body: body })
        .then(function () { done(true); }, function () { done(false); });
    } catch (e) { done(false); }
    return true;
  }

  window.PHYS143_TRACK = { mount: mount, send: send, enabled: enabled };
})();
