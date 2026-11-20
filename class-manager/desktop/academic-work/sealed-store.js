"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createSealedStore(file, vault, initial, valid) {
  function read() {
    let bytes;
    try { bytes = fs.readFileSync(file); }
    catch (error) { if (error.code === "ENOENT") return initial(); throw error; }
    if (!vault.isSealed(bytes)) throw new Error("The local data file is unsealed.");
    const state = JSON.parse(vault.decode(bytes));
    if (!valid(state)) throw new Error("The local data file has an unsupported format.");
    return state;
  }

  function write(state) {
    if (!valid(state)) throw new Error("The local data could not be validated.");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + "." + randomUUID() + ".tmp";
    try {
      const descriptor = fs.openSync(temp, "wx", 0o600);
      try { fs.writeFileSync(descriptor, vault.encode(JSON.stringify(state))); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
      fs.renameSync(temp, file);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  function change(fn) {
    const state = read();
    const result = fn(state);
    write(state);
    return result;
  }

  return { read, change };
}

module.exports = { createSealedStore };
