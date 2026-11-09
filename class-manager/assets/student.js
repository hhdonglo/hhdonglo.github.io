/* Shared student layer. Adds the tab bar, offline notice and service worker.
   Reads one optional value, the remembered ID the student chose to keep on
   this device in the portal. It never sends anything anywhere. */
(function(){
"use strict";
var KEY="cm_portal_id";
var path=(location.pathname.split("/").pop()||"").toLowerCase();
function cur(f){return path===f?' aria-current="page"':""}
var ico={
 home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></svg>',
 book:'<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M8 7h7"/></svg>',
 quiz:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01"/></svg>',
 res:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
};
function bar(){
 var n=document.createElement("nav");n.className="stu-tabs";n.setAttribute("aria-label","Student");
 n.innerHTML='<a href="index.html"'+cur("index.html")+'>'+ico.home+'Portal</a>'+
  '<a href="course.html"'+cur("course.html")+'>'+ico.book+'Lectures</a>'+
  '<a href="quiz.html"'+cur("quiz.html")+'>'+ico.quiz+'Quiz</a>'+
  '<a href="index.html#results">'+ico.res+'Results</a>';
 document.body.appendChild(n);document.body.classList.add("stu");
}
function offline(){
 var b=document.createElement("p");b.className="stu-off";b.setAttribute("role","status");b.hidden=navigator.onLine!==false;
 b.textContent="You are offline. Saved pages still open. Check-in and quizzes need a connection.";
 document.body.insertBefore(b,document.body.firstChild);
 function u(){b.hidden=navigator.onLine}
 window.addEventListener("online",u);window.addEventListener("offline",u);
}
function back(){
 if(path==="index.html")return;
 var m=document.querySelector("main .wrap");if(!m||m.querySelector(".stu-back"))return;
 var a=document.createElement("a");a.className="stu-back";a.href="index.html";a.innerHTML="&lsaquo; Portal";
 m.insertBefore(a,m.firstChild);
}
function prefill(){
 var s="";try{s=localStorage.getItem(KEY)||""}catch(x){}
 if(!s)return;
 ["c-id","in-id"].forEach(function(i){var e=document.getElementById(i);if(e&&!e.value){e.value=s;e.dispatchEvent(new Event("input",{bubbles:true}))}});
}
function sw(){if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(function(){})}}
function ready(f){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):f()}
ready(function(){bar();offline();back();prefill();sw()});
/* Install prompt, used by the portal card. */
window.PHYSINSTALL={ev:null};
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.PHYSINSTALL.ev=e;var c=document.getElementById("p-install");if(c)c.hidden=false});
})();
