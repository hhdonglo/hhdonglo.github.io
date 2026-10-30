# Adding a new try-questions quiz

The Lecture 1 page `phys143-lecture1-try.html` is the template. One quiz means one page, one join code, one set of answer letters.

## Why one code per quiz
The join code is what keeps quizzes apart on the sheet. Pick a fresh code for each quiz (for example 3814). A date is easy to guess and cannot separate two quizzes on the same day. Never reuse a code.

## Steps
1. **Copy the page.** `cp phys143-lecture1-try.html phys143-lecture3-try.html` (use the right lecture or chapter).
2. **Change the title and text.** Edit `<title>`, the `<h2>` heading, the breadcrumb and the description at the top of the page.
3. **Replace the questions.** In the script, edit the `QS` list. Each question has a `stem` and five `opts` (A to E). Do not put the correct letter anywhere in the page.
4. **Set the join code.** Pick the new code and make its hash:
   `printf 'phys143-try:3814' | shasum -a 256`
   (type the code in capitals if it has letters). Replace the hash in `ACCEPTED`, or add it to the list if one page should accept several codes.
5. **Check the Form.** If the quiz still has five questions, the same Form works and the field ids in `FORM_FIELDS` stay. For a different number of questions, add questions Q6 and so on to the Form, then copy the new `entry.NNN` ids from the Form's source (view-source, search "entry.") into `FORM_FIELDS.q`. For a separate Form, change `FORM_BASE` as well.
6. **Make the QR code.** Point it at the new page address (segno or any QR maker). Save it as `assets/figures/phys143-l3-try-qr.svg` and update the `<img>` in the page.
7. **Sheet: add the answers.** In the private Key tab add a row for the new code with the correct letters for Q1 to Q5. The score formula should look up the key by Join Code, so a response with another code is scored against its own quiz's key, or not at all.
8. **Sheet: Leaderboard.** It should list First Name, Join Code and Score only. The page shows each student the rows that share their own join code, so quizzes never mix on the screen.
9. **Test, then publish.** Open the page locally, try a wrong code (it must refuse) and the right code, then push. Do one full test submission and check the row reaches Form Responses 1 and the Leaderboard. Delete test rows afterwards.

## Limits to remember
- The code check runs in the browser. It stops casual mistakes, not a determined guess. The sheet must ignore responses with unknown codes.
- Only a student's first attempt per ID and join code should count. The sheet handles that.
- Answer letters live only in the private Key tab.
