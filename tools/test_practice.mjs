// Playwright test of the per-lecture practice quizzes (one page per lecture: phys143-lecture-N-practice.html).
// Usage: node tools/test_practice.mjs [baseUrl]   (default http://localhost:8765/)
import {createRequire} from 'module';
const require=createRequire('/opt/node22/lib/node_modules/');
const {chromium}=require('playwright');
import fs from 'fs';
const BASE=process.argv[2]||'http://localhost:8765/';
let fail=0;const check=(n,ok)=>{console.log((ok?'PASS ':'FAIL ')+n);if(!ok)fail++};
const b=await chromium.launch();
for(const N of [1,2,3,4,5,7,8,9,10,11,12]){
  const q=JSON.parse(fs.readFileSync(`quizzes/lecture${N}.json`,'utf8'));
  const p=await b.newPage();
  await p.goto(`${BASE}phys143-lecture-${N}.html`);
  await p.waitForSelector('.lecture-buttons');
  await p.click('.lecture-buttons >> text=Practice questions');
  await p.waitForSelector('#quiz-app .opt');
  check(`L${N}: button opens phys143-lecture-${N}-practice.html`, p.url().endsWith(`phys143-lecture-${N}-practice.html`));
  check(`L${N}: first question shown at once, no start screen`, (await p.locator('#quiz-app .opt').first().boundingBox()).y<900);
  check(`L${N}: no learning objectives or contacts on the quiz page`, !/Learning objectives|Contact 1/.test(await p.locator('main').innerText()));
  check(`L${N}: says not assessment`, /not assessment/i.test(await p.locator('main').innerText()));
  check(`L${N}: link back to the lecture`, await p.locator(`main a[href="phys143-lecture-${N}.html"]`).count()>=1);
  let right=0;
  for(let i=0;i<20;i++){
    await p.waitForSelector('#quiz-app .opt');
    const text=await p.locator('#quiz-app .qtext').innerText();
    const flat=s=>s.replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'').trim();
    const qq=q.questions.find(x=>flat(x.q)===text.trim())||q.questions.find(x=>text.includes(flat(x.q).slice(0,20)));
    const want=(i%5===4)?(qq.answer+1)%4:qq.answer; if(want===qq.answer)right++;
    await p.click(`#quiz-app .opt[data-orig="${want}"]`);
    await p.waitForSelector('#quiz-app .fb');
    await p.click('#quiz-app .row .btn.primary');
  }
  const score=await p.locator('#quiz-app .score').innerText();
  check(`L${N}: score ${score} = ${right} of 20`, score.startsWith(right+" out of 20"));
  const st=JSON.parse(await p.evaluate(()=>localStorage.getItem('phys143.practice.v1')));
  check(`L${N}: best score stored`, st.lectures[N]&&st.lectures[N].best.score===right);
  check(`L${N}: no other lecture's quiz on this page`, await p.locator('#quiz-app').count()===1);
  check(`L${N}: no all-lectures list`, !/Choose a lecture/.test(await p.locator('main').innerText()));
  await p.close();
}
const p=await b.newPage();
await p.goto(BASE+'phys143-lecture-6.html');await p.waitForTimeout(700);
check('L6: coming soon, no quiz', await p.locator('.lecture-buttons').count()===0 && /Coming soon/.test(await p.locator('main').innerText()));
await p.goto(BASE+'phys143.html');await p.waitForSelector('.week');
check('phys143: no grouped practice section', await p.locator('#practice-qs').count()===0 && !/Open practice questions/.test(await p.locator('main').innerText()));
const links=await p.$$eval('.week .wl a[href*="-practice.html"]',a=>a.map(x=>x.getAttribute('href')));
check('weekly: 11 practice links, one per lecture, straight to the quiz page', links.length===11 && !links.some(h=>h.includes('lecture-6')));
for(const [from,to] of [['practice.html#lecture-3','phys143-lecture-3-practice.html'],['practice.html#lecture-4-menu','phys143-lecture-4-practice.html'],['phys143-lecture-5.html#practice','phys143-lecture-5-practice.html'],['practice.html#lecture-6','phys143-lecture-6.html'],['practice.html','phys143.html']]){
  await p.goto(BASE+from);await p.waitForTimeout(500);
  check(`${from} forwards to ${to}`, p.url().includes(to));
}
await b.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0);
