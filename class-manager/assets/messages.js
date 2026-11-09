/* Shared error and recovery messages for the student pages.
   One place to change wording. Each message has a short reference code (E1 to E18)
   that a student can quote to the lecturer. No internals, tokens or IDs appear here.
   Catalogue: design/PORTAL_CONTROL_CENTRE_DESIGN.md, section 4. */
(function(w){
"use strict";
var M={
 E1:["Your student ID has not been accepted. Enter digits only, with no spaces.","edit"],
 E2:["This ID is not on the class list. Check the number. If it is correct, tell your lecturer after class.","help"],
 E3:["This link has expired. Scan the code on the screen again.","rescan"],
 E4:["Scan the QR code shown in class to mark attendance.","rescan"],
 E5:["Location is switched off for this page. Allow location in your browser settings, or open this link in Chrome or Safari instead of an app.","retry"],
 E6:["Your phone reports a position outside the classroom. Move closer to the room and try again. If you are in the room, tell your lecturer.","retry"],
 E7:["Waiting for a better location reading. This can take up to 20 seconds indoors.","wait"],
 E8:["Your phone could not reach the server. Your entry has not been received. Check your connection and try again.","retry"],
 E9:["Already received. No further action is needed.","none"],
 E10:["This phone has already been used for another ID in this session. Tell your lecturer.","help"],
 E11:["This quiz is not open. Wait for your lecturer to start it, or check the code.","refresh"],
 E12:["This code was not recognised. Check the code shown in class.","edit"],
 E13:["This question has closed. Your answer was not received.","none"],
 E14:["Too many attempts. Wait ten minutes, then try again.","wait"],
 E15:["The system is being updated. Refresh this page. If it continues, tell your lecturer.","refresh"],
 E16:["The service is busy. Wait a few seconds and try again. Tell your lecturer.","retry"],
 E17:["This student ID and access code do not match. Check both. Your access code is on the slip from your lecturer; ask your lecturer if you do not have one.","edit"],
 E18:["You do not have an access code yet. Ask your lecturer for your access code slip, then check in again.","help"],
 E0:["Something went wrong. Try again. If it continues, tell your lecturer.","retry"]
};
// Server reason strings (the "why" field of the attend and quiz replies) to catalogue codes.
var WHY={
 "bad id":"E1","old link":"E3","no token":"E4","no location":"E5","too far":"E6","device used":"E10",
 "not on list":"E2","results off":"E11","closed":"E11","slow down":"E14","update page":"E15","not joined":"E13","quiz closed":"E11","bad code":"E12","not recognised":"E17","no access code":"E18"
};
function code(why){return WHY[why]||"E0"}
// text(code) returns the message with its reference, e.g. "... (Ref E3)".
function text(c){var m=M[c]||M.E0;c=M[c]?c:"E0";return m[0]+" (Ref "+c+")"}
function action(c){return (M[c]||M.E0)[1]}
function fromWhy(why){return text(code(why))}
w.PHYSMSG={text:text,code:code,action:action,fromWhy:fromWhy,all:M};
})(window);
