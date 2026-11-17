/* Class Manager: draws one page of the slides PDF onto a canvas, off screen. One responsibility: the PDF itself.
   It uses the PDF reader in vendor/pdfjs/ (shipped inside CM, nothing is loaded from the internet). Used by present.js through slide-show.js.
   cmSlideRenderer.open(url) -> Promise of { pages, draw(page, size, stale), close() }, or a refusal when the file cannot be read. */
(function () {
  "use strict";
  var here = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
  var C = window.cmSlideCache, lib = null;

  function loadLib() { // loaded once, the first time slides are presented
    if (!lib) lib = import(new URL("vendor/pdfjs/pdf.min.mjs", here).href).then(function (m) {
      m.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.mjs", here).href; return m;
    });
    return lib;
  }

  function open(url) {
    return Promise.all([loadLib(), fetch(url).then(function (r) { if (!r.ok) throw new Error("The slides could not be read."); return r.arrayBuffer(); })]).then(function (x) {
      return x[0].getDocument({ data: x[1] }).promise.then(function (doc) {
        var sizes = {}; // each page's own proportions, read once
        function proportions(page) {
          if (sizes[page]) return Promise.resolve(sizes[page]);
          return doc.getPage(page).then(function (p) { var v = p.getViewport({ scale: 1 }); sizes[page] = { page: p, w: v.width, h: v.height }; return sizes[page]; });
        }
        // Draw a page, fitted to size ({ w, h, dpr }), on a canvas that is not on screen. Resolves to { canvas, cssW, cssH }.
        function draw(page, size, stale) {
          return proportions(page).then(function (p) {
            if (stale && stale()) return null;
            var f = C.fit(p.w, p.h, size.w, size.h, size.dpr), canvas = document.createElement("canvas");
            canvas.width = f.pxW; canvas.height = f.pxH;
            var task = p.page.render({ canvasContext: canvas.getContext("2d"), viewport: p.page.getViewport({ scale: f.scale }), background: "#ffffff" });
            return task.promise.then(function () { return { canvas: canvas, cssW: f.cssW, cssH: f.cssH, page: page }; });
          });
        }
        return { pages: doc.numPages, draw: draw, close: function () { try { doc.destroy(); } catch (e) { /* already closed */ } } };
      });
    });
  }

  window.cmSlideRenderer = { open: open };
})();
