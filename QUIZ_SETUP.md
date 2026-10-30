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
7. **Sheet: add the answers.** In the private **Key** tab add one row per quiz: Join Code, then the correct letters for Q1 to Q5, then Ranking (Open or Closed). The script scores each submission from this row, so the letters never reach the page. A code that is not in the Key tab is refused.
8. **Ranking.** Each student sees their own score straight away, and the class ranking (rank, first name, score, their own row highlighted) appears under it and refreshes by itself every 15 seconds. The script builds it live from Form Responses 1 (Score in column J), so there is no wait for the published Leaderboard. In the Key tab, column G set to **Hidden** hides the ranking; anything else (Live, Open, blank) shows it; **Closed** shows it labelled final. The Log tab records every submission outcome (ok, duplicate, bad code). The Leaderboard tab is now only a backup for older receivers.
9. **Test, then publish.** Open the page locally, try a wrong code (it must refuse) and the right code, then push. Do one full test submission and check the row reaches Form Responses 1 and the Leaderboard. Delete test rows afterwards.

## End of semester: totals across quizzes
Keep a private **Totals** tab in the sheet. Never publish it, because it holds student IDs.
- One row per student ID, one column per quiz code (3814, 2627 and so on), and a Total column at the end.
- Each cell is that student's score for that code, taken from the scored responses. A student who skipped a quiz gets 0 or a blank.
- Because only the first attempt per ID and join code counts, each cell holds one score.
- Total is the sum of the quiz columns. Add one column for each new quiz code.
- The public Leaderboard stays per quiz and shows first names only, with no IDs.

## Limits to remember
- The code check runs in the browser. It stops casual mistakes, not a determined guess. The sheet must ignore responses with unknown codes.
- Only a student's first attempt per ID and join code should count. The sheet handles that.
- Answer letters live only in the private Key tab.
