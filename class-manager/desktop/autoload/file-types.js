// The one list of file types CM accepts when a lecturer adds a file, so every upload screen says and allows the same thing.
// Reading is done by read-file.js (tables, Word, text, PDF text) and authoring.js extract (also PowerPoint); pictures and scanned
// PDFs are read by Claude only where a screen offers it (the Class Roster). Roster rule: only the Class Roster adds students.
"use strict";
const TABLES = ["xlsx", "csv", "tsv"];
const DOCUMENTS = ["pdf", "docx", "pptx", "md", "markdown", "txt", "text"];
const STANDARD = TABLES.concat(DOCUMENTS);
const IMAGES = ["png", "jpg", "jpeg", "webp", "gif"];
const filter = (name, exts) => ({ name, extensions: exts || STANDARD });
const WORDING = "CSV, Excel, Word, PDF, PowerPoint, Markdown or text";
module.exports = { TABLES, DOCUMENTS, STANDARD, IMAGES, filter, WORDING };
