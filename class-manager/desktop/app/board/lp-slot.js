/* Class Analytics board: where the lecture plan card lives. The card (#lp-card, drawn by lecture-progress.js) is a long-lived element that the board
   shows inside its own top row. The board is redrawn often (every minute, and on every change), and a redraw replaces everything inside #ov, so a
   card left inside #ov would be thrown away and never drawn again. So before any redraw the card goes back to a hidden holder outside #ov (park),
   and after the redraw it is placed in the new slot (mount). The card can therefore never be lost to a redraw. Takes the document as a parameter,
   so it runs in the CM window and in Node (the tests). */
(function (root) {
  "use strict";
  var PARK_ID = "lp-park", CARD_ID = "lp-card", SLOT_ID = "bd-lpslot";
  // The hidden holder, made once, next to #ov (never inside it).
  function holder(doc) {
    var p = doc.getElementById(PARK_ID); if (p) return p;
    var ov = doc.getElementById("ov"); if (!ov || !ov.parentNode) return null;
    p = doc.createElement("div"); p.id = PARK_ID; p.hidden = true;
    ov.parentNode.insertBefore(p, ov); return p;
  }
  // Call before anything replaces the contents of #ov.
  function park(doc) {
    var card = doc.getElementById(CARD_ID), p = holder(doc);
    if (card && p && card.parentNode !== p) p.appendChild(card);
    return !!card;
  }
  // Call after #ov was redrawn: the card goes into the board's slot beside the key numbers. With no slot (a message instead of a board) it stays parked.
  function mount(doc) {
    var card = doc.getElementById(CARD_ID) || (holder(doc) && holder(doc).firstChild), slot = doc.getElementById(SLOT_ID);
    if (card && slot) slot.appendChild(card);
    return !!(card && slot);
  }
  var api = { park: park, mount: mount, holder: holder };
  if (typeof module === "object" && module.exports) module.exports = api; else root.cmBoardLpSlot = api;
})(typeof window !== "undefined" ? window : globalThis);
