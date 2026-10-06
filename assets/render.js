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
function plinks(ls){ls=(ls||[]).filter(function(x){return x&&x.url});return ls.length?' <span class="pub-links">'+ls.map(function(x){return '<a class="pub-link" href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label||"Link")+' &#8599;<span class="vh"> (opens in a new tab)</span></a>'}).join("")+'</span>':""}
R.publications=function(el,d,site){
  var h='<div class="pub-filter" role="group" aria-label="Filter by year">'+d.filters.map(function(f,i){return '<button type="button" class="btn" data-f="'+esc(f.id)+'" aria-pressed="'+(i===0)+'">'+esc(f.label)+'</button>'}).join("")+'</div>';
  h+='<p class="note" id="pub-count" aria-live="polite"></p>';
  h+='<p class="ext-links">Full list on '+link(site.profiles[0].url,"Google Scholar &#8599;",true)+" "+link(site.profiles[1].url,"ORCID &#8599;",true)+'</p><div class="ov-grid">';
  d.groups.forEach(function(g){
    h+='<article class="ov-card wide"'+(g.id?' id="'+esc(g.id)+'"':'')+'><h3 class="h4">'+esc(g.title)+'</h3>'+(g.note?'<p class="note">'+md(g.note)+'</p>':'')+'<ul class="refs">'+g.items.map(function(i){return '<li data-year="'+esc(i.tag)+'">'+md(i.text)+plinks(i.links)+'</li>'}).join("")+'</ul></article>';});
  el.innerHTML=h+'</div>';
  var bs=el.querySelectorAll(".pub-filter button"),lis=el.querySelectorAll(".refs li[data-year]"),cards=el.querySelectorAll(".ov-grid .ov-card"),c=el.querySelector("#pub-count");
  function run(f){var n=0;lis.forEach(function(l){var v=f==="all"||l.dataset.year===f;l.hidden=!v;if(v)n++});cards.forEach(function(k){k.hidden=!k.querySelector("li:not([hidden])")});bs.forEach(function(b){b.setAttribute("aria-pressed",b.dataset.f===f?"true":"false")});c.textContent=n+(n===1?" item shown":" items shown")}
  bs.forEach(function(b){b.addEventListener("click",function(){run(b.dataset.f)})});run("all");
};
R["pubs-home"]=function(el,d){el.innerHTML=d.home.map(function(i){return '<li><span class="yr">'+esc(i.label)+'</span><span>'+md(i.text)+plinks(i.links)+'</span></li>'}).join("")};
R["research-lead"]=function(el,d){el.innerHTML='<h3 class="h4">'+md(d.overview_title||"Research Overview")+'</h3><p class="intro"><strong>'+md(d.question)+'</strong></p><p class="intro">'+md(d.intro)+'</p>'};
R["research-pubs"]=function(el,d){el.innerHTML='<p>'+md(d.publications_text)+'</p><p><a class="btn primary" href="publications.html">'+esc(d.publications_link_label||"View all publications")+'</a></p>'};
R["research-questions"]=function(el,d){el.innerHTML='<h4>'+md(d.challenge_title)+'</h4><p class="intro">'+md(d.challenge_text)+'</p><p class="intro">'+md(d.challenge_text2)+'</p><h4>Research questions</h4><ul class="rq">'+d.questions.map(function(q){return '<li>'+md(q)+'</li>'}).join("")+'</ul><p><a href="kewpie3.html">KEWPIE3 →</a></p>'};
R["research-background"]=function(el,d){var b=d.background;el.innerHTML='<section aria-labelledby="background"><h3 class="sub2" id="background">'+md(b.title)+'</h3><div class="ov-card">'+b.paragraphs.map(function(p){return '<p class="intro">'+md(p)+'</p>'}).join("")+'</div><div class="ov-grid">'+b.cards.map(function(c){return '<article class="ov-card"><h4>'+md(c.title)+'</h4>'+list(c.bullets,"")+'</article>'}).join("")+'</div></section>'};
R["research-more"]=function(el,d){var m=d.more;el.innerHTML='<section aria-labelledby="interests"><h3 class="sub2" id="interests">'+md(m.interests_title)+'</h3><div class="ov-card"><ul class="chips">'+m.interests.map(function(x){return '<li>'+md(x)+'</li>'}).join("")+'</ul></div></section><section aria-labelledby="why"><h3 class="sub2" id="why">'+md(m.why_title)+'</h3><div class="ov-card">'+m.why.map(function(x){return '<p>'+md(x)+'</p>'}).join("")+list(m.why_list,"")+'</div></section><section aria-labelledby="approach"><h3 class="sub2" id="approach">'+md(m.approach_title)+'</h3><div class="ov-card"><p>'+md(m.approach_intro)+'</p>'+list(m.approach_list,"")+'<p>'+md(m.approach_end)+'</p></div></section><section aria-labelledby="closing"><h3 class="sub2" id="closing">'+md(m.closing_title)+'</h3><div class="ov-card"><p class="intro">'+md(m.closing)+'</p></div></section>'};
R["research-areas"]=function(el,d){el.innerHTML=d.areas.map(function(a,i){var lk=a.link&&a.equation;return '<article class="ov-card area'+(lk?' link-card wide':'')+'"'+(a.id?' id="'+esc(a.id)+'"':'')+'><p class="num">'+("0"+(i+1)).slice(-2)+'</p><h4>'+(lk?'<a class="card-link" href="'+esc(a.link)+'">'+md(a.title)+'<span class="vh"> (read more)</span></a>':md(a.title))+'</h4>'+(a.equation&&a.text?'<p>'+md(a.text)+'</p>':'')+(a.equation?(a.equation_label?'<p class="eq-label">'+md(a.equation_label)+'</p>':'')+'<div class="eq area-eq" role="group" tabindex="0" aria-label="Evaporation-residue cross section equation"><span class="tex" data-tex="'+esc(a.equation)+'">'+esc(a.equation)+'</span></div>':'<p>'+md(a.text)+'</p>')+(lk?'<p class="more" aria-hidden="true">'+esc(a.link_label||"Read more")+' →</p>':'')+'</article>'}).join("");texRender(el)};
function ftext(t){t=t||[];if(t.length&&t.every(function(q){return /^- /.test(q)}))return '<ul class="plain">'+t.map(function(q){return '<li>'+md(q.slice(2))+'</li>'}).join("")+'</ul>';return t.map(function(q){return '<p>'+md(q)+'</p>'}).join("")}
R["reaction-dynamics-page"]=function(el,d){
  var wrapN=0;
  var h=(d.intro?'<div class="ov-card"><p class="intro">'+md(d.intro)+'</p></div>':'');
  h+=(d.sections||[]).map(function(s){
    var b='<section aria-labelledby="'+esc(s.id)+'"><h3 class="sub2" id="'+esc(s.id)+'">'+md(s.heading)+'</h3><div class="ov-card">';
    b+=(s.paragraphs||[]).map(function(q){return '<p>'+md(q)+'</p>'}).join("");
    if(s.steps&&s.steps.length)b+='<ol class="steps">'+s.steps.map(function(t){return '<li class="step step-'+esc(t.tag||"")+'"><strong>'+md(t.title)+'</strong> '+md(t.text)+'</li>'}).join("")+'</ol>';
    if(s.bullets&&s.bullets.length)b+='<ul class="plain">'+s.bullets.map(function(q){return '<li>'+md(q)+'</li>'}).join("")+'</ul>';
    b+=(s.equations||[]).map(function(q,i){return '<div class="eq-item"><div class="eq" role="group" tabindex="0" aria-label="Equation '+(i+1)+'"><span class="tex" data-tex="'+esc(q.tex)+'">'+esc(q.tex)+'</span></div><p class="eq-text">'+md(q.text||"")+'</p></div>'}).join("");
    var rowF=(s.figures||[]).filter(function(f){return f.row}),wrapF=(s.figures||[]).filter(function(f){return !f.row});
    b+=rowF.map(function(f){return '<div class="fig-solo">'+fig1(f)+'</div>'}).join("");
    b+=(s.after||[]).map(function(q){return '<p>'+md(q)+'</p>'}).join("");
    if(s.figures&&s.figures.length&&s.figure_row)b+='<div class="fig-pair">'+s.figures.map(fig1).join("")+'</div>';
    else if(wrapF.length)b+=wrapF.map(function(f){var side=(wrapN++%2)?"left":"right";return '<div class="fig-wrap fw-'+side+'">'+fig1(f).replace('<figure class="fig"','<figure class="fig" style="--fw:'+(f.height>f.width*1.2?Math.min(+f.width,340):(+f.width||420))+'px;--fmax:'+(+f.display_width||440)+'px;--fwp:'+((+f.display_width||0)>440?'54%':'46%')+'"')+ftext(f.text)+'</div>'}).join("");
    return b+'</div></section>'}).join("");
  if(d.references&&d.references.length)h+='<section aria-labelledby="refs-h"><h3 class="sub2" id="refs-h">References</h3><div class="ov-card refs">'+d.references.map(function(q){return '<p>'+md(q)+'</p>'}).join("")+'</div></section>';
  el.innerHTML=h;texRender(el);
  var h2=document.querySelector("main h2");if(h2&&d.title)h2.textContent=d.title;var sb=h2&&h2.nextElementSibling;if(sb&&sb.classList.contains("sec-sub")&&d.subtitle)sb.innerHTML=md(d.subtitle);
};
function cards(list,past){return list.map(function(c){var lk=!!c.url;return '<article class="ov-card'+(lk?' link-card':'')+'"><p class="status'+(past?' past':'')+'">'+md(c.status)+'</p><h4>'+(lk?'<a class="card-link" href="'+esc(c.url)+'">'+md(c.title)+'</a>':md(c.title))+'</h4>'+c.paragraphs.map(function(p){return '<p>'+md(p)+'</p>'}).join("")+(c.links&&c.links.some(function(x){return x.url})?'<p class="card-links">'+plinks(c.links)+'</p>':'')+(lk?'<p class="more" aria-hidden="true">'+esc(c.more||"Read more")+' →</p>':'')+'</article>'}).join("")}

R["research-current"]=function(el,d){el.innerHTML=cards(d.current,false)};
R["research-previous"]=function(el,d){
  var L=d.previous,h="";
  L.forEach(function(c,i){var sm=!!c.summary;h+='<article class="ov-card prev'+(sm?' link-card':'')+'" style="--i:'+i+'"><p class="status past">'+md(c.status)+'</p><h4>'+md(c.title)+'</h4>'+c.paragraphs.map(function(p){return '<p>'+md(p)+'</p>'}).join("")+(sm?'<p class="more"><button type="button" class="sum-btn" aria-expanded="false" aria-controls="sum-'+i+'">'+esc(c.more||"Summary and key results")+'<span class="vh"> for '+esc(c.title)+'</span> <span aria-hidden="true" class="chev">▾</span></button></p>':'')+'</article>'});
  L.forEach(function(c,i){if(!c.summary)return;h+='<section class="ov-card sum-panel" id="sum-'+i+'" style="--i:'+i+'" aria-labelledby="sum-h-'+i+'" hidden><div class="sum-head"><h4 id="sum-h-'+i+'">'+md(c.summary_title||c.title)+'</h4><button type="button" class="sum-close" data-for="'+i+'">Close<span class="vh"> summary</span></button></div>'+(c.meta?'<p class="status past">'+md(c.meta)+'</p>':'')+'<p>'+md(c.summary)+'</p><h5 class="sum-sub">'+md(c.results_title||"Key results")+'</h5><ul class="plain">'+(c.key_results||[]).map(function(q){return '<li>'+md(q)+'</li>'}).join("")+'</ul>'+(c.links&&c.links.some(function(x){return x.url})?'<p class="card-links">'+plinks(c.links)+'</p>':'')+'</section>'});
  el.style.setProperty('--n',Math.min(L.length,3));el.innerHTML=h;
  function show(i,on){var p=el.querySelector("#sum-"+i),b=el.querySelector('.sum-btn[aria-controls="sum-'+i+'"]');if(!p)return;p.hidden=!on;if(b)b.setAttribute("aria-expanded",on?"true":"false");if(b&&b.closest(".prev"))b.closest(".prev").classList.toggle("open",on)}
  function closeAll(){L.forEach(function(c,i){show(i,false)})}
  el.addEventListener("click",function(e){var b=e.target.closest(".sum-btn,.sum-close");if(!b)return;if(b.classList.contains("sum-close")){var i=b.getAttribute("data-for");show(i,false);var o=el.querySelector('.sum-btn[aria-controls="sum-'+i+'"]');if(o)o.focus();return}var id=b.getAttribute("aria-controls").slice(4),open=b.getAttribute("aria-expanded")==="true";closeAll();if(!open)show(id,true)});
  el.addEventListener("keydown",function(e){if(e.key==="Escape"){var o=el.querySelector('.sum-btn[aria-expanded="true"]');if(o){closeAll();o.focus()}}});
  el.querySelectorAll(".prev.link-card").forEach(function(card){card.addEventListener("click",function(e){if(e.target.closest("a,button"))return;var b=card.querySelector(".sum-btn");if(b)b.click()})});
};
R["research-chips"]=function(el,d){el.innerHTML=d.current.map(function(c){return '<li>'+md(c.chip||c.title)+'</li>'}).join("")};
function fig1(f){var img='<img src="'+esc(f.image)+'" width="'+f.width+'" height="'+f.height+'" alt="'+esc(f.alt)+'" loading="lazy">';return '<figure class="fig">'+(f.full?'<a class="zoom" href="'+esc(f.full)+'" data-full="'+esc(f.full)+'" aria-label="Enlarge figure: '+esc(f.caption)+'">'+img+'</a>':img)+'<figcaption>'+md(f.caption)+(f.credit?'<span class="credit">'+md(f.credit)+'</span>':'')+(f.full?' <span class="zoom-hint">Select the figure to enlarge.</span>':'')+(f.source?' <a href="'+esc(f.source)+'" rel="noopener">Source</a>':'')+'</figcaption></figure>'}
function figs(list){list=list||[];if(!list.some(function(f){return f.heading}))return list.map(fig1).join("");var g=[];list.forEach(function(f){if(f.heading||!g.length)g.push({h:f.heading,l:f.lead,f:[]});g[g.length-1].f.push(f)});return g.map(function(x){return '<div class="fig-group">'+(x.h?'<h5 class="fig-h">'+md(x.h)+'</h5>':'')+(x.l?'<p class="fig-lead">'+md(x.l)+'</p>':'')+'<div class="fig-row">'+x.f.map(fig1).join("")+'</div></div>'}).join("")}
R["data-engineering"]=function(el,d){
  var pr=d.programme,cp=d.computing;
  var h='<span id="data-ml"></span><section aria-labelledby="physics"><h3 class="sub2" id="physics">'+md(d.intro_title)+'</h3><div class="ov-card"><p class="intro">'+md(d.intro)+'</p>'+(cp?'<p>'+md(cp.text)+'</p>':'')+'</div></section>';
  h+='<section aria-labelledby="areas"><h3 class="sub2" id="areas">'+md(d.areas_title)+'</h3><div class="ov-grid">'+d.areas.map(function(a){return '<article class="ov-card fh-block" id="'+esc(a.id)+'"><h4 class="fh-rule">'+md(a.title)+'</h4><p><strong>In the physics:</strong> '+md(a.physics)+'</p><p><strong>Where it applies:</strong> '+md(a.applies)+'</p><p><a href="'+esc(a.link)+'">'+esc(a.link_label)+'</a></p></article>'}).join("")+'</div></section>';
  if(d.upcoming&&d.upcoming.length)h+='<section aria-labelledby="upcoming"><h3 class="sub2" id="upcoming">'+md(d.upcoming_title||"Upcoming")+'</h3>'+d.upcoming.map(function(u){return '<article class="ov-card soon"><p class="soon-badge"><span class="soon-dot" aria-hidden="true"></span>'+md(u.status||"Coming soon")+'</p><h4>'+md(u.name)+'</h4>'+(u.tagline?'<p class="soon-tag">'+md(u.tagline)+'</p>':'')+(u.text?'<p>'+md(u.text)+'</p>':'')+(u.topics&&u.topics.length?list(u.topics,"chips"):'')+(u.note?'<p class="muted">'+md(u.note)+'</p>':'')+'</article>'}).join("")+'</section>';
  d.groups.forEach(function(g){
    h+='<section aria-labelledby="'+esc(g.id)+'"><h3 class="sub2" id="'+esc(g.id)+'">'+md(g.title)+'</h3><div class="ov-grid">'+g.projects.map(function(p){return '<article class="ov-card"><h4>'+md(p.title)+'</h4><p class="status">'+md(p.topics)+'</p>'+(p.scenario?'<p class="muted">'+md(p.scenario)+'</p>':'')+(p.sections||[]).map(function(x){return '<p><strong>'+md(x.label)+':</strong> '+md(x.text)+'</p>'}).join("")+figs(p.figures)+(p.repo?'<p><a class="btn" href="'+esc(p.repo)+'" rel="noopener">View on GitHub<span class="vh"> for '+esc(p.title)+'</span></a></p>':'')+'</article>'}).join("")+'</div></section>';});
  h+='<section aria-labelledby="training"><h3 class="sub2" id="training">Training</h3><div class="ov-card" id="certification"><h4>'+md(pr.title)+'</h4><p class="status">'+md(pr.subtitle)+'</p><p>'+md(pr.text)+'</p>'+list(pr.skills,"chips")+'<p>'+md(pr.note)+'</p></div></section>';
  h+='<section aria-labelledby="de-tools"><h3 class="sub2" id="de-tools">'+md(d.tools_title)+'</h3><div class="ov-card"><dl class="tech">'+d.tool_groups.map(function(t){return '<dt>'+md(t.label)+':</dt><dd>'+md(t.items)+'</dd>'}).join("")+'</dl></div><p class="note">'+md(d.footnote)+'</p></section>';
  el.innerHTML=h;
};
var katexP;
function loadKatex(){if(window.katex)return Promise.resolve();if(katexP)return katexP;katexP=new Promise(function(ok,no){var s=document.createElement("script");s.src="assets/katex/katex.min.js";s.onload=ok;s.onerror=no;document.head.appendChild(s)});return katexP}
function eqs(x){
  if(!x.equations||!x.equations.length)return "";
  var t=x.equations_title||"The physics in brief";
  return '<details class="eqs"><summary>'+esc(x.equations_summary||"Show the equations")+'</summary><div class="eqs-in"><h5>'+md(t)+'</h5>'+x.equations.map(function(q,i){return '<div class="eq-item"><div class="eq" role="group" tabindex="0" aria-label="Equation '+(i+1)+'"><span class="tex" data-tex="'+esc(q.tex)+'">'+esc(q.tex)+'</span></div><p class="eq-text">'+md(q.text||"")+'</p></div>'}).join("")+'</div></details>';
}
function texRender(root){
  var n=root.querySelectorAll(".tex[data-tex]");if(!n.length)return;
  loadKatex().then(function(){n.forEach(function(e){try{window.katex.render(e.getAttribute("data-tex"),e,{displayMode:true,throwOnError:false,trust:true,output:"htmlAndMathml"})}catch(_){}})}).catch(function(){});
}
R.projects=function(el,d){
  var h='<section aria-labelledby="overview"><h3 class="sub2" id="overview">'+md(d.intro_title||"Overview")+'</h3><div class="ov-card"><p class="intro">'+md(d.intro)+'</p></div></section>';
  if(d.research_projects)h+='<section aria-labelledby="research-projects"><h3 class="sub2" id="research-projects">'+md(d.research_projects_title||"Research projects")+'</h3><div class="ov-grid">'+d.research_projects.map(function(x){return '<article class="ov-card'+((x.figures&&x.figures.length)||(x.equations&&x.equations.length)?' wide':'')+'"'+(x.id?' id="'+esc(x.id)+'"':'')+'><p class="status">'+md(x.status)+'</p><h4>'+md(x.title)+'</h4>'+(x.topics?'<p class="status">'+md(x.topics)+'</p>':'')+(x.paragraphs||[]).map(function(q){return '<p>'+md(q)+'</p>'}).join("")+eqs(x)+(x.figures&&x.figures.length?(x.figures.some(function(f){return f.heading})?figs(x.figures):'<div class="fig-row">'+figs(x.figures)+'</div>'):'')+'</article>'}).join("")+'</div></section>';
  if(d.software)h+='<section aria-labelledby="software"><h3 class="sub2" id="software">'+md(d.software.title)+'</h3><div class="ov-card"><p>'+md(d.software.text)+'</p><ul class="chips" aria-label="Tools">'+d.software.items.map(function(t){return '<li>'+md(t)+'</li>'}).join("")+'</ul></div></section>';
  el.innerHTML=h;texRender(el);
};
function flat(d){var o=[];d.groups.forEach(function(g){g.lectures.forEach(function(l){o.push({l:l,g:g})})});return o.sort(function(a,b){return a.l.number-b.l.number})}
function ln(n){return ("0"+n).slice(-2)}
function lpage(n){return "phys143-lecture-"+n+".html"}
function ppage(n){return "phys143-lecture-"+n+"-practice.html"}
R.weekly=function(el,d){
  var co=d.course_outline,cof='';if(co&&co.url){cof='<p class="outline"><strong>'+esc(co.label||"Course outline")+':</strong> <span class="pdf-pair"><a href="'+esc(co.url)+'" target="_blank" rel="noopener">Preview<span class="vh"> '+esc(co.label||"course outline")+' (opens in a new tab)</span></a><a href="'+esc(co.url)+'" download>Download<span class="vh"> '+esc(co.label||"course outline")+'</span></a></span></p>'}
  var ol=d.official_listing;if(ol&&ol.url)cof+='<p class="outline"><a href="'+esc(ol.url)+'" target="_blank" rel="noopener">'+esc(ol.label||"Official course listing")+' ↗<span class="vh"> (opens in a new tab)</span></a></p>';
  el.innerHTML=cof+d.groups.map(function(g){
    return '<div class="week-group" id="'+esc(g.id)+'"><h4 class="grp">'+md(g.title)+'</h4><p class="sec-sub">'+md(g.subtitle)+'</p><ul class="weeks">'+g.lectures.map(function(l){
      var n=l.number,soon=l.status==="soon";
      return '<li class="week'+(soon?' soon':'')+'" id="lecture-'+n+'"><span class="wk">Week '+n+'</span><span class="wt"><a href="'+lpage(n)+'">'+(soon?'Coming soon':md(l.title))+'</a><span class="state'+(soon?'':' ok')+'">'+(soon?'Coming soon':'Available')+'</span></span><span class="ws">'+md(soon?(l.note||"Materials are being prepared."):l.summary)+'</span>'+(soon?'':'<span class="wl">'+[wlink(l.slides,"Slides",n),wlink(l.supplement,"Supplementary",n),wlink(l.tutorial,"Tutorial",n),wlink(l.practice==="soon"?"":ppage(n),"Practice questions",n)].join(" ")+'</span>')+'</li>'}).join("")+'</ul></div>'}).join("");
};
function isPdf(u){return /\.pdf(\?|#|$)/i.test(u||"")}
function lbtn(url,label,n,primary){
  var sr='<span class="vh"> for lecture '+n+'</span>';
  if(!url)return '<span class="btn off" aria-disabled="true">'+esc(label)+'<small>Coming soon</small>'+sr+'</span>';
  if(isPdf(url))return '<div class="res"><span class="res-l">'+esc(label)+'</span><span class="res-b"><a class="btn'+(primary?' primary':'')+'" href="'+esc(url)+'" target="_blank" rel="noopener">Preview'+sr+'<span class="vh"> (opens in a new tab)</span></a><a class="btn" href="'+esc(url)+'" download>Download'+sr+'</a></span></div>';
  return '<a class="btn'+(primary?' primary':'')+'" href="'+esc(url)+'">'+esc(label)+sr+'</a>';
}
function wlink(url,label,n){if(!url)return '<span class="muted">'+esc(label)+': coming soon</span>';var sr='<span class="vh"> '+esc(label)+' for lecture '+n+'</span>';if(isPdf(url))return '<span class="pdf-pair"><span class="pl">'+esc(label)+'</span><a href="'+esc(url)+'" target="_blank" rel="noopener">Preview'+sr+'<span class="vh"> (opens in a new tab)</span></a><a href="'+esc(url)+'" download>Download'+sr+'</a></span>';return '<a href="'+esc(url)+'">'+esc(label)+'<span class="vh"> for lecture '+n+'</span></a>'}
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
    out+='<div class="lecture-buttons" role="group" aria-label="Lecture resources">'+lbtn(l.slides,"Lecture slides",n,true)+lbtn(l.supplement,"Supplementary note",n)+lbtn(l.tutorial,"Tutorial sheet",n)+lbtn(l.practice==="soon"?"":ppage(n),"Practice questions",n)+'</div>';
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
  var navs=[["research.html","Research"],["teaching.html","Teaching"],["projects.html","Projects"],["data-engineering.html","Applied and Computational Work"],["about.html","About"],["cv.html","CV"],["contact.html","Contact"]];
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
  if(c.figure)h+='<figure class="fig"><img src="'+esc(c.figure)+'" loading="lazy" alt="'+esc(c.figure_alt||"")+'">'+(c.figure_caption?'<figcaption>'+md(c.figure_caption)+'</figcaption>':'')+'</figure>';
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
  el.innerHTML='<picture><source media="(max-width:760px)" srcset="assets/hope-donglo-square.webp" width="720" height="720"><img class="photo" src="assets/hope-donglo-portrait.webp" width="640" height="800" alt="Smiling lecturer outdoors in glasses and a white T-shirt, holding a straw hat, with a pond and trees behind"></picture>'+(d.eyebrow?'<p class="name">'+md(d.eyebrow)+'</p>':'')+'<p class="role">'+md(d.role)+'</p>'+(d.affiliation?'<p class="role">'+md(d.affiliation)+'</p>':"")+'<ul class="side-links">'+site.profiles.map(function(p){return '<li>'+link(p.url,esc(p.label)+" &#8599;",true)+'</li>'}).concat((d.side_links||[]).map(function(l){return '<li>'+link(l.url,esc(l.label))+'</li>'})).join("")+'</ul>';
};
R["home-statement"]=function(el,d){el.innerHTML=md(d.statement)};
R["home-working"]=function(el,d){el.innerHTML='<h2 class="h3" id="working">'+md(d.working_title)+'</h2><div class="cw-grid">'+d.working.map(function(g){return '<article class="cw"><h3 class="h4"><a href="'+esc(g.url)+'">'+md(g.title)+'</a></h3><p>'+md(g.text)+'</p><p><a href="'+esc(g.url)+'">'+esc(g.link)+' &#8594;</a></p></article>'}).join("")+'</div>'};
R["home-highlights"]=function(el,d){el.classList.toggle('three',d.highlights.length>=3);el.innerHTML=(d.highlights_title?'<h2 class="h3 hl-title" id="research-home">'+md(d.highlights_title)+'</h2>':'')+'<div class="hl-grid">'+d.highlights.map(function(h){return '<article class="ov-card">'+(h.figure==="fusion"?'<svg class="fuse" viewBox="0 0 240 90" role="img" aria-label="'+esc(h.figure_alt||"")+'" focusable="false"><path class="arr" d="M82 45h26M158 45h-26" /><circle class="n1" cx="60" cy="45" r="14"/><circle class="n2" cx="180" cy="45" r="18"/><circle class="ring" cx="120" cy="45" r="26"/><circle class="nf" cx="120" cy="45" r="22"/></svg>':'')+'<h2 class="h4">'+md(h.title)+'</h2><p>'+md(h.text)+'</p><p><a class="btn" href="'+esc(h.url)+'">'+md(h.button)+'</a></p></article>'}).join("")+'</div>'}
R["home-technical"]=function(el,d){var b=d.technical_button;el.innerHTML='<article class="ov-card"><h2 class="h3" id="technical">'+md(d.technical_title)+'</h2><p>'+md(d.technical_text)+'</p>'+(b?'<p class="tech-btn"><a class="btn" href="'+esc(b.url)+'">'+md(b.label)+'</a></p>':'')+'</article>'};
R["home-stats"]=function(el,d){var h=d[0],L=d[1],P=d[2];var cnt={lectures:function(){var n=0;(L.groups||[]).forEach(function(g){(g.lectures||[]).forEach(function(x){if(x.status==="available")n++})});return n},projects:function(){var n=0;(P.groups||[]).forEach(function(g){n+=(g.projects||[]).length});return n}};el.innerHTML=(h.stats_title?'<h2 class="h3" id="glance">'+md(h.stats_title)+'</h2>':'')+'<ul class="stat-list">'+h.stats.map(function(s){var v=s.source&&cnt[s.source]?String(cnt[s.source]()):s.value;return v?'<li><span class="stat-n" data-n="'+esc(v)+'" data-suffix="'+esc(s.suffix||"")+'">'+esc(v)+esc(s.suffix||"")+'</span><span class="stat-l">'+md(s.label)+'</span></li>':'<li class="stat-text"><span class="stat-l">'+md(s.label)+'</span></li>'}).join("")+'</ul>'};
R["home-soon"]=function(el,d){var s=d.soon;if(!s||!s.name){el.hidden=true;return}el.hidden=false;el.innerHTML='<a class="soon-strip" href="'+esc(s.url)+'"><span class="soon-badge"><span class="soon-dot" aria-hidden="true"></span>'+md(s.status||"Coming soon")+'</span><span class="soon-txt"><strong>'+md(s.name)+'</strong>'+(s.tagline?'<span>'+md(s.tagline)+'</span>':'')+'</span><span class="soon-go">'+md(s.link_text||"Read more")+' <span aria-hidden="true">&rarr;</span></span></a>'};
R["home-cta"]=function(el,d){var c=d.cta;el.innerHTML=(c.title?'<h2 class="h3" id="cta">'+md(c.title)+'</h2>':'')+(c.text?'<p>'+md(c.text)+'</p>':'')+'<p class="cta-btns">'+c.buttons.map(function(b,i){return '<a class="btn'+(i?' alt':'')+'" href="'+esc(b.url)+'">'+md(b.label)+'</a>'}).join("")+'</p>'};
R["home-teaching"]=function(el,d){var t=d.teaching_block;if(!t){el.hidden=true;return}el.innerHTML='<article class="ov-card"><h2 class="h3" id="teaching-home">'+md(t.title)+'</h2><p>'+md(t.text)+'</p>'+(t.items&&t.items.length?'<p class="muted">'+md(t.list_intro||"")+'</p>'+list(t.items,"chips"):'')+(t.button?'<p><a class="btn" href="'+esc(t.button.url)+'">'+md(t.button.label)+'</a></p>':'')+'</article>'};
R["home-academic"]=function(el,d){var a=d.academic;if(!a||!a.title){el.hidden=true;return}el.hidden=false;el.innerHTML='<article class="ov-card"><h2 class="h3" id="academic">'+md(a.title)+'</h2>'+(a.paragraphs||[]).map(function(p){return '<p>'+md(p)+'</p>'}).join("")+(a.button?'<p><a class="btn alt" href="'+esc(a.button.url)+'">'+md(a.button.label)+'</a></p>':'')+'</article>'};
R["home-blocks"]=function(el,d){el.innerHTML=d.blocks.map(function(p){return '<div class="hl"><h3 class="h4"><a href="'+esc(p.url)+'">'+md(p.title)+'</a></h3><ul>'+p.links.map(function(i){return '<li>'+link(i.url,esc(i.label))+'</li>'}).join("")+'</ul></div>'}).join("")};
R["home-intro"]=function(el,d){el.innerHTML='<article class="ov-card lead-card">'+d.intro_paragraphs.map(function(p){return '<p class="intro">'+md(p)+'</p>'}).join("")+'</article>'};
R["home-pubs"]=function(el,d){var h=d[0],p=d[1];el.innerHTML='<h2 id="selected-pubs">'+md(h.publications_heading)+'</h2><ul class="refs sel">'+p.home.map(function(i){return '<li><span class="yr">'+esc(i.label)+'</span><span>'+md(i.text)+plinks(i.links)+'</span></li>'}).join("")+'</ul><p><a class="more" href="publications.html">'+esc(h.publications_link_label)+'</a></p>'};
R["home-areas"]=function(el,d){el.innerHTML='<h2 id="areas">'+md(d.areas_heading)+'</h2><div class="grid shortcuts">'+d.areas.map(function(a){return '<div class="ov-card"><h3 class="h4">'+md(a.title)+'</h3><p>'+md(a.text)+'</p></div>'}).join("")+'</div>'};
R["fh-hero"]=function(el,d){el.innerHTML='<h2 class="fh-title" id="home-title">'+md(d.fh_headline)+'</h2><p class="fh-sub">'+md(d.fh_sub)+'</p><p class="intro">'+md(d.fh_intro)+'</p><ul class="fh-curious">'+d.fh_curious.map(function(q){return '<li><a href="'+esc(q.url)+'">'+md(q.q)+'</a></li>'}).join("")+'</ul>'};
R["fh-synth"]=function(el,d){var m=d.more.synth;el.innerHTML='<h3 class="sub2" id="synthesis">'+md(m.title)+'</h3><div class="ov-card"><p class="intro">'+md(m.text)+'</p><div class="eq fh-eq" role="group" tabindex="0" aria-label="Equation: evaporation-residue cross section equals capture cross section times compound-nucleus formation probability times survival probability"><span class="tex" data-tex="'+esc(m.tex)+'">'+esc(m.tex)+'</span></div><p class="intro">'+md(m.text2)+'</p><figure class="fh-fig"><img src="'+esc(m.figure)+'" width="720" height="300" alt="'+esc(m.figure_alt)+'"><figcaption>'+md(m.figure_caption)+'</figcaption></figure></div>';texRender(el)};
R["fh-welcome"]=function(el,d){var w=d.fh_welcome;el.innerHTML='<article class="ov-card fh-block"><h3 class="fh-rule">'+md(w.title)+'</h3><p>'+md(w.text)+'</p></article>'};
R["fh-highlights"]=function(el,d){var w=d.fh_highlights;el.innerHTML='<article class="ov-card fh-block"><h3 class="fh-rule">'+md(w.title)+'</h3><ul>'+w.items.map(function(i){return '<li>'+link(i.url,md(i.label))+'</li>'}).join("")+'</ul></article>'};
R["fh-teaching"]=function(el,d){var w=d.fh_teaching;el.innerHTML='<article class="ov-card fh-block"><h3 class="fh-rule">'+md(w.title)+'</h3><p>'+md(w.text)+'</p><ul>'+w.items.map(function(i){return '<li>'+link(i.url,md(i.label))+'</li>'}).join("")+'</ul></article>'};
R["fh-cards"]=function(el,d){el.innerHTML=d.fh_cards.map(function(p){return '<a class="fh-card" href="'+esc(p.url)+'"><strong>'+md(p.title)+'</strong><span>'+md(p.text)+'</span></a>'}).join("")};
R["banner-areas"]=function(el,d){if(d&&d.hero_line1)el.innerHTML='<span class="l1">'+md(d.hero_line1)+'</span><span class="l2">'+md(d.hero_line2||"")+'</span>'};
R["banner-field"]=function(el,d,site){if(site.banner_field)el.textContent=site.banner_field};

var files={"fh-teaching":"pages/home","fh-welcome":"pages/home","fh-highlights":"pages/home","research-background":"research","research-more":"research","fh-synth":"research","research-edge":"research","fh-hero":"pages/home","fh-cards":"pages/home",publications:"publications",research:"research","research-lead":"research","research-areas":"research","research-questions":"research","research-current":"research","research-previous":"research","research-pubs":"research",projects:"projects","reaction-dynamics-page":"reaction-dynamics","data-engineering":"data-engineering",weekly:"lectures",lecture:"lectures","home-side":"pages/home","home-soon":"pages/home","home-teaching":"pages/home","home-academic":"pages/home","home-stats":["pages/home","lectures","data-engineering"],"home-statement":"pages/home","home-intro":"pages/home","home-blocks":"pages/home","home-working":"pages/home","home-cta":"pages/home","banner-areas":"pages/home","home-highlights":"pages/home","home-technical":"pages/home","home-pubs":["pages/home","publications"],"home-areas":"pages/home"};
var cache={};function load(n){return cache[n]||(cache[n]=get(n))}
var pending=[];
document.querySelectorAll("[data-render]").forEach(function(el){var k=el.getAttribute("data-render"),f=files[k];
  if(k==="page")f="pages/"+el.getAttribute("data-file");
  var need=f?(Array.isArray(f)?f:[f]):[];
  pending.push(Promise.all(need.map(load).concat([load("site")])).then(function(r){var site=r.pop();R[k](el,need.length>1?r:r[0]||null,site)}).catch(function(){}));});
load("pages/home").then(function(h){document.querySelectorAll("#jump-links .dd").forEach(function(dd){var u=dd.getAttribute("data-key"),b=h.blocks.filter(function(x){return x.url===u})[0];if(b)dd.querySelector(".sub").innerHTML=b.links.map(function(i){return '<li>'+link(i.url,esc(i.label))+'</li>'}).join("")})}).catch(function(){});
Promise.all(pending).then(function(){if(location.hash)window.dispatchEvent(new Event("hashchange"))});
})();
