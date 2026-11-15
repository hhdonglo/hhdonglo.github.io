/* What each learning management system (LMS) calls things. One entry per LMS: how its roster export names the student ID and the name,
   and how its gradebook import wants the file laid out. To support another LMS, add an entry here; no other file changes.
   The gradebook layouts follow each LMS's documented import format; test one import on a copy of the course before relying on it. */
"use strict";

const PROFILES = {
  canvas: {
    label: "Canvas",
    idColumns: ["sis user id", "sis login id", "student id", "student number"],
    nameColumns: ["student", "name"],
    gradebook: { idHeader: "SIS User ID", extraHeaders: ["Student"], endMarker: null, columnName: (n) => n, nameHeader: "Student" }
  },
  moodle: {
    label: "Moodle",
    idColumns: ["id number", "idnumber", "student id", "username"],
    nameColumns: ["full name", "first name", "surname", "last name"],
    gradebook: { idHeader: "ID number", extraHeaders: [], endMarker: null, columnName: (n) => n }
  },
  blackboard: {
    label: "Blackboard",
    idColumns: ["student id", "username", "user id"],
    nameColumns: ["first name", "last name"],
    gradebook: { idHeader: "Username", extraHeaders: [], endMarker: null, columnName: (n) => n }
  },
  brightspace: {
    label: "Brightspace (D2L)",
    idColumns: ["orgdefinedid", "username", "student id"],
    nameColumns: ["first name", "last name"],
    gradebook: { idHeader: "OrgDefinedId", extraHeaders: [], endMarker: ["End-of-Line Indicator", "#"], columnName: (n) => n + " Points Grade" }
  },
  sakai: {
    label: "Sakai",
    idColumns: ["student id", "user id", "eid", "id"],
    nameColumns: ["display name", "name", "first name", "last name"],
    gradebook: { idHeader: "Student ID", extraHeaders: [], endMarker: null, columnName: (n) => n }
  },
  generic: {
    label: "Another LMS (CSV)",
    idColumns: ["student id", "id", "sis user id", "id number", "username"],
    nameColumns: ["name", "student", "full name", "first name", "last name"],
    gradebook: { idHeader: "Student ID", extraHeaders: [], endMarker: null, columnName: (n) => n }
  }
};

const ids = () => Object.keys(PROFILES);
const get = (id) => PROFILES[id] || PROFILES.generic;
const list = () => ids().map((id) => ({ id, label: PROFILES[id].label }));

module.exports = { PROFILES, get, list, ids };
