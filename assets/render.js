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
  var navs=[["research.html","Research"],["teaching.html","Teaching"],["data-computation.html","Data &amp; Computation"],["about.html","About"],["contact.html","Contact"]];
  el.innerHTML='<div class="wrap"><div class="foot-grid"><div><p class="foot-name">'+esc(site.name)+'</p><p>'+esc(site.footer_position||site.field)+'</p></div><nav aria-label="Footer"><ul>'+navs.map(function(n){return '<li>'+link(n[0],n[1])+'</li>'}).join("")+'</ul></nav><ul class="foot-ext">'+site.profiles.filter(function(p){return p.in_footer!==false}).map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")+'</ul></div><p class="foot-note">'+esc(site.footer_note)+'</p></div>';
};
/* ---- generic pages: data/pages/*.json ---- */
function sub(o,site){return JSON.parse(JSON.stringify(o).replace(/\{(email|email_alt|phone_display|office)\}/g,function(m,k){return JSON.stringify(site[k]||"").slice(1,-1)}))}
function list(items,style){
  var tag=style==="numbered"?"ol":"ul",cls={chips:"chips",timeline:"tl",arrows:"arrows"}[style];
  return '<'+tag+(cls?' class="'+cls+'"':'')+'>'+items.map(function(x){return '<li>'+md(x)+'</li>'}).join("")+'</'+tag+'>';
}
function paras(a,cls){return (a||[]).map(function(p){return '<p'+(cls?' class="'+cls+'"':'')+'>'+md(p)+'</p>'}).join("")}
function btn(c,full){
  if(!c.button_label)return "";
  return '<a class="btn'+(c.button_style?' '+esc(c.button_style):'')+'" href="'+esc(c.button_url||"#")+'"'+(full?' style="grid-column:1/-1"':'')+'>'+esc(c.button_label)+(c.button_sr?'<span class="vh"> '+esc(c.button_sr)+'</span>':'')+'</a>';
}
function subsec(x){
  var inner=paras(x.paragraphs)+(x.bullets&&x.bullets.length?list(x.bullets,x.bullet_style):'');
  if(x.style==="boxed")return '<section class="ov-sub"><h4>'+md(x.title)+'</h4>'+inner+'</section>';
  if(x.style==="bold")return '<p><strong>'+md(x.title)+'</strong></p>'+inner;
  return '<h3 class="h4">'+md(x.title)+'</h3>'+inner;
}
function bcard(c){
  var t=c.id?c.id+"-t":"",st=c.style;
  var cls="card"+(st==="primary"?" primary-card":st==="secondary"?" secondary-card":"")+(c.soon?" soon":"");
  var h='<article class="'+cls+'"'+(c.id?' id="'+esc(c.id)+'" aria-labelledby="'+esc(t)+'"':'')+'>';
  if(c.image)h+='<a class="thumb" href="'+esc(c.image_url||"#")+'" tabindex="-1" aria-hidden="true"><img src="'+esc(c.image)+'" width="600" height="338" loading="lazy" alt="'+esc(c.image_alt||"")+'"></a>';
  h+='<div class="body"><p class="num">'+esc(c.kicker||"")+(c.badge?' <span class="badge">'+esc(c.badge)+'</span>':'')+'</p><h4'+(t?' id="'+esc(t)+'"':'')+'>'+md(c.title)+'</h4>';
  if(c.subtitle)h+='<p class="pc-sub">'+md(c.subtitle)+'</p>';
  h+=paras(c.paragraphs,"learn");
  if(c.steps&&c.steps.length)h+='<ol class="contacts" aria-label="Steps">'+c.steps.map(function(x,i){return '<li><span class="k">'+(i+1)+'</span>'+esc(x)+'</li>'}).join("")+'</ol>';
  if(c.button_label)h+='<div class="btns">'+btn(c,true)+'</div>';
  return h+'</div></article>';
}
function acard(c,site,sec){
  var lvl=sec.heading&&!sec.fold?"h4":'h3 class="h4"',end=sec.heading&&!sec.fold?"h4":"h3";
  var h='<article class="ov-card'+(c.style==="wide"?' wide':'')+'"'+(c.id?' id="'+esc(c.id)+'"':'')+'>';
  if(c.title)h+='<'+lvl+'>'+md(c.title)+'</'+end+'>';
  if(c.subtitle)h+='<p class="sec-sub">'+md(c.subtitle)+'</p>';
  if(c.note_top)h+='<p class="note">'+md(c.note_top)+'</p>';
  h+=paras(c.paragraphs,c.lead?"intro":"");
  if(c.bullets&&c.bullets.length)h+=list(c.bullets,c.bullet_style);
  if(c.special==="profiles")h+='<ul class="foot-ext plain">'+site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")+'</ul>';
  if(c.special==="details")h+='<ul class="contact-list"><li><span>Office</span> '+esc(site.office)+'</li><li><span>Email</span> '+link("mailto:"+site.email,esc(site.email))+(site.email_alt?' or '+link("mailto:"+site.email_alt,esc(site.email_alt)):'')+'</li><li><span>Tel.</span> '+link("tel:"+site.phone_link,esc(site.phone_display))+'</li></ul>';
  if(c.table&&c.table.headers&&c.table.headers.length)h+='<table class="ov-ref">'+(c.table.caption?'<caption class="vh">'+esc(c.table.caption)+'</caption>':'')+'<thead><tr>'+c.table.headers.map(function(x){return '<th scope="col">'+esc(x)+'</th>'}).join("")+'</tr></thead><tbody>'+c.table.rows.map(function(r){r=r.cells||r;return '<tr>'+r.map(function(x){return '<td>'+md(x)+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table>';
  var subs=c.subsections||[];
  if(subs.some(function(x){return x.column})){var cols=[[],[]];subs.forEach(function(x){cols[(x.column===2)?1:0].push(subsec(x))});h+='<div class="ov-two">'+cols.map(function(k){return '<div>'+k.join("")+'</div>'}).join("")+'</div>'}
  else h+=subs.map(subsec).join("");
  h+=paras(c.after,c.lead?"intro":"");
  if(c.note)h+='<p class="note">'+md(c.note)+'</p>';
  if(c.button_label)h+='<p>'+btn(c,false)+'</p>';
  return h+'</article>';
}
function section(s,site){
  var inner="";
  if(s.subtitle)inner+='<p class="sec-sub">'+md(s.subtitle)+'</p>';
  if(s.bullets&&s.bullets.length)inner+=list(s.bullets,s.bullet_style);
  var cs=s.cards||[],b=cs.length&&/^(primary|secondary|course|lecture)$/.test(cs[0].style);
  if(b){var body=cs.map(bcard).join("");inner+=(cs.length>1||cs[0].style==="lecture"||cs[0].style==="course")?'<div class="grid'+(cs[0].style==="course"?' levels':'')+'">'+body+'</div>':body}
  else if(cs.length){var body2=cs.map(function(c){return acard(c,site,s)}).join("");inner+=s.layout==="grid"?'<div class="ov-grid">'+body2+'</div>':body2}
  if(s.fold)return '<details class="fold"'+(s.id?' id="'+esc(s.id)+'"':'')+'><summary>'+md(s.heading)+'</summary>'+inner+'</details>';
  if(s.heading)return '<section'+(s.id?' aria-labelledby="'+esc(s.id)+'"':'')+'><h3 class="sub2"'+(s.id?' id="'+esc(s.id)+'"':'')+'>'+md(s.heading)+'</h3>'+inner+'</section>';
  return inner;
}
R.page=function(el,d,site){
  d=sub(d,site);
  var slot=el.getAttribute("data-slot")||"sections";
  el.innerHTML=(d[slot]||[]).map(function(s){return section(s,site)}).join("");
  if(slot!=="bottom"){var h=document.querySelector("main h2");if(h&&d.title)h.textContent=d.title;var sb=h&&h.nextElementSibling;if(sb&&sb.classList.contains("sec-sub")&&d.subtitle)sb.innerHTML=md(d.subtitle)}
};
/* ---- home page ---- */
R["home-hero"]=function(el,d,site){
  el.innerHTML='<p class="eyebrow">'+md(d.eyebrow)+'</p><p class="role">'+md(d.role)+'</p><p class="statement">'+md(d.statement)+'</p><div class="links-row"><a class="btn primary" href="'+esc(d.primary_button.url)+'">'+esc(d.primary_button.label)+'</a><a class="btn" href="'+esc(d.secondary_button.url)+'">'+esc(d.secondary_button.label)+'</a></div>';
};
R["home-paths"]=function(el,d){el.innerHTML=d.pathways.map(function(p){return '<a class="path" href="'+esc(p.url)+'"><span class="num">'+esc(p.label)+'</span><strong>'+md(p.title)+'</strong><span>'+md(p.text)+'</span><span class="go">'+esc(p.link_label)+'</span></a>'}).join("")};
R["home-selected"]=function(el,d){el.innerHTML='<h2 id="selected-research">'+md(d.selected_heading)+'</h2><div class="grid selected">'+d.selected.map(function(x){return '<article class="sel-card"><p class="status">'+md(x.status)+'</p><h3 class="h4">'+md(x.title)+'</h3><p>'+md(x.text)+'</p><p><a class="more" href="'+esc(x.url)+'">'+esc(x.link_label||"Learn more →")+'</a></p></article>'}).join("")+'</div>'};
R["home-profiles"]=function(el,d,site){el.innerHTML='<h2 id="profiles">'+md(d.profiles_heading)+'</h2><p class="ext-links">'+profiles(site," ")+" "+link(d.cv_url,esc(d.cv_label))+'</p>'};
R["banner-areas"]=function(el,d,site){if(site.banner_areas)el.textContent=site.banner_areas};
R["banner-field"]=function(el,d,site){if(site.banner_field)el.textContent=site.banner_field};

var files={publications:"publications",research:"research","research-lead":"research","research-areas":"research","research-current":"research","research-previous":"research",projects:"projects",lectures:"lectures","home-hero":"pages/home","home-paths":"pages/home","home-selected":"pages/home","home-profiles":"pages/home"};
var cache={};function load(n){return cache[n]||(cache[n]=get(n))}
var pending=[];
document.querySelectorAll("[data-render]").forEach(function(el){var k=el.getAttribute("data-render"),f=files[k];
  if(k==="page")f="pages/"+el.getAttribute("data-file");
  var need=f?(Array.isArray(f)?f:[f]):[];
  pending.push(Promise.all(need.map(load).concat([load("site")])).then(function(r){var site=r.pop();R[k](el,need.length>1?r:r[0]||null,site)}).catch(function(){}));});
Promise.all(pending).then(function(){if(location.hash)window.dispatchEvent(new Event("hashchange"))});
})();
