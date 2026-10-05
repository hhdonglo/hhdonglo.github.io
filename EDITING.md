# Editing the site

**Editor: https://app.pagescms.org** (sign in with GitHub)

All page text can be edited in a browser with forms, using **Pages CMS** (pagescms.org). It is free, needs no server, and saves each change straight to this GitHub repository, which updates the live site about a minute later.

Only people with write access to the `hhdonglo/hhdonglo.github.io` repository can sign in and edit. That is the repository owner, `hhdonglo`, unless more people are added in the repository's GitHub settings. Do not use the Pages CMS "Collaborators" invitation feature unless you want to give someone else edit access.

## First time: sign in

1. Open **https://app.pagescms.org** and click **Sign in with GitHub**. Use the `hhdonglo` account.
2. GitHub asks you to install the Pages CMS app. Choose **Only select repositories**, pick `hhdonglo.github.io`, and confirm. (This gives the app access to this one repository only. You can remove it at any time in GitHub, Settings, Applications.)
3. In Pages CMS, open the repository `hhdonglo.github.io`, branch `main`. The left-hand menu lists the forms below.

## Next times

Open https://app.pagescms.org, choose the repository, choose a form, change the text, and click **Save**. Wait about a minute, then refresh the live page (Ctrl+Shift+R, or Cmd+Shift+R on a Mac).

## Which form edits which page

| Form in Pages CMS | What it changes |
| --- | --- |
| Home | The header lines (name stays as the page title; first line "Lecturer in Physics", second line the department), the profile column, the two-paragraph introduction, the three Research cards (with their heading), the Scientific Computing, Data Science and Engineering block, the "Coming soon" strip (clear the name to hide it), Currently Working On (three items), the Teaching block, the Academic Profile (clear its title to hide it), At a Glance (each item can count automatically: lectures marked available or Data Science, ML and Engineering projects; or use a fixed number; leave number and source empty for a text-only item), Selected Publications (heading, link text; the entries are chosen in the Publications form under "Selected publications on the home page"), the Contact block, the affiliation line and the lists shown in the menu dropdowns. The home page has no other cards |
| Research | The opening question, the four research areas, current research, previous research |
| Teaching | The Teaching page: current courses and teaching resources (PHYS 143 and Laboratory cards) and Research-Informed Learning with the Research connections line |
| Teaching: PHYS 143 page | The PHYS 143 page text outside the lecture tables: title, course structure, practice questions, why this course matters, reference chapters, expected skills, applications |
| Teaching: PHYS 143 lectures | The weekly programme and every lecture page: title, summary, learning objectives, file links, the three contact headings and status (available or coming soon) |
| Teaching: practice questions | The multiple-choice questions for each lecture (choose a lecture, then edit its questions, options, correct option and explanation) |
| Teaching: Laboratory courses | The Laboratory page: course cards and the shared uncertainty lecture card |
| Projects | The Projects page: overview and research projects (KEWPIE3 with its topic line, Fusion dynamics) |
| Data Science, ML and Engineering | The page: opening statement, the OpenClassrooms programme, project cards in three groups (Data Engineering, Machine Learning and Retrieval, Data Analysis) each with a topic line and Problem, Approach, Technical implementation, Validation and Outcome sections, and the Technical areas list |
| Publications | All publications in five groups (Journal articles and proceedings, Preprints, Manuscripts in preparation, Theses, Conference contributions), the year filter buttons,  |
| CV page | The CV summary page (education, appointments, awards, skills) |
| Students | The Students page |
| About page (Academic Profile) | The Academic Profile page that the About menu item opens: background paragraphs, education, appointments, awards, teaching line and CV links |
| Contact | The Contact page: name, position, University and Professional emails, office and the LinkedIn link (emails and office come from Site settings) |
| Site settings | Email addresses, phone, office, profile links (Google Scholar, ORCID, GitHub, LinkedIn), the footer lines and the banner lines |

The **Media** tab uploads files: lecture PDFs (PHYS 143, PHYS 105), the CV PDF and images.

## Common tasks

**Add a publication.** Form: Publications. Open the right group (for example "Journal articles"), click **Add an entry**, paste the reference in "Reference text", and set the filter id to `2026`, `2024`, `2023`, `earlier` (2020 and before) or `pending` (preprints and manuscripts in preparation). To show it on the home page, add a line under "Selected publications on the home page".

**Publish a lecture (for example Lecture 6).** First upload the PDFs in the Media tab (folder `PHYS143`, for example inside `lecture_6`). Then open the form "Teaching: PHYS 143 lectures", find the lecture, set Status to `available`, and fill in the title, summary, learning outcomes and the PDF paths (for example `PHYS143/lecture_6/lecture06_xxx.pdf`). Every lecture page shows four equal buttons under the title: Open lecture slides, Supplementary, Tutorial and Practice questions. Each of the first three opens the PDF in the matching field; leave a path empty and that button shows a disabled "Coming soon". The Practice questions button opens that lecture's own quiz page straight away (`phys143-lecture-N-practice.html`, just the title, a link back to the lecture and the twenty questions); set "Button: Practice questions" to `soon` to show it as Coming soon. The weekly programme rows show the same four links. Setting Status back to `soon` shows the single "Coming soon" page again.

**Add a research project.** Form: Research, "Current research", **Add**. Fill in the status label, a short name (shown on the home page), the title and the paragraphs.

**Add a project card.** Form: Data Science, ML and Engineering, "Groups of projects", open a group, **Add** under "Projects in this group", then fill in the description sections. Research projects such as KEWPIE3 are in the Projects form under "Research projects".

**Change contact details.** Form: Site settings. The Contact page, the footer and the home page links all read from it.

**Add a lecture 13.** In the form "Teaching: PHYS 143 lectures", add the lecture to a group. Then, on github.com, open `phys143-lecture-12.html`, choose **Raw**, copy it, create a new file `phys143-lecture-13.html`, paste, and change the number 12 to 13 (in `data-n="12"` and in the title and heading lines).

**Change a page's text.** Open its form, find the section and card, and edit the text. Sections and cards can be added, reordered and removed with the buttons in the form.

**Visitor statistics (GoatCounter).** Create a free account at goatcounter.com and choose a site code (the part before `.goatcounter.com`). In Pages CMS open Site settings, paste the code into "Visitor statistics: GoatCounter site code" and save. Counting starts within a minute on every page, the footer shows "Anonymous visit counts, no cookies", and the dashboard is at `https://yourcode.goatcounter.com`. Leave the field empty to switch counting off. The counter never runs on localhost. The counter is private: the site shows no number or statistics link to visitors. In GoatCounter, under Settings, keep "Allow adding visitor counts on your website" and public dashboard viewing switched off.

## Writing text

In any text field you can use `**bold**`, `*italic*`, `^3^` for a superscript (S^3^ gives S³) and `[link text](address)` for a link. Links to other pages of this site look like `[Research](research.html)`. In the Contact form, `{email}` is replaced by the email address in Site settings.

## What is not edited by a form

These parts are fixed page structure and are edited in the `.html` files on github.com (open the file, click the pencil, change the text between the tags, click **Commit changes**):

- the site name in the banner, the menu labels, breadcrumbs, and the text of the browser tab (the `<title>` line of each page)
- the Sakai disclaimer box
- the body of the uncertainty analysis lecture page (`uncertainty.html`)
- the page layout, colours and fonts (`assets/site.css`)

The CV PDF itself is replaced by uploading a new `Hope_Donglo_CV.pdf` in the Media tab.

## If something goes wrong

Each save is one commit in the repository history. To undo a change, open the file on github.com, click **History**, open the earlier version and restore it. If a data file ever becomes invalid, the page keeps showing the content that is built into the page until the file is fixed.

## Editing the files directly (without Pages CMS)

Every form edits one file in the `data` folder (`data/pages/*.json`, `data/research.json`, `data/projects.json`, `data/publications.json`, `data/lectures.json`, `data/site.json`) or the practice questions in `quizzes/lectureN.json`. You can also edit these on github.com with the pencil icon. Keep all text in double quotes with commas between items.

## Page addresses

The menu on every page is Home, Research, Teaching, Projects, Data Science, ML and Engineering, Students, About (which opens the Academic Profile page), then CV, Publications and Contact; Home is the site title. The same list appears in the footer. The menu items are fixed page structure (`tools/build_shell.py`); only the dropdown lists are edited in Pages CMS. Projects holds the research software; the data science, machine learning and engineering work is on its own page, **Data Science, ML and Engineering** (`data-engineering.html`). Data and Computation became Projects (`projects.html`). These old addresses stay as small redirect pages so old links still work, and must not be deleted: `data-computation.html` (forwards to Projects), `data-science.html` (forwards to Data Science, ML and Engineering) and `student-research.html` (forwards to Students). The old link `projects.html#data-ml` also forwards to Data Science, ML and Engineering.

The practice quiz of lecture N lives at `phys143-lecture-N-practice.html`. The old `practice.html` (and `practice.html#lecture-N`) and `phys143-lecture-N.html#practice` forward to it. To add a quiz page for a new lecture, run `python3 tools/make_lecture_pages.py`, or copy an existing practice page and change the number.

**Menu dropdowns.** Research, Teaching, Projects, Data Science ML and Engineering, Students and Publications open a dropdown (hover, click, Enter or touch). Edit the lists in Form: Home, "Menu dropdown lists"; the page reads them on load. After editing, ask for `python3 tools/build_shell.py` to refresh the no-JavaScript copy. The old about.html address forwards to the home page About card.

**Sticky menu.** The menu bar stays pinned at the top of every page while scrolling, including the Uncertainty and lecture pages. Its height is measured automatically, so anchor links, the profile column and the lecture contents bar sit below it. On phones it opens as a scrollable list under the bar. An open menu or dropdown closes when you swipe up on the list, scroll the page, press Escape, tap outside it, or tap "Close menu" at the bottom of the phone list or "Close" in the bar (laptop dropdown arrows flip upward while open and close when clicked again); the bar itself stays pinned.

**Header animation.** The home page header fades and slides in, with the rule drawing itself, and it is switched off automatically for visitors who ask their device to reduce motion. The header line on other pages is in Site settings ("Header line on other pages").

**Homepage motion.** The fusion figure beside Superheavy-Element Synthesis, the counting numbers and the gentle section reveal all switch off for visitors who ask their device to reduce motion (they then see a still figure and the final numbers). The figure itself is drawn in `assets/render.js`; only its description is editable in the CMS.

**Upcoming project teaser.** Form: Data Science, ML and Engineering, "Upcoming projects". Each card has a marker (for example "Coming soon"), a name, a one-line purpose, a short description, topic chips and a closing note. Add or remove cards there; keep to what is safe to show publicly (no clients, prices or plans).

**Figures on project cards.** Research projects (Form: Projects) and data projects accept a "Figures" list: image path (upload to `assets/figures`), width and height in pixels, alt text, caption, and optionally a large version (click or tap to enlarge; Escape closes) and a source link. The KEWPIE3 card groups its figures under headings: set "Group heading" and "One-line introduction" on the first figure of a group (here "Comparison with data": theory versus experiment, then the theory/experiment ratio; then "Predictions"). Figures appear in list order.
