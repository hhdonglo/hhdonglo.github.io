/* Renders pages from the JSON files in /data. If anything fails, the static HTML in the page stays as it is. */
(function(){
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
/* Simple markup: **bold**, *italic*, ^superscript^, [text](link) */
function md(s){
  s=esc(s==null?"":s);
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,function(m,t,u){
    if(!/^(https?:|mailto:|tel:|#|[A-Za-z0-9_\-\.\/]+(\.html|\.pdf)?(#[\w\-]*)?$)/.test(u))return t;
    var ext=/^https?:/.test(u);return '<a href="'+u+'"'+(ext?' rel="noopener"':'')+'>'+t+'</a>';});
  s=s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/\^(.+?)\^/g,"<sup>$1</sup>");
  return s;
}
function link(u,t,ext){return '<a href="'+esc(u)+'"'+(ext?' rel="noopener"':'')+'>'+t+'</a>'}
function get(name){return fetch("data/"+name+".json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(name);return r.json()})}
function profiles(site,sep){return site.profiles.map(function(p){return link(p.url,esc(p.label)+" &#8599;",true)}).join(sep)}

var R={};
R.publications=function(el,d,site){
  var h='<div class="pub-filter" role="group" aria-label="Filter by year">'+d.filters.map(function(f,i){return '<button type="button" class="btn" data-f="'+esc(f.id)+'" aria-pressed="'+(i===0)+'">'+esc(f.label)+'</button>'}).join("")+'</div>';
  h+='<p class="note" id="pub-count" aria-live="polite"></p>';
  h+='<p class="ext-links">Full list on '+link(site.profiles[0].url,"Google Scholar &#8599;",true)+" "+link(site.profiles[1].url,"ORCID &#8599;",true)+'</p><div class="ov-grid">';
  d.groups.forEach(function(g){
    h+='<article class="ov-card wide"><h3 class="h4">'+esc(g.title)+'</h3>'+(g.note?'<p class="note">'+md(g.note)+'</p>':'')+'<ul class="refs">'+g.items.map(function(i){return '<li data-year="'+esc(i.tag)+'">'+md(i.text)+'</li>'}).join("")+'</ul></article>';});
  el.innerHTML=h+'</div>';
  var bs=el.querySelectorAll(".pub-filter button"),lis=el.querySelectorAll(".refs li[data-year]"),cards=el.querySelectorAll(".ov-grid .ov-card"),c=el.querySelector("#pub-count");
  function run(f){var n=0;lis.forEach(function(l){var v=f==="all"||l.dataset.year===f;l.hidden=!v;if(v)n++});cards.forEach(function(k){k.hidden=!k.querySelector("li:not([hidden])")});bs.forEach(function(b){b.setAttribute("aria-pressed",b.dataset.f===f?"true":"false")});c.textContent=n+(n===1?" item shown":" items shown")}
  bs.forEach(function(b){b.addEventListener("click",function(){run(b.dataset.f)})});run("all");
};
R["pubs-home"]=function(el,d){el.innerHTML=d.home.map(function(i){return '<li><span class="yr">'+esc(i.label)+'</span><span>'+md(i.text)+'</span></li>'}).join("")};
R["research-lead"]=function(el,d){el.innerHTML='<h3 class="h4">'+md(d.question)+'</h3><p class="intro">'+md(d.intro)+'</p>'};
R["research-areas"]=function(el,d){el.innerHTML=d.areas.map(function(a,i){return '<article class="ov-card area"><p class="num">'+("0"+(i+1)).slice(-2)+'</p><h4>'+md(a.title)+'</h4><p>'+md(a.text)+'</p></article>'}).join("")};
function cards(list,past){return list.map(function(c){return '<article class="ov-card"><p class="status'+(past?' past':'')+'">'+md(c.status)+'</p><h4>'+md(c.title)+'</h4>'+c.paragraphs.map(function(p){return '<p>'+md(p)+'</p>'}).join("")+'</article>'}).join("")}
R["research-current"]=function(el,d){el.innerHTML=cards(d.current,false)};
R["research-previous"]=function(el,d){el.innerHTML=cards(d.previous,true)};
R["research-chips"]=function(el,d){el.innerHTML=d.current.map(function(c){return '<li>'+md(c.chip||c.title)+'</li>'}).join("")};
R.projects=function(el,d){
  var h='<div class="ov-card"><h3 class="h4">'+md(d.intro_title)+'</h3><p class="intro">'+md(d.intro)+'</p></div>';
  h+='<h3 class="sub2" id="certification">Certification</h3><div class="ov-card"><h4>'+md(d.certification.title)+'</h4><p>'+md(d.certification.text)+'</p></div>';
  h+='<h3 class="sub2" id="projects-ds">Selected projects</h3><p class="note">'+md(d.projects_note)+'</p><div class="ov-grid">';
  d.projects.forEach(function(p){
    h+='<article class="ov-card"><h4>'+md(p.title)+'</h4><p class="status">'+md(p.type)+'</p><p>'+md(p.description)+'</p>'+(p.details||[]).map(function(x){return '<p><strong>'+md(x.label)+':</strong> '+md(x.text)+'</p>'}).join("")+(p.tools&&p.tools.length?'<ul class="chips" aria-label="Tools">'+p.tools.map(function(t){return '<li>'+md(t)+'</li>'}).join("")+'</ul>':'')+(p.repo?'<p><a class="btn" href="'+esc(p.repo)+'" rel="noopener">View on GitHub</a></p>':'')+'</article>';});
  h+='</div><p class="note">'+md(d.footnote)+'</p>';
  el.innerHTML=h;
};
R.lectures=function(el,d){
  var g=d.groups.filter(function(x){return x.id===el.getAttribute("data-group")})[0];if(!g)return;
  var rows=g.lectures.map(function(l){
    var n=l.number,nn=("0"+n).slice(-2);
    if(l.status==="soon")return '<tr class="soon" id="lecture-'+n+'"><th scope="row" class="ln">'+nn+'</th><td class="topic"><strong>Lecture '+n+'</strong><span class="state">Coming soon</span><p class="learn">'+md(l.note||"Materials are being prepared.")+'</p></td><td class="primary-cell"><span class="btn off">Slides: coming soon</span></td><td class="more-cell"><span class="muted">Tutorial &middot; Supplement &middot; Practice: coming soon</span></td></tr>';
    var more=[l.tutorial?link(l.tutorial,'Tutorial<span class="vh"> for lecture '+n+'</span>'):'<span class="muted">Tutorial: not available</span>',l.supplement?link(l.supplement,'Supplement<span class="vh"> for lecture '+n+'</span>'):'<span class="muted">Supplement: not available</span>',link("practice.html#lecture-"+n,'Practice<span class="vh"> for lecture '+n+'</span>')];
    return '<tr id="lecture-'+n+'"><th scope="row" class="ln">'+nn+'</th><td class="topic"><strong>Lecture '+n+': '+md(l.title)+'</strong><span class="state ok">Available</span><p class="learn">'+md(l.summary)+'</p>'+(l.outcomes&&l.outcomes.length?'<details><summary>Learning outcomes</summary><ul>'+l.outcomes.map(function(o){return '<li>'+md(o)+'</li>'}).join("")+'</ul></details>':'')+'</td><td class="primary-cell"><a class="btn primary" href="'+esc(l.slides)+'">Open slides<span class="vh"> for lecture '+n+'</span></a></td><td class="more-cell">'+more.join(" &middot; ")+'</td></tr>';}).join("");
  el.innerHTML='<table class="lectures"><caption class="vh">Lectures</caption><thead><tr><th scope="col">Lecture</th><th scope="col">Topic</th><th scope="col">Start here</th><th scope="col">Also</th></tr></thead><tbody>'+rows+'</tbody></table>';
};
R.profiles=function(el,d,site){el.innerHTML=profiles(site," ")};
R.contact=function(el,d,site){
  el.innerHTML='<ul class="contact-list"><li><span>Office</span> '+esc(site.office)+'</li><li><span>Email</span> '+link("mailto:"+site.email,esc(site.email))+(site.email_alt?' or '+link("mailto:"+site.email_alt,esc(site.email_alt)):'')+'</li><li><span>Tel.</span> '+link("tel:"+site.phone_link,esc(site.phone_display))+'</li></ul>';
};
R["contact-profiles"]=function(el,d,site){el.innerHTML=site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")};
R["contact-mail"]=function(el,d,site){el.setAttribute("href","mailto:"+site.email);el.textContent="Email "+site.email};
R.footer=function(el,d,site){
  var navs=[["research.html","Research"],["teaching.html","Teaching"],["projects.html","Projects"],["publications.html","Publications"],["cv.html","CV"],["contact.html","Contact"]];
  el.innerHTML='<div class="wrap"><div class="foot-grid"><div><p class="foot-name">'+esc(site.name)+'</p><p>'+esc(site.field)+'</p><p>'+link("mailto:"+site.email,esc(site.email))+'</p></div><nav aria-label="Footer"><ul>'+navs.map(function(n){return '<li>'+link(n[0],n[1])+'</li>'}).join("")+'</ul></nav><ul class="foot-ext">'+site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")+'</ul></div><p class="foot-note">'+esc(site.footer_note)+'</p></div>';
};
var files={publications:"publications","pubs-home":"publications","research-lead":"research","research-areas":"research","research-current":"research","research-previous":"research","research-chips":"research",projects:"projects",lectures:"lectures"};
var els=document.querySelectorAll("[data-render]");if(!els.length)return;
var cache={};function load(n){return cache[n]||(cache[n]=get(n))}
els.forEach(function(el){var k=el.getAttribute("data-render"),f=files[k];
  Promise.all([f?load(f):Promise.resolve(null),load("site")]).then(function(r){R[k](el,r[0],r[1])}).catch(function(){});});
})();
