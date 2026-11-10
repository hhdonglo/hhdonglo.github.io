/* Student shell: network first, cached copy only when offline.
   Cross-origin requests (the quiz and attendance script) are never touched,
   so no student data is ever stored by this worker. */
var CACHE="cm-shell-v2";
var SHELL=["index.html","assets/site.css","assets/student.css","assets/student.js","assets/messages.js","assets/icon.svg","assets/icon-192.png","config.js","data/portal.json"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n!==CACHE}).map(function(n){return caches.delete(n)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){
 var r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==location.origin)return;
 if(/\/exec$/.test(u.pathname))return; // the desktop app's own server: student records are never cached
 e.respondWith(fetch(r).then(function(res){
  if(res.ok&&!/\.pdf$/i.test(u.pathname)){var cp=res.clone();caches.open(CACHE).then(function(c){c.put(r,cp)})}
  return res;
 }).catch(function(){return caches.match(r).then(function(m){return m||caches.match("index.html")})}));
});
