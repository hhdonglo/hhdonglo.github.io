// Which files count as lecture documents. One responsibility: say, from a path alone, whether a file is a lecture document (PDF or Word),
// a figure, or something else. Pure. Quiz banks are loaded through their own paths (quizzes/lectureN.json) and are never lecture documents.
"use strict";

const DOCUMENT_EXTS = [".pdf", ".docx"];
const FIGURE_DIRS = /^(figs?|figures?|images?|imgs?|plots?|diagrams?|graphics|media|assets|pictures|illustrations|pics?)$/i;
const FIGURE_NAME = /^(figs?|figures?|img|image|plot|diagram|chart|graph|tikz|screenshot|pic|photo|scan|illustration)([\s_\-.]|\d|$)/i;

const ext = (rel) => { const m = /\.[^.\\/]+$/.exec(String(rel)); return m ? m[0].toLowerCase() : ""; };
const nameOf = (rel) => String(rel).split(/[\\/]/).pop();
const isDocumentType = (rel) => DOCUMENT_EXTS.includes(ext(rel));

// A figure by its name or folder alone ("fig_agree.pdf", "figures/force.pdf"). A look inside the file may add more (classify.js).
function figureByName(rel) {
  const parts = String(rel).split(/[\\/]/).filter(Boolean);
  const file = parts.pop() || "";
  return FIGURE_NAME.test(file.replace(/\.[^.]+$/, "")) || parts.some((d) => FIGURE_DIRS.test(d));
}

// files: relative paths -> { documents, figures, other }. Figures and other files are never counted as lecture files.
function partition(files) {
  const out = { documents: [], figures: [], other: [] };
  (files || []).forEach((rel) => {
    if (!isDocumentType(rel)) out.other.push(rel);
    else if (figureByName(rel)) out.figures.push(rel);
    else out.documents.push(rel);
  });
  return out;
}

module.exports = { DOCUMENT_EXTS, ext, nameOf, isDocumentType, figureByName, partition };
