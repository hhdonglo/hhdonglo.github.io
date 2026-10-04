/* Anonymous visit counts (GoatCounter). Runs only when a site code is set in data/site.json
   ("goatcounter_code"), never on localhost or local files, and loads after the page has finished. */
(function(){
var h=location.hostname;
if(location.protocol==="file:"||h==="localhost"||h==="127.0.0.1"||h==="[::1]"||/^(10|192\.168)\./.test(h)||/\.local$/.test(h))return;
function start(){
fetch("data/site.json").then(function(r){return r.ok?r.json():null}).then(function(s){
var c=s&&String(s.goatcounter_code||"").trim().toLowerCase();
if(!c||!/^[a-z0-9][a-z0-9-]{0,62}$/.test(c))return;
var el=document.createElement("script");
el.async=true;el.src="https://gc.zgo.at/count.js";
el.setAttribute("data-goatcounter","https://"+c+".goatcounter.com/count");
document.head.appendChild(el)}).catch(function(){})}
if(document.readyState==="complete")setTimeout(start,0);else window.addEventListener("load",function(){setTimeout(start,0)})
})();
