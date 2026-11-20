/* Spreadsheet-style reads and edits over an in-memory course workbook.
   touch reports a changed sheet to the backend, which owns persistence. */
"use strict";

function createWorkbookAdapter({ book, touch, isDate, fmtDate }) {
  const blank = (v) => v === undefined || v === null;
  function norm(v) { return blank(v) ? "" : v; }
  function Sheet(data) {
    const s = this;
    const rows = () => data.rows;
    function lastRow() { const r = rows(); for (let i = r.length - 1; i >= 0; i--) if (r[i] && r[i].some((v) => v !== "" && !blank(v))) return i + 1; return 0; }
    function lastCol() { let m = 0; rows().forEach((r) => { if (!r) return; for (let j = r.length - 1; j >= 0; j--) if (r[j] !== "" && !blank(r[j])) { m = Math.max(m, j + 1); break; } }); return m; }
    function cell(r, c) { const row = rows()[r - 1]; return row ? norm(row[c - 1]) : ""; }
    function put(r, c, v) {
      const R = rows(); while (R.length < r) R.push([]);
      const row = R[r - 1] || (R[r - 1] = []); while (row.length < c) row.push("");
      row[c - 1] = blank(v) ? "" : v; touch(data);
    }
    function Range(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error("The coordinates of the range are outside the dimensions of the sheet.");
      let px = null;
      const rg = {
        getValue: () => cell(r, c),
        getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const a = []; for (let j = 0; j < nc; j++) a.push(cell(r + i, c + j)); o.push(a); } return o; },
        getDisplayValues: () => rg.getValues().map((a) => a.map((v) => (isDate(v) ? fmtDate(v, v.getHours() || v.getMinutes() || v.getSeconds() ? "dd/MM/yyyy HH:mm:ss" : "dd/MM/yyyy") : String(v)))),
        setValue: (v) => { put(r, c, v); return px; },
        setValues: (vals) => {
          if (!Array.isArray(vals) || vals.length !== nr || vals.some((a) => !Array.isArray(a) || a.length !== nc)) throw new Error("The number of rows or columns in the data does not match the range.");
          vals.forEach((a, i) => a.forEach((v, j) => put(r + i, c + j, v))); return px;
        },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows()[r + i - 1]) put(r + i, c + j, ""); return px; },
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc
      };
      // Formatting has no meaning on disk: every set* call is accepted and ignored.
      px = new Proxy(rg, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(set|clear|merge|break|protect|activate)/.test(k) ? () => px : undefined) });
      return px;
    }
    let sp = null;
    Object.assign(s, {
      getName: () => data.name,
      getLastRow: lastRow, getLastColumn: lastCol,
      getMaxRows: () => Math.max(1000, rows().length), getMaxColumns: () => Math.max(26, lastCol()),
      insertRowsAfter: () => sp, insertColumnsAfter: () => sp,
      getRange: (r, c, nr, nc) => { if (typeof r === "string") throw new Error("A1 ranges are not supported"); return Range(r, c, nr, nc); },
      getDataRange: () => Range(1, 1, Math.max(1, lastRow()), Math.max(1, lastCol())),
      appendRow: (vals) => { const r = lastRow() + 1; vals.forEach((v, j) => put(r, j + 1, v)); return sp; },
      deleteRow: (r) => { rows().splice(r - 1, 1); touch(data); return sp; },
      deleteRows: (r, n) => { rows().splice(r - 1, n); touch(data); return sp; },
      deleteColumn: (c) => { rows().forEach((row) => row && row.splice(c - 1, 1)); touch(data); return sp; },
      clear: () => { data.rows = []; touch(data); return sp; },
      clearContents: () => { data.rows = []; touch(data); return sp; },
      getSheetId: () => data.id
    });
    sp = new Proxy(s, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(set|hide|show|protect|activate|autoResize)/.test(k) ? () => sp : undefined) });
    return sp;
  }
  const sheetObjs = new Map();
  function sheetObj(d) { if (!sheetObjs.has(d)) sheetObjs.set(d, new Sheet(d)); return sheetObjs.get(d); }
  const ui = {
    alert: () => "YES", Button: { YES: "YES", NO: "NO", OK: "OK" }, ButtonSet: { YES_NO: "YES_NO", OK: "OK" },
    createMenu: function () { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; }
  };
  const spreadsheet = {
    getSheetByName: (n) => { const d = book.sheets.find((x) => x.name === n); return d ? sheetObj(d) : null; },
    insertSheet: (n) => {
      if (book.sheets.some((x) => x.name === n)) throw new Error('A sheet with the name "' + n + '" already exists.');
      const d = { name: n, id: book.sheets.length + 1, rows: [] }; book.sheets.push(d); touch(d); return sheetObj(d);
    },
    getSheets: () => book.sheets.map(sheetObj),
    getName: () => "Class Manager (local)", getId: () => "local", getUrl: () => ""
  };
  const SpreadsheetApp = { getActiveSpreadsheet: () => spreadsheet, getActive: () => spreadsheet, getUi: () => ui, flush: () => {} };

  return { SpreadsheetApp, spreadsheet, sheetObj };
}

module.exports = { createWorkbookAdapter };
