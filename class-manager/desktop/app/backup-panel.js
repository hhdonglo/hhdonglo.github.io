/* Desktop home records backup panel. Called after its controls are in the DOM. */
window.cmBackupPanel = (function () {
  "use strict";

  function init(cmApp, $, esc) {
    function bkWhen(ms){var d=new Date(ms);return d.toLocaleDateString(undefined,{day:"numeric",month:"short"})+" "+("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}
    var BKWHY={auto:"automatic",close:"when CM closed",manual:"made by you",restore:"before a restore"};
    function bkShow(b){if(!b)return;
     $("bk-prot").textContent=b.protected?"The records of this course are encrypted on this computer, with a key kept in the system keychain.":"The records are encrypted, but this computer offers no keychain for the key, so anyone who can open your user account's files can read them. Keep this computer's account protected by a password.";
     $("bk-problem").hidden=!b.loadProblem;if(b.loadProblem)$("bk-problem").textContent="The records file could not be read when the course opened ("+b.loadProblem.why+"). It was kept, not overwritten, as "+b.loadProblem.file+". Restore a backup below.";
     $("bk-keep").textContent=b.keep;
     var last=b.last;if(last&&!last.ok)$("bk-msg").textContent="The last backup failed: "+(last.why||"unknown");
     $("bk-list").innerHTML=b.list.length?'<table><thead><tr><th scope="col">Backup</th><th scope="col">Kind</th><th scope="col">Size</th><th scope="col"></th></tr></thead><tbody>'+b.list.map(function(x){return'<tr><td>'+esc(bkWhen(x.at))+'</td><td>'+esc(BKWHY[x.reason]||x.reason)+'</td><td>'+Math.max(1,Math.round(x.bytes/1024))+' KB</td><td><button class="btn" type="button" data-bk="'+esc(x.name)+'">Restore</button></td></tr>'}).join("")+'</tbody></table>':'<p class="note">No backups yet.</p>'}
    cmApp.backups().then(bkShow);
    $("bk-now").addEventListener("click",function(){$("bk-msg").textContent="Backing up…";cmApp.backupNow().then(function(b){bkShow(b);$("bk-msg").textContent=b.last&&b.last.ok?"Backed up and checked: "+b.last.check.tabs+" tabs, "+b.last.check.rows+" rows.":"Not done: "+((b.last&&b.last.why)||"unknown")})});
    $("bk-list").addEventListener("click",function(e){var t=e.target.closest("button[data-bk]");if(!t)return;var n=t.getAttribute("data-bk");
     cmApp.backupCheck(n).then(function(v){if(!v.ok){$("bk-msg").textContent="That backup cannot be read: "+v.why;return}
      if(!confirm("Restore this course's records from this backup ("+v.tabs+" tabs, "+v.rows+" rows)? The records as they are now are kept as a backup first."))return;
      cmApp.backupRestore(n).then(function(r){if(r.ok){bkShow(r);$("bk-msg").textContent="Restored. The records as they were are kept as a backup."}else $("bk-msg").textContent="Not restored: "+r.why})})});
    var BKMODE="";
    function bkAsk(mode){BKMODE=mode;$("bk-pass").value="";$("bk-again").value="";$("bk-derr").textContent="";$("bk-again-w").hidden=mode!=="export";
     $("bk-dnote").textContent=mode==="export"?"The backup file holds this course's records and settings, encrypted with this passphrase, so that it can be restored on another computer. Without the passphrase it cannot be opened, and the passphrase cannot be recovered.":"Enter the passphrase the backup was saved with. The course's records are replaced by the file's; the records as they are now are kept as a backup first.";
     $("bk-d").showModal();$("bk-pass").focus()}
    $("bk-export").addEventListener("click",function(){bkAsk("export")});
    $("bk-import").addEventListener("click",function(){bkAsk("import")});
    $("bk-cancel").addEventListener("click",function(){$("bk-d").close()});
    $("bk-form").addEventListener("submit",function(e){e.preventDefault();var p=$("bk-pass").value;
     if(p.length<10){$("bk-derr").textContent="At least 10 characters.";return}
     if(BKMODE==="export"&&p!==$("bk-again").value){$("bk-derr").textContent="The two passphrases differ.";return}
     $("bk-d").close();$("bk-msg").textContent=BKMODE==="export"?"Saving…":"Restoring…";
     (BKMODE==="export"?cmApp.backupExport(p):cmApp.backupImport(p)).then(function(r){if(!r){$("bk-msg").textContent="";return}
      if(!r.ok){$("bk-msg").textContent="Not done: "+r.why;return}
      if(BKMODE==="export")$("bk-msg").textContent="Saved and read back: "+r.file;else{bkShow(r);$("bk-msg").textContent="Restored from the backup made "+(r.made||"").slice(0,10)+"."}})});
  }

  return { init };
})();
