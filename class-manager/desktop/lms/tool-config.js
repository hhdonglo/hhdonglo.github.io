/* What the LMS administrator needs to register CM: the public key (JWKS) and the list of services CM uses.
   CM only calls the LMS (roster and gradebook); it does not need to be launched from inside the LMS, so it needs no public web address of its own. */
"use strict";
const { jwks } = require("./keys");
const { SCOPES } = require("./token");

function toolConfig(key, title) {
  return {
    title: title || "Class Manager",
    description: "Reads the class roster and writes scores to the gradebook, for one course, from the lecturer's computer.",
    scopes: [SCOPES.members, SCOPES.lineitem, SCOPES.score],
    public_jwk: jwks(key).keys[0],
    note: "Give the LMS administrator this file. CM calls the LMS; the LMS does not call CM."
  };
}

module.exports = { toolConfig };
