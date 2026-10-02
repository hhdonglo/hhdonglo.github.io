// Dump the rendered innerHTML of every [data-render] container, so tools/bake.py can store it as the no-JavaScript fallback.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async()=>{const base=process.argv[2],files=process.argv.slice(3);const b=await chromium.launch();const out={};
for(const f of files){const p=await b.newPage({viewport:{width:1100,height:900}});await p.goto(base+'/'+f);await p.waitForTimeout(900);
out[f]=await p.evaluate(()=>{document.querySelectorAll('.quiz').forEach(q=>{q.innerHTML='<p>The practice questions need JavaScript. Please enable it in your browser.</p>'});return [...document.querySelectorAll('[data-render]')].map(e=>[e.getAttribute('data-render'),e.innerHTML])});await p.close();}
fs.writeFileSync('/tmp/claude-0/bake.json',JSON.stringify(out));await b.close()})()
