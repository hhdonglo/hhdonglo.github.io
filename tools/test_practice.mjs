// Headless Chrome test of the practice page, driven over the DevTools protocol.
// Usage: node tools/test_practice.mjs [baseUrl] [lectureNumbers...]   (default http://localhost:8765/ and lectures 1 2)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8765/';
const LECTURES = process.argv.slice(3).map(Number);
if (!LECTURES.length) LECTURES.push(1, 2);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = process.env.SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'prof-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let results = [], failed = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('cannot reach Chrome');
}

const ws = new WebSocket(await connect());
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};
const go = async (url) => { await send('Page.navigate', { url }); await sleep(600); };
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
await send('Page.enable'); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');

const clickOpt = (text) => ev(`(()=>{const b=[...document.querySelectorAll('.opt')].find(x=>x.querySelector('.txt').textContent.replace(/^Option [A-D]: /,'')===${JSON.stringify(text)});b.click();return !!b})()`);
const qInfo = (n) => ev(`(()=>{const quiz=window.PHYS143_QUIZ[${n}];const t=document.querySelector('.qtext').textContent;const q=quiz.questions.find(x=>{const d=document.createElement('div');d.innerHTML=x.q;return d.textContent===t});const strip=s=>{const d=document.createElement('div');d.innerHTML=s;return d.textContent};return {id:q.id,correct:strip(q.options[q.answer]),wrong:q.options.filter((_,i)=>i!==q.answer).map(strip),correctHtml:q.options[q.answer]}})()`);
const textOf = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`);
const clickBtn = (label) => ev(`(()=>{const b=[...document.querySelectorAll('button,a.btn')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(label)}));if(!b)return false;b.click();return true})()`);
const optText = (el) => el;

for (const N of LECTURES) {
  console.log(`\n=== Lecture ${N} ===`);
  await ev(`localStorage.clear()`).catch(() => {});
  await go(`${BASE}practice.html#lecture-${N}`);
  await ev(`localStorage.clear(); location.reload()`); await sleep(600);
  const body = await textOf('main');
  check(`L${N}: page states practice, not assessment`, /not assessment/i.test(body));
  check(`L${N}: page shows Draft for review note`, /Draft for review/.test(body));
  const nq = await ev(`window.PHYS143_QUIZ[${N}].questions.length`);
  check(`L${N}: 20 questions loaded`, nq === 20, String(nq));
  check(`L${N}: start button present`, await clickBtn('Start all'));
  await sleep(200);

  let score = 0, firstWrongChecked = false, firstRightChecked = false, wrongIds = [], keyboardDone = false;
  for (let i = 0; i < nq; i++) {
    const info = await qInfo(N);
    const nOpt = await ev(`document.querySelectorAll('.opt').length`);
    if (i === 0) check(`L${N}: four option buttons`, nOpt === 4, String(nOpt));
    const answerWrong = i < 5;
    if (i === 5 && !keyboardDone) {
      // keyboard: press the key for the correct option position
      const pos = await ev(`[...document.querySelectorAll('.opt')].findIndex(b=>b.querySelector('.txt').textContent.replace(/^Option [A-D]: /,'')===${JSON.stringify(info.correct)})`);
      await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(String(pos + 1))},bubbles:true}))`);
      keyboardDone = true;
      await sleep(100);
      check(`L${N}: number key selects an option`, (await ev(`document.querySelectorAll('.opt.correct').length`)) === 1);
    } else if (answerWrong) {
      await clickOpt(info.wrong[0]);
    } else {
      await clickOpt(info.correct);
    }
    await sleep(60);
    const fb = await textOf('.fb');
    const nCorrect = await ev(`document.querySelectorAll('.opt.correct').length`);
    const nWrong = await ev(`document.querySelectorAll('.opt.wrong').length`);
    const allDisabled = await ev(`[...document.querySelectorAll('.opt')].every(b=>b.disabled)`);
    const marked = await ev(`document.querySelector('.opt.correct .tag').textContent`);
    if (answerWrong) {
      wrongIds.push(info.id);
      if (!firstWrongChecked) {
        check(`L${N}: wrong answer is marked as the student's choice`, nWrong === 1);
        check(`L${N}: correct answer is highlighted on a wrong answer`, nCorrect === 1 && (await ev(`document.querySelector('.opt.correct .txt').textContent.replace(/^Option [A-D]: /,'')`)) === info.correct);
        check(`L${N}: feedback names the correct answer and explanation`, fb.includes('The correct answer is') && fb.includes(info.correct) && fb.includes('Review:'), fb.slice(0, 80));
        check(`L${N}: colour is not the only cue (text tags)`, /Correct answer/.test(marked) && /Your answer/.test(await textOf('.opt.wrong .tag')));
        check(`L${N}: options locked after answering`, allDisabled);
        await shot(`L${N}-wrong-light`);
        firstWrongChecked = true;
      }
    } else {
      score++;
      if (!firstRightChecked) {
        check(`L${N}: correct answer shows a tick and reason`, /Correct/.test(fb) && !fb.includes('The correct answer is') && fb.length > 40, fb.slice(0, 60));
        firstRightChecked = true;
      }
    }
    await clickBtn(i === nq - 1 ? 'See my score' : 'Next question');
    await sleep(60);
  }
  const res = await textOf('main');
  check(`L${N}: score screen shows 15 out of 20`, /15 out of 20/.test(res));
  const stored = JSON.parse(await ev(`localStorage.getItem('phys143.practice.v1')`));
  check(`L${N}: best score stored in localStorage`, stored.lectures[N].best.score === 15 && stored.lectures[N].best.total === 20);
  check(`L${N}: missed questions stored (5)`, stored.lectures[N].missed.length === 5, JSON.stringify(stored.lectures[N].missed));
  check(`L${N}: missed list equals the ones answered wrongly`, JSON.stringify([...stored.lectures[N].missed].sort()) === JSON.stringify([...wrongIds].sort()));
  await shot(`L${N}-score-light`);

  // retry missed
  check(`L${N}: retry-missed button present`, await clickBtn('Retry the 5 missed'));
  await sleep(200);
  const prog = await textOf('.progress');
  check(`L${N}: retry run has 5 questions`, /question 1 of 5/.test(prog), prog);
  for (let i = 0; i < 5; i++) {
    const info = await qInfo(N);
    check(`L${N}: retry question ${i + 1} is one that was missed`, wrongIds.includes(info.id));
    await clickOpt(info.correct); await sleep(40);
    await clickBtn(i === 4 ? 'See my score' : 'Next question'); await sleep(60);
  }
  check(`L${N}: retry score 5 out of 5`, /5 out of 5/.test(await textOf('main')));
  const stored2 = JSON.parse(await ev(`localStorage.getItem('phys143.practice.v1')`));
  check(`L${N}: missed list cleared after correct retry`, stored2.lectures[N].missed.length === 0);
  check(`L${N}: best score unchanged by the retry run`, stored2.lectures[N].best.score === 15 && stored2.lectures[N].best.total === 20);

  // resume across reload
  await clickBtn('Start all questions again'); await sleep(200);
  for (let i = 0; i < 3; i++) { const info = await qInfo(N); await clickOpt(info.correct); await sleep(40); await clickBtn('Next question'); await sleep(60); }
  const beforeId = (await qInfo(N)).id;
  await ev(`location.reload()`); await sleep(700);
  const afterProg = await textOf('.progress');
  check(`L${N}: reload resumes at question 4`, /question 4 of 20/.test(afterProg), afterProg);
  check(`L${N}: same question after reload`, (await qInfo(N)).id === beforeId);

  // mobile + dark
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await go(`${BASE}practice.html#lecture-${N}`); await sleep(500);
  const mw = await ev(`({sw:document.documentElement.scrollWidth,iw:window.innerWidth})`);
  check(`L${N}: no horizontal scroll at 375 px`, mw.sw <= mw.iw, JSON.stringify(mw));
  const info = await qInfo(N);
  const heights = await ev(`[...document.querySelectorAll('.opt')].map(b=>Math.round(b.getBoundingClientRect().height))`);
  check(`L${N}: option buttons at least 44 px high on a phone`, heights.every((h) => h >= 44), heights.join(','));
  await clickOpt(info.wrong[0]); await sleep(100);
  await shot(`L${N}-wrong-phone`);
  const mw2 = await ev(`({sw:document.documentElement.scrollWidth,iw:window.innerWidth})`);
  check(`L${N}: no horizontal scroll at 375 px with feedback shown`, mw2.sw <= mw2.iw, JSON.stringify(mw2));
  // sweep: answer every question wrongly at phone width and check layout and text
  await go(`${BASE}practice.html#lecture-${N}-menu`); await sleep(300);
  await clickBtn('Start again'); await sleep(200);
  let sweepBad = [];
  for (let i = 0; i < nq; i++) {
    const inf = await qInfo(N);
    await clickOpt(inf.wrong[1]); await sleep(40);
    const m = await ev(`({sw:document.documentElement.scrollWidth,iw:window.innerWidth,txt:document.querySelector('main').textContent,hasCorrect:document.querySelectorAll('.opt.correct').length,fb:!!document.querySelector('.fb.no')})`);
    if (m.sw > m.iw) sweepBad.push(inf.id + ' overflow');
    if (/undefined|\{a\}|NaN|null/.test(m.txt)) sweepBad.push(inf.id + ' bad text');
    if (m.hasCorrect !== 1 || !m.fb) sweepBad.push(inf.id + ' no feedback');
    await clickBtn(i === nq - 1 ? 'See my score' : 'Next question'); await sleep(40);
  }
  check(`L${N}: every question, answered wrongly at 375 px, shows feedback with no overflow or bad text`, sweepBad.length === 0, sweepBad.join('; '));
  await go(`${BASE}practice.html#lecture-${N}`); await sleep(300);
  await clickBtn('Start all'); await sleep(200);
  { const inf2 = await qInfo(N); await clickOpt(inf2.wrong[0]); await sleep(100); }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(200);
  const bg = await ev(`getComputedStyle(document.body).backgroundColor`);
  const dark = bg === 'rgb(15, 24, 41)';
  check(`L${N}: dark mode applies`, dark, bg);
  const fbBg = await ev(`getComputedStyle(document.querySelector('.fb')).backgroundColor`);
  check(`L${N}: feedback panel recoloured in dark mode`, fbBg === 'rgb(68, 24, 28)', fbBg);
  await shot(`L${N}-wrong-phone-dark`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.clearDeviceMetricsOverride');
}

console.log('\n=== Home page and other checks ===');
await go(`${BASE}phys143.html`);
const idx = await ev(`({
  links:[...document.querySelectorAll('a.btn.practice')].map(a=>a.getAttribute('href')),
  six:!!document.querySelector('#lecture-6 a.practice'),
  sw:document.documentElement.scrollWidth, iw:window.innerWidth})`);
check('phys143: Practice button on 11 lecture cards', idx.links.length === 11, String(idx.links.length));
check('phys143: Lecture 6 has no practice link', idx.six === false);
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await go(`${BASE}phys143.html`);
const idx2 = await ev(`({sw:document.documentElement.scrollWidth,iw:window.innerWidth})`);
check('phys143: no horizontal scroll at 375 px', idx2.sw <= idx2.iw, JSON.stringify(idx2));
await send('Emulation.clearDeviceMetricsOverride');
await go(`${BASE}practice.html#lecture-6`);
check('lecture 6 hash shows a polite message, not an error', /no practice questions|not available/i.test(await textOf('main')));
await go(`${BASE}practice.html`);
check('practice home lists lectures', (await ev(`document.querySelectorAll('.list li').length`)) === 11);
await go(`${BASE}practice.html#lecture-99`);
check('unknown lecture handled', /no practice questions|not available/i.test(await textOf('main')));

const reqs = events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request.url);
const external = reqs.filter((u) => !u.startsWith(BASE) && !u.startsWith('about:') && !u.startsWith('data:'));
check('no requests to other hosts', external.length === 0, external.join(' '));
const errs = events.filter((e) => (e.method === 'Runtime.exceptionThrown') || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
check('no JavaScript errors in the console', errs.length === 0, JSON.stringify(errs.slice(0, 2)).slice(0, 200));

console.log(`\n${results.length - failed} of ${results.length} checks passed. Screenshots: ${SHOTS}`);
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
