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
function fig1(f){var img='<img src="'+esc(f.image)+'" width="'+f.width+'" height="'+f.height+'" alt="'+esc(f.alt)+'" loading="lazy">';return '<figure class="fig">'+(f.full?'<a class="zoom" href="'+esc(f.full)+'" data-full="'+esc(f.full)+'" aria-label="Enlarge figure: '+esc(f.caption)+'">'+img+'</a>':img)+'<figcaption>'+md(f.caption)+(f.credit?'<span class="credit">'+md(f.credit)+'</span>':'')+(f.full?' <span class="zoom-hint">Select the figure to enlarge.</span>':'')+(f.source?' <a href="'+esc(f.source)+'" rel="noopener">Source</a>':'')+'</figcaption></figure>'}
function figs(list){list=list||[];if(!list.some(function(f){return f.heading}))return list.map(fig1).join("");var g=[];list.forEach(function(f){if(f.heading||!g.length)g.push({h:f.heading,l:f.lead,f:[]});g[g.length-1].f.push(f)});return g.map(function(x){return '<div class="fig-group">'+(x.h?'<h5 class="fig-h">'+md(x.h)+'</h5>':'')+(x.l?'<p class="fig-lead">'+md(x.l)+'</p>':'')+'<div class="fig-row">'+x.f.map(fig1).join("")+'</div></div>'}).join("")}
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
function flat(d){var o=[];d.groups.forEach(function(g){g.lectures.forEach(function(l){if(l.number>0)o.push({l:l,g:g})})});return o.sort(function(a,b){return a.l.number-b.l.number})}
function ln(n){return ("0"+n).slice(-2)}
function lpage(n,l){return l&&l.page?l.page:"lecture-"+n+".html"}
function ppage(n,l){return l&&l.practice_page?l.practice_page:"lecture-"+n+"-practice.html"}
R.weekly=function(el,d){
  var co=d.course_outline,cof='';if(co&&co.url){cof='<p class="outline"><strong>'+esc(co.label||"Course outline")+':</strong> <span class="pdf-pair"><a href="'+esc(co.url)+'" target="_blank" rel="noopener">Preview<span class="vh"> '+esc(co.label||"course outline")+' (opens in a new tab)</span></a><a href="'+esc(co.url)+'" download>Download<span class="vh"> '+esc(co.label||"course outline")+'</span></a></span></p>'}
  var ol=d.official_listing;if(ol&&ol.url)cof+='<p class="outline"><a href="'+esc(ol.url)+'" target="_blank" rel="noopener">'+esc(ol.label||"Official course listing")+' ↗<span class="vh"> (opens in a new tab)</span></a></p>';
  var mk=d.mock_exam?'<div class="mock-feature" id="mock-exam"><p class="mf-kicker">End of course</p><h4 class="mf-title">Mock exam</h4><p class="mf-text">Fifty questions drawn at random from past examination questions across the course, in 2 hours 30 minutes, with the timer on screen and answers shown only at the end. For practice, not assessment.</p><p class="mf-meta"><span>50 questions</span><span>2 h 30 min</span><span>Lectures 1 to 12</span></p><p><a class="btn primary mf-btn" href="mock-exam.html">Take the mock exam <span aria-hidden="true">&rarr;</span></a></p></div>':'';
  var mj=d.mock_exam?'<p class="mock-jump"><a href="#mock-exam"><strong>Mock exam</strong> · 50 questions in 2 h 30 min · jump to the end of the course <span aria-hidden="true">&darr;</span></a></p>':'';
  el.innerHTML=cof+mj+d.groups.map(function(g){
    return '<div class="week-group" id="'+esc(g.id)+'"><h4 class="grp">'+md(g.title)+'</h4><p class="sec-sub">'+md(g.subtitle)+'</p><ul class="weeks">'+g.lectures.map(function(l){
      var n=l.number,soon=l.status==="soon";
      return '<li class="week'+(soon?' soon':'')+'" id="lecture-'+n+'"><span class="wk">Week '+n+'</span><span class="wt"><a href="'+lpage(n,l)+'">'+(soon?'Coming soon':md(l.title))+'</a><span class="state'+(soon?'':' ok')+'">'+(soon?'Coming soon':'Available')+'</span></span><span class="ws">'+md(soon?(l.note||"Materials are being prepared."):l.summary)+'</span>'+(soon?'':'<span class="wl">'+[(l.slides||n>0?wlink(l.slides,"Slides",n):""),(l.handout?wlink(l.handout,"Handout",n):""),wlink(l.supplement,"Supplementary",n),(l.reference?wlink(l.reference,"Reference slides",n):""),wlink(l.tutorial,"Tutorial",n),wlink(l.practice==="soon"?"":ppage(n,l),"Practice questions",n)].join(" ")+'</span>')+'</li>'}).join("")+'</ul></div>'}).join("")+mk;
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
  var cr=document.querySelector("main .crumb");if(cr)cr.innerHTML='<a href="index.html">Portal</a> &rsaquo; <a href="course.html">'+esc(course)+'</a> &rsaquo; Lecture '+ln(n);
  document.title=title+" | "+course;
  var out='';
  if(soon){out+='<div class="ov-card"><p>This lecture will be added when it is ready.</p></div>'}
  else{
    out+='<div class="lecture-buttons" role="group" aria-label="Lecture resources">'+lbtn(l.slides,"Lecture slides",n,true)+(l.handout?lbtn(l.handout,"Handout",n):"")+lbtn(l.supplement,"Supplementary note",n)+(l.reference?lbtn(l.reference,"Reference slides",n):"")+lbtn(l.tutorial,"Tutorial sheet",n)+lbtn(l.practice==="soon"?"":ppage(n),"Practice questions",n)+'</div>';
    out+='<details class="fold" id="objectives" open><summary>Learning objectives</summary><div class="ov-card"><p>Students should be able to:</p>'+list(l.outcomes||[],"")+'</div></details>';
    var focus=l.contact_focus||[];
    (d.contacts||[]).forEach(function(c,k){
      out+='<details class="fold" id="contact-'+(k+1)+'"><summary>'+md(c.heading)+'</summary><div class="ov-card"><p>'+md(c.purpose)+(focus[k]?' <span class="muted">Focus: '+esc(focus[k])+'.</span>':'')+'</p></div></details>';});
  }
  var prev=all[i-1],next=all[i+1];
  out+='<nav class="pager" aria-label="Lecture navigation">'+(prev?'<a class="prev" href="'+lpage(prev.l.number)+'">&larr; Lecture '+ln(prev.l.number)+'</a>':'<span></span>')+'<a class="toc" href="course.html#weekly">'+esc(course)+' contents</a>'+(next?'<a class="next" href="'+lpage(next.l.number)+'">Lecture '+ln(next.l.number)+' &rarr;</a>':'<span></span>')+'</nav>';
  el.innerHTML=out;
  if(location.hash==="#practice"&&!soon&&l.practice!=="soon")location.replace(ppage(n));
};
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
  if(c.resources&&c.resources.length)h+='<p class="res-h">Resources</p>'+list(c.resources);
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
  if(c.figures&&c.figures.length)h+=figs(c.figures);
  if(c.figure)h+='<figure class="fig"><img src="'+esc(c.figure)+'"'+(/fig-pathway/.test(c.figure)?' width="720" height="300"':'')+' loading="lazy" alt="'+esc(c.figure_alt||"")+'">'+(c.figure_caption?'<figcaption>'+md(c.figure_caption)+'</figcaption>':'')+'</figure>';
  if(c.table&&c.table.headers&&c.table.headers.length)h+='<table class="ov-ref">'+(c.table.caption?'<caption class="vh">'+esc(c.table.caption)+'</caption>':'')+'<thead><tr>'+c.table.headers.map(function(x){return '<th scope="col">'+esc(x)+'</th>'}).join("")+'</tr></thead><tbody>'+c.table.rows.map(function(r){r=r.cells||r;return '<tr>'+r.map(function(x){return '<td>'+md(x)+'</td>'}).join("")+'</tr>'}).join("")+'</tbody></table>';
  var subs=c.subsections||[];
  if(subs.some(function(x){return x.column})){var cols=[[],[]];subs.forEach(function(x){cols[(x.column===2)?1:0].push(subsec(x))});h+='<div class="ov-two">'+cols.map(function(k){return '<div>'+k.join("")+'</div>'}).join("")+'</div>'}
  else h+=subs.map(subsec).join("");
  h+=paras(c.after,c.lead?"intro":"");
  if(c.note)h+='<p class="note">'+md(c.note)+'</p>';
  if(c.button_label)h+='<p>'+btn(c,false)+'</p>';
  return h+'</article>';
}
function courseCards(s,site){
  var all=(site&&site.courses&&site.courses.courses)||[];
  return all.filter(function(c){return c.status==="current"&&(!s.type||c.type===s.type)}).map(function(c){
    var lec=c.type==="lecture";
    return {id:c.id+"-card",style:lec?"primary":"secondary",kicker:c.kicker,title:c.code,subtitle:c.title,paragraphs:[c.summary],resources:c.resources,button_label:c.button_label,button_url:c.page,button_sr:c.code,button_style:lec?"primary":""};
  });
}
function section(s,site){
  var inner="";
  if(s.from==="courses"){s=Object.assign({},s,{cards:courseCards(s,site)});if(!s.cards.length)return ""}
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
  if(((d&&d.sections)||[]).some(function(x){return x.from==="courses"})&&!(site&&site.courses))return;
  d=sub(d,site);
  var slot=el.getAttribute("data-slot")||"sections";
  el.innerHTML=(d[slot]||[]).map(function(s){return section(s,site)}).join("");
  if(slot!=="bottom"){var h=document.querySelector("main h2");if(h&&d.title)h.textContent=d.title;var sb=h&&h.nextElementSibling;if(sb&&sb.classList.contains("sec-sub")&&d.subtitle)sb.innerHTML=md(d.subtitle)}
};
/* ---- home page ---- */
var files={"lecture":"lectures","weekly":"lectures"};
var cache={};function load(n){return cache[n]||(cache[n]=get(n))}
var pending=[];
document.querySelectorAll("[data-render]").forEach(function(el){var k=el.getAttribute("data-render"),f=files[k];
  if(k==="page")f="pages/"+el.getAttribute("data-file");
  var need=f?(Array.isArray(f)?f:[f]):[];
  var cp=k==="page"?load("courses").catch(function(){return null}):Promise.resolve(null);
  pending.push(Promise.all(need.map(load).concat([load("site"),cp])).then(function(r){var co=r.pop(),site=r.pop();if(co)site=Object.assign({},site,{courses:co});R[k](el,need.length>1?r:r[0]||null,site)}).catch(function(){}));});
Promise.all(pending).then(function(){if(location.hash)window.dispatchEvent(new Event("hashchange"))});
})();
