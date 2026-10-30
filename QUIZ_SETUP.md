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

## Running a quiz live from your computer (lecturer-paced)
Two pages, one for each screen:
- **Dashboard** (your laptop): `phys143-lecture1-host.html`. Enter the join code and the host key (Key tab, cell J2). The first time, press "Switch on lecturer control". This adds a row for the code to the private **Quiz_Control** tab.
- **Display** (projector): the dashboard's link, or `phys143-lecture1-display.html?code=2627`. It shows the QR code, join code and joined count, then the question number, the countdown and how many have answered, then the results once released. It never shows IDs.

Flow: **Open lobby** (students join and wait), **Start quiz** (question 1 opens for everyone), **Next question** moves the whole class on, **Pause** freezes the clock on every student's screen and **Resume** continues, **+1/+2/+5 min** extends the question, **End quiz** marks everything, **Release results** shows scores and ranking. Every action is written to the Log tab.
Settings on the dashboard: seconds per question (0 = no timer, default 60), late joining, and when students see their score and the ranking (OnRelease by default, or Immediate, or Never).
How it is enforced: the server holds the state. An answer is accepted only for the question that is open, before its deadline (15 seconds of grace), while the quiz is running. The answers are stored in the Answers tab, then compiled into Form Responses 1 with the Score when the quiz ends, so the first-attempt rule, the Totals tab and the ranking work as before. **Review answers** (after the quiz has ended) goes over the questions with the class: the dashboard steps through Previous and Next question, and every student's phone and the projector show that question with the correct option highlighted, how many chose each option, the student's own answer and an explanation. The correct letter is sent only while review is on. Explanations come from the practice bank (`quizzes/lecture1.json`: its `exp` and `ref` for each question), matched to the live questions in `apps_script/live_quizzes.json`, so there is nothing to paste: for a new quiz add its code and the five bank question ids to that file. The optional **Explanations** tab (Join Code, Question number, Explanation) overrides the bank for one question. **New round (back to lobby)** returns the quiz to a fresh lobby and clears who has joined. Student records are never deleted or moved: every response row carries a Round number (column K of Form Responses 1), the ranking, results and first-attempt rule use the current round only, and the same student can have a score in each round. Logging in to the dashboard starts a fresh round automatically (it asks first if a quiz is running). Reopen puts the quiz back to the last question for a few minutes (logged); ending it again recompiles the scores. A code with no Quiz_Control row keeps the older behaviour. The "timed" mode (one clock for all five questions) is still there: set mode to timed in Quiz_Control.
The host key travels in the web address, so keep it private and change it in Key!J2 if it leaks.

## End of semester: the Totals tab (automatic)
The private **Totals** tab is rebuilt by the script every time a quiz ends or a legacy submission arrives, and by the **PHYS 143, Refresh totals** menu in the sheet. One row per student ID: First name, Quizzes taken, one column per quiz code with the counted score, Total, Out of (5 per quiz taken) and Average %. If a student has several rounds for one code, Key!K2 says which counts: **Best** (default) or **Latest**. The tab is never published and the quiz pages never read it. To download it: open the Totals tab, File, Download, Comma-separated values (this saves the current tab only), or Microsoft Excel (saves the whole file). Delete test rows (ZZ names) from Form Responses 1 first, then press Refresh totals.

## Weekly quizzes of 5 to 20 questions (the normal way now)
One quiz page, one dashboard, one display for every week. To run a new quiz:
1. In the private **Key** tab add a row with a new join code in column A (leave the letters B to F empty) and Open in G.
2. Open the dashboard, enter that code and the host key, and press "Switch on lecturer control".
3. In the settings panel choose the **Week** (the week number is the lecture number, listed in `apps_script/live_quizzes.json` under `weeks`) and the **Number of questions** (5 up to 20, at most what that week's practice bank holds). Do this before Start.
4. Open the lobby and run it as usual. When you press Start, the questions are drawn at random from that week's practice bank (a fresh draw each round); the correct answers and the explanations with their Review pointers come from the bank.
The questions and answers therefore live in `quizzes/lectureN.json`, which is public (practice pages show them already). Answers are checked on the server and sent to students only during Review. Totals shows one column per week quiz, such as "Week 2 Motion (3814)", with scores out of N.
Code 2627 stays a fixed five-question Lecture 1 quiz: its questions are in `live_quizzes.json` and its correct letters are in the Key tab. There is no join-code hash in the page any more: the server decides whether a code is valid. A new week needs only the bank file `quizzes/lectureN.json` (at least five questions) and its entry under `weeks`.
