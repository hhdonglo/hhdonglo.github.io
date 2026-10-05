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
    h+='<article class="ov-card wide"'+(g.id?' id="'+esc(g.id)+'"':'')+'><h3 class="h4">'+esc(g.title)+'</h3>'+(g.note?'<p class="note">'+md(g.note)+'</p>':'')+'<ul class="refs">'+g.items.map(function(i){return '<li data-year="'+esc(i.tag)+'">'+md(i.text)+'</li>'}).join("")+'</ul></article>';});
  el.innerHTML=h+'</div>';
  var bs=el.querySelectorAll(".pub-filter button"),lis=el.querySelectorAll(".refs li[data-year]"),cards=el.querySelectorAll(".ov-grid .ov-card"),c=el.querySelector("#pub-count");
  function run(f){var n=0;lis.forEach(function(l){var v=f==="all"||l.dataset.year===f;l.hidden=!v;if(v)n++});cards.forEach(function(k){k.hidden=!k.querySelector("li:not([hidden])")});bs.forEach(function(b){b.setAttribute("aria-pressed",b.dataset.f===f?"true":"false")});c.textContent=n+(n===1?" item shown":" items shown")}
  bs.forEach(function(b){b.addEventListener("click",function(){run(b.dataset.f)})});run("all");
};
R["pubs-home"]=function(el,d){el.innerHTML=d.home.map(function(i){return '<li><span class="yr">'+esc(i.label)+'</span><span>'+md(i.text)+'</span></li>'}).join("")};
R["research-lead"]=function(el,d){el.innerHTML='<h3 class="h4">'+md(d.overview_title||"Research Overview")+'</h3><p class="intro"><strong>'+md(d.question)+'</strong></p><p class="intro">'+md(d.intro)+'</p>'};
R["research-pubs"]=function(el,d){el.innerHTML='<p>'+md(d.publications_text)+'</p><p><a class="btn primary" href="publications.html">'+esc(d.publications_link_label||"View all publications")+'</a></p>'};
R["research-areas"]=function(el,d){el.innerHTML=d.areas.map(function(a,i){return '<article class="ov-card area"'+(a.id?' id="'+esc(a.id)+'"':'')+'><p class="num">'+("0"+(i+1)).slice(-2)+'</p><h4>'+md(a.title)+'</h4><p>'+md(a.text)+'</p></article>'}).join("")};
function cards(list,past){return list.map(function(c){return '<article class="ov-card"><p class="status'+(past?' past':'')+'">'+md(c.status)+'</p><h4>'+md(c.title)+'</h4>'+c.paragraphs.map(function(p){return '<p>'+md(p)+'</p>'}).join("")+'</article>'}).join("")}
R["research-current"]=function(el,d){el.innerHTML=cards(d.current,false)};
R["research-previous"]=function(el,d){el.innerHTML=cards(d.previous,true)};
R["research-chips"]=function(el,d){el.innerHTML=d.current.map(function(c){return '<li>'+md(c.chip||c.title)+'</li>'}).join("")};
function fig1(f){var img='<img src="'+esc(f.image)+'" width="'+f.width+'" height="'+f.height+'" alt="'+esc(f.alt)+'" loading="lazy">';return '<figure class="fig">'+(f.full?'<a class="zoom" href="'+esc(f.full)+'" data-full="'+esc(f.full)+'" aria-label="Enlarge figure: '+esc(f.caption)+'">'+img+'</a>':img)+'<figcaption>'+md(f.caption)+(f.full?' <span class="zoom-hint">Select the figure to enlarge.</span>':'')+(f.source?' <a href="'+esc(f.source)+'" rel="noopener">Source</a>':'')+'</figcaption></figure>'}
function figs(list){list=list||[];if(!list.some(function(f){return f.heading}))return list.map(fig1).join("");var g=[];list.forEach(function(f){if(f.heading||!g.length)g.push({h:f.heading,l:f.lead,f:[]});g[g.length-1].f.push(f)});return g.map(function(x){return '<div class="fig-group">'+(x.h?'<h5 class="fig-h">'+md(x.h)+'</h5>':'')+(x.l?'<p class="fig-lead">'+md(x.l)+'</p>':'')+'<div class="fig-row">'+x.f.map(fig1).join("")+'</div></div>'}).join("")}
R["data-engineering"]=function(el,d){
  var pr=d.programme;
  var h='<span id="data-ml"></span><section aria-labelledby="overview"><h3 class="sub2" id="overview">'+md(d.intro_title||"Overview")+'</h3><div class="ov-card"><p class="intro">'+md(d.intro)+'</p></div><div class="ov-card" id="certification"><h4>'+md(pr.title)+'</h4><p class="status">'+md(pr.subtitle)+'</p><p>'+md(pr.text)+'</p>'+list(pr.skills,"chips")+'<p>'+md(pr.note)+'</p></div></section>';
  if(d.upcoming&&d.upcoming.length)h+='<section aria-labelledby="upcoming"><h3 class="sub2" id="upcoming">'+md(d.upcoming_title||"Upcoming")+'</h3>'+d.upcoming.map(function(u){return '<article class="ov-card soon"><p class="soon-badge"><span class="soon-dot" aria-hidden="true"></span>'+md(u.status||"Coming soon")+'</p><h4>'+md(u.name)+'</h4>'+(u.tagline?'<p class="soon-tag">'+md(u.tagline)+'</p>':'')+(u.text?'<p>'+md(u.text)+'</p>':'')+(u.topics&&u.topics.length?list(u.topics,"chips"):'')+(u.note?'<p class="muted">'+md(u.note)+'</p>':'')+'</article>'}).join("")+'</section>';
  d.groups.forEach(function(g){
    h+='<section aria-labelledby="'+esc(g.id)+'"><h3 class="sub2" id="'+esc(g.id)+'">'+md(g.title)+'</h3><div class="ov-grid">'+g.projects.map(function(p){return '<article class="ov-card"><h4>'+md(p.title)+'</h4><p class="status">'+md(p.topics)+'</p>'+(p.scenario?'<p class="muted">'+md(p.scenario)+'</p>':'')+(p.sections||[]).map(function(x){return '<p><strong>'+md(x.label)+':</strong> '+md(x.text)+'</p>'}).join("")+figs(p.figures)+(p.repo?'<p><a class="btn" href="'+esc(p.repo)+'" rel="noopener">View on GitHub<span class="vh"> for '+esc(p.title)+'</span></a></p>':'')+'</article>'}).join("")+'</div></section>';});
  h+='<section aria-labelledby="de-tools"><h3 class="sub2" id="de-tools">'+md(d.tools_title)+'</h3><div class="ov-card"><dl class="tech">'+d.tool_groups.map(function(t){return '<dt>'+md(t.label)+':</dt><dd>'+md(t.items)+'</dd>'}).join("")+'</dl></div><p class="note">'+md(d.footnote)+'</p></section>';
  el.innerHTML=h;
};
R.projects=function(el,d){
  var h='<section aria-labelledby="overview"><h3 class="sub2" id="overview">'+md(d.intro_title||"Overview")+'</h3><div class="ov-card"><p class="intro">'+md(d.intro)+'</p></div></section>';
  if(d.research_projects)h+='<section aria-labelledby="research-projects"><h3 class="sub2" id="research-projects">'+md(d.research_projects_title||"Research projects")+'</h3><div class="ov-grid">'+d.research_projects.map(function(x){return '<article class="ov-card'+(x.figures&&x.figures.length?' wide':'')+'"'+(x.id?' id="'+esc(x.id)+'"':'')+'><p class="status">'+md(x.status)+'</p><h4>'+md(x.title)+'</h4>'+(x.topics?'<p class="status">'+md(x.topics)+'</p>':'')+(x.paragraphs||[]).map(function(q){return '<p>'+md(q)+'</p>'}).join("")+(x.figures&&x.figures.length?(x.figures.some(function(f){return f.heading})?figs(x.figures):'<div class="fig-row">'+figs(x.figures)+'</div>'):'')+'</article>'}).join("")+'</div></section>';
  if(d.software)h+='<section aria-labelledby="software"><h3 class="sub2" id="software">'+md(d.software.title)+'</h3><div class="ov-card"><p>'+md(d.software.text)+'</p><ul class="chips" aria-label="Tools">'+d.software.items.map(function(t){return '<li>'+md(t)+'</li>'}).join("")+'</ul></div></section>';
  el.innerHTML=h;
};
function flat(d){var o=[];d.groups.forEach(function(g){g.lectures.forEach(function(l){o.push({l:l,g:g})})});return o.sort(function(a,b){return a.l.number-b.l.number})}
function ln(n){return ("0"+n).slice(-2)}
function lpage(n){return "phys143-lecture-"+n+".html"}
function ppage(n){return "phys143-lecture-"+n+"-practice.html"}
R.weekly=function(el,d){
  el.innerHTML=d.groups.map(function(g){
    return '<div class="week-group" id="'+esc(g.id)+'"><h4 class="grp">'+md(g.title)+'</h4><p class="sec-sub">'+md(g.subtitle)+'</p><ul class="weeks">'+g.lectures.map(function(l){
      var n=l.number,soon=l.status==="soon";
      return '<li class="week'+(soon?' soon':'')+'" id="lecture-'+n+'"><span class="wk">Week '+n+'</span><span class="wt"><a href="'+lpage(n)+'">'+(soon?'Coming soon':md(l.title))+'</a><span class="state'+(soon?'':' ok')+'">'+(soon?'Coming soon':'Available')+'</span></span><span class="ws">'+md(soon?(l.note||"Materials are being prepared."):l.summary)+'</span>'+(soon?'':'<span class="wl">'+[wlink(l.slides,"Slides",n),wlink(l.supplement,"Supplementary",n),wlink(l.tutorial,"Tutorial",n),wlink(l.practice==="soon"?"":ppage(n),"Practice questions",n)].join(" ")+'</span>')+'</li>'}).join("")+'</ul></div>'}).join("");
};
function lbtn(url,label,n,primary){
  var sr='<span class="vh"> for lecture '+n+'</span>';
  if(!url)return '<span class="btn off" aria-disabled="true">'+esc(label)+'<small>Coming soon</small>'+sr+'</span>';
  return '<a class="btn'+(primary?' primary':'')+'" href="'+esc(url)+'">'+esc(label)+sr+'</a>';
}
function wlink(url,label,n){return url?'<a href="'+esc(url)+'">'+esc(label)+'<span class="vh"> for lecture '+n+'</span></a>':'<span class="muted">'+esc(label)+': coming soon</span>'}
R.lecture=function(el,d,site){
  var all=flat(d),n=+el.getAttribute("data-n"),i=all.findIndex(function(x){return x.l.number===n});if(i<0)return;
  var l=all[i].l,soon=l.status==="soon",course=d.course_title||"PHYS 143",title="Lecture "+ln(n)+" — "+(soon?"Coming soon":l.title);
  var h=document.querySelector("main h2");if(h)h.textContent=title;
  var sb=h&&h.nextElementSibling;if(sb&&sb.classList.contains("sec-sub"))sb.innerHTML=md(soon?(l.note||"Materials are being prepared."):l.summary);
  var cr=document.querySelector("main .crumb");if(cr)cr.innerHTML='<a href="index.html">Home</a> &rsaquo; <a href="teaching.html">Teaching</a> &rsaquo; <a href="phys143.html">'+esc(course)+'</a> &rsaquo; Lecture '+ln(n);
  document.title=title+" | "+course+" | Hope Donglo";
  var out='';
  if(soon){out+='<div class="ov-card"><p>This lecture will be added when it is ready.</p></div>'}
  else{
    out+='<div class="lecture-buttons" role="group" aria-label="Lecture resources">'+lbtn(l.slides,"Open lecture slides",n,true)+lbtn(l.supplement,"Supplementary",n)+lbtn(l.tutorial,"Tutorial",n)+lbtn(l.practice==="soon"?"":ppage(n),"Practice questions",n)+'</div>';
    out+='<details class="fold" id="objectives" open><summary>Learning objectives</summary><div class="ov-card"><p>Students should be able to:</p>'+list(l.outcomes||[],"")+'</div></details>';
    var focus=l.contact_focus||[];
    (d.contacts||[]).forEach(function(c,k){
      out+='<details class="fold" id="contact-'+(k+1)+'"><summary>'+md(c.heading)+'</summary><div class="ov-card"><p>'+md(c.purpose)+(focus[k]?' <span class="muted">Focus: '+esc(focus[k])+'.</span>':'')+'</p></div></details>';});
  }
  var prev=all[i-1],next=all[i+1];
  out+='<nav class="pager" aria-label="Lecture navigation">'+(prev?'<a class="prev" href="'+lpage(prev.l.number)+'">&larr; Lecture '+ln(prev.l.number)+'</a>':'<span></span>')+'<a class="toc" href="phys143.html#weekly">'+esc(course)+' contents</a>'+(next?'<a class="next" href="'+lpage(next.l.number)+'">Lecture '+ln(next.l.number)+' &rarr;</a>':'<span></span>')+'</nav>';
  el.innerHTML=out;
  if(location.hash==="#practice"&&!soon&&l.practice!=="soon")location.replace(ppage(n));
};
R.profiles=function(el,d,site){el.innerHTML=profiles(site," ")};
R.contact=function(el,d,site){
  el.innerHTML='<ul class="contact-list"><li><span>Office</span> '+esc(site.office)+'</li><li><span>Email</span> '+link("mailto:"+site.email,esc(site.email))+(site.email_alt?' or '+link("mailto:"+site.email_alt,esc(site.email_alt)):'')+'</li><li><span>Tel.</span> '+link("tel:"+site.phone_link,esc(site.phone_display))+'</li></ul>';
};
R["contact-profiles"]=function(el,d,site){el.innerHTML=site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")};
R["contact-mail"]=function(el,d,site){el.setAttribute("href","mailto:"+site.email);el.textContent="Email "+site.email};
R.footer=function(el,d,site){
  var navs=[["research.html","Research"],["teaching.html","Teaching"],["projects.html","Projects"],["data-engineering.html","Data Science, ML and Engineering"],["about.html","About"],["cv.html","CV"],["contact.html","Contact"]];
  el.innerHTML='<div class="wrap"><div class="foot-grid"><div><p class="foot-name">'+esc(site.name)+'</p><p>'+esc(site.footer_position||site.field)+'</p></div><nav aria-label="Footer"><ul>'+navs.map(function(n){return '<li>'+link(n[0],n[1])+'</li>'}).join("")+'</ul></nav><ul class="foot-ext">'+site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).join("")+'</ul></div><p class="foot-note">'+esc(site.footer_note)+(site.goatcounter_code&&site.privacy_note?' · '+esc(site.privacy_note):'')+'</p></div>';
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
R["home-side"]=function(el,d,site){
  el.innerHTML='<picture><source media="(max-width:760px)" srcset="assets/hope-donglo-square.webp" width="720" height="720"><img class="photo" src="assets/hope-donglo-portrait.webp" width="640" height="800" alt="Hope Donglo smiling outdoors in glasses and a white T-shirt, holding a straw hat, with a pond and trees behind"></picture><p class="name">'+md(d.eyebrow)+'</p><p class="role">'+md(d.role)+'</p>'+(d.affiliation?'<p class="role">'+md(d.affiliation)+'</p>':"")+'<ul class="side-links">'+site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).concat((d.side_links||[]).map(function(l){return '<li>'+link(l.url,esc(l.label))+'</li>'})).join("")+'</ul>';
};
R["home-statement"]=function(el,d){el.innerHTML=md(d.statement)};
R["home-working"]=function(el,d){el.innerHTML='<h2 class="h3" id="working">'+md(d.working_title)+'</h2><div class="cw-grid">'+d.working.map(function(g){return '<article class="cw"><h3 class="h4"><a href="'+esc(g.url)+'">'+md(g.title)+'</a></h3><p>'+md(g.text)+'</p><p><a href="'+esc(g.url)+'">'+esc(g.link)+' &#8594;</a></p></article>'}).join("")+'</div>'};
R["home-highlights"]=function(el,d){el.classList.toggle('three',d.highlights.length>=3);el.innerHTML=(d.highlights_title?'<h2 class="h3 hl-title" id="research-home">'+md(d.highlights_title)+'</h2>':'')+'<div class="hl-grid">'+d.highlights.map(function(h){return '<article class="ov-card">'+(h.figure==="fusion"?'<svg class="fuse" viewBox="0 0 240 90" role="img" aria-label="'+esc(h.figure_alt||"")+'" focusable="false"><path class="arr" d="M82 45h26M158 45h-26" /><circle class="n1" cx="60" cy="45" r="14"/><circle class="n2" cx="180" cy="45" r="18"/><circle class="ring" cx="120" cy="45" r="26"/><circle class="nf" cx="120" cy="45" r="22"/></svg>':'')+'<h2 class="h4">'+md(h.title)+'</h2><p>'+md(h.text)+'</p><p><a class="btn" href="'+esc(h.url)+'">'+md(h.button)+'</a></p></article>'}).join("")+'</div>'}
R["home-technical"]=function(el,d){var b=d.technical_button;el.innerHTML='<article class="ov-card"><h2 class="h3" id="technical">'+md(d.technical_title)+'</h2><p>'+md(d.technical_text)+'</p>'+(b?'<p class="tech-btn"><a class="btn" href="'+esc(b.url)+'">'+md(b.label)+'</a></p>':'')+'</article>'};
R["home-stats"]=function(el,d){var h=d[0],L=d[1],P=d[2];var cnt={lectures:function(){var n=0;(L.groups||[]).forEach(function(g){(g.lectures||[]).forEach(function(x){if(x.status==="available")n++})});return n},projects:function(){var n=0;(P.groups||[]).forEach(function(g){n+=(g.projects||[]).length});return n}};el.innerHTML=(h.stats_title?'<h2 class="h3" id="glance">'+md(h.stats_title)+'</h2>':'')+'<ul class="stat-list">'+h.stats.map(function(s){var v=s.source&&cnt[s.source]?String(cnt[s.source]()):s.value;return v?'<li><span class="stat-n" data-n="'+esc(v)+'" data-suffix="'+esc(s.suffix||"")+'">'+esc(v)+esc(s.suffix||"")+'</span><span class="stat-l">'+md(s.label)+'</span></li>':'<li class="stat-text"><span class="stat-l">'+md(s.label)+'</span></li>'}).join("")+'</ul>'};
R["home-soon"]=function(el,d){var s=d.soon;if(!s||!s.name){el.hidden=true;return}el.hidden=false;el.innerHTML='<a class="soon-strip" href="'+esc(s.url)+'"><span class="soon-badge"><span class="soon-dot" aria-hidden="true"></span>'+md(s.status||"Coming soon")+'</span><span class="soon-txt"><strong>'+md(s.name)+'</strong>'+(s.tagline?'<span>'+md(s.tagline)+'</span>':'')+'</span><span class="soon-go">'+md(s.link_text||"Read more")+' <span aria-hidden="true">&rarr;</span></span></a>'};
R["home-cta"]=function(el,d){var c=d.cta;el.innerHTML='<h2 class="h3" id="cta">'+md(c.title)+'</h2><p>'+md(c.text)+'</p><p class="cta-btns">'+c.buttons.map(function(b,i){return '<a class="btn'+(i?' alt':'')+'" href="'+esc(b.url)+'">'+md(b.label)+'</a>'}).join("")+'</p>'};
R["home-teaching"]=function(el,d){var t=d.teaching_block;if(!t){el.hidden=true;return}el.innerHTML='<article class="ov-card"><h2 class="h3" id="teaching-home">'+md(t.title)+'</h2><p>'+md(t.text)+'</p>'+(t.items&&t.items.length?'<p class="muted">'+md(t.list_intro||"")+'</p>'+list(t.items,"chips"):'')+(t.button?'<p><a class="btn" href="'+esc(t.button.url)+'">'+md(t.button.label)+'</a></p>':'')+'</article>'};
R["home-academic"]=function(el,d){var a=d.academic;if(!a||!a.title){el.hidden=true;return}el.hidden=false;el.innerHTML='<article class="ov-card"><h2 class="h3" id="academic">'+md(a.title)+'</h2>'+(a.paragraphs||[]).map(function(p){return '<p>'+md(p)+'</p>'}).join("")+(a.button?'<p><a class="btn alt" href="'+esc(a.button.url)+'">'+md(a.button.label)+'</a></p>':'')+'</article>'};
R["home-blocks"]=function(el,d){el.innerHTML=d.blocks.map(function(p){return '<div class="hl"><h3 class="h4"><a href="'+esc(p.url)+'">'+md(p.title)+'</a></h3><ul>'+p.links.map(function(i){return '<li>'+link(i.url,esc(i.label))+'</li>'}).join("")+'</ul></div>'}).join("")};
R["home-intro"]=function(el,d){el.innerHTML='<article class="ov-card lead-card">'+d.intro_paragraphs.map(function(p){return '<p class="intro">'+md(p)+'</p>'}).join("")+'</article>'};
R["home-pubs"]=function(el,d){var h=d[0],p=d[1];el.innerHTML='<h2 id="selected-pubs">'+md(h.publications_heading)+'</h2><ul class="refs sel">'+p.home.map(function(i){return '<li><span class="yr">'+esc(i.label)+'</span><span>'+md(i.text)+'</span></li>'}).join("")+'</ul><p><a class="more" href="publications.html">'+esc(h.publications_link_label)+'</a></p>'};
R["home-areas"]=function(el,d){el.innerHTML='<h2 id="areas">'+md(d.areas_heading)+'</h2><div class="grid shortcuts">'+d.areas.map(function(a){return '<div class="ov-card"><h3 class="h4">'+md(a.title)+'</h3><p>'+md(a.text)+'</p></div>'}).join("")+'</div>'};
R["banner-areas"]=function(el,d){if(d&&d.hero_line1)el.innerHTML='<span class="l1">'+md(d.hero_line1)+'</span><span class="l2">'+md(d.hero_line2||"")+'</span>'};
R["banner-field"]=function(el,d,site){if(site.banner_field)el.textContent=site.banner_field};

var files={publications:"publications",research:"research","research-lead":"research","research-areas":"research","research-current":"research","research-previous":"research","research-pubs":"research",projects:"projects","data-engineering":"data-engineering",weekly:"lectures",lecture:"lectures","home-side":"pages/home","home-soon":"pages/home","home-teaching":"pages/home","home-academic":"pages/home","home-stats":["pages/home","lectures","data-engineering"],"home-statement":"pages/home","home-intro":"pages/home","home-blocks":"pages/home","home-working":"pages/home","home-cta":"pages/home","banner-areas":"pages/home","home-highlights":"pages/home","home-technical":"pages/home","home-pubs":["pages/home","publications"],"home-areas":"pages/home"};
var cache={};function load(n){return cache[n]||(cache[n]=get(n))}
var pending=[];
document.querySelectorAll("[data-render]").forEach(function(el){var k=el.getAttribute("data-render"),f=files[k];
  if(k==="page")f="pages/"+el.getAttribute("data-file");
  var need=f?(Array.isArray(f)?f:[f]):[];
  pending.push(Promise.all(need.map(load).concat([load("site")])).then(function(r){var site=r.pop();R[k](el,need.length>1?r:r[0]||null,site)}).catch(function(){}));});
load("pages/home").then(function(h){document.querySelectorAll("#jump-links .dd").forEach(function(dd){var u=dd.getAttribute("data-key"),b=h.blocks.filter(function(x){return x.url===u})[0];if(b)dd.querySelector(".sub").innerHTML=b.links.map(function(i){return '<li>'+link(i.url,esc(i.label))+'</li>'}).join("")})}).catch(function(){});
Promise.all(pending).then(function(){if(location.hash)window.dispatchEvent(new Event("hashchange"))});
})();
