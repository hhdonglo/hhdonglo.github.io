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
| Home | The name line, role, statement and buttons, the three pathway cards, section headings, the shortcuts and the plain affiliation line |
| Research | The opening question, the four research areas, current research, previous research, and the "Currently" list on the home page |
| Teaching | The Teaching page: the PHYS 143, Laboratory and Student Research cards and Research-Informed Learning |
| Teaching: PHYS 143 page | The PHYS 143 page text outside the lecture tables: title, course structure, practice questions, why this course matters, reference chapters, expected skills, applications |
| Teaching: PHYS 143 lectures | Each lecture's title, summary, learning outcomes, file links and status (available or coming soon) |
| Teaching: practice questions | The multiple-choice questions for each lecture (choose a lecture, then edit its questions, options, correct option and explanation) |
| Teaching: Laboratory courses | The Laboratory page: course cards and the shared uncertainty lecture card |
| Teaching: Student Research | The Student Research page |
| Projects | The Projects page: introduction, certification and each project card |
| Publications | All publications, the year filter buttons, and the three selected publications on the home page |
| CV page | The CV summary page (education, appointments, awards, skills) |
| About | The About page |
| Contact | The Contact page text and buttons |
| Site settings | Email addresses, phone, office, profile links (Google Scholar, ORCID, GitHub, LinkedIn), the footer lines and the banner lines |

The **Media** tab uploads files: lecture PDFs (PHYS 143, PHYS 105), the CV PDF and images.

## Common tasks

**Add a publication.** Form: Publications. Open the right group (for example "Journal articles"), click **Add an entry**, paste the reference in "Reference text", and set the filter id to `2026`, `2024`, `2023`, `earlier` (2020 and before) or `pending` (preprints and manuscripts in preparation). To show it on the home page, add a line under "Selected publications on the home page".

**Publish a lecture (for example Lecture 6).** First upload the PDFs in the Media tab (folder `PHYS143`, for example inside `lecture_6`). Then open the form "Teaching: PHYS 143 lectures", find the lecture, set Status to `available`, and fill in the title, summary, learning outcomes and the PDF paths (for example `PHYS143/lecture_6/lecture06_xxx.pdf`). Leave the tutorial or supplement path empty if there is none; the page shows "not available". Setting Status back to `soon` shows "Coming soon" again.

**Add a research project.** Form: Research, "Current research", **Add**. Fill in the status label, a short name (shown on the home page), the title and the paragraphs.

**Add a project card.** Form: Projects, "Projects", **Add**.

**Change contact details.** Form: Site settings. The Contact page, the footer and the home page links all read from it.

**Change a page's text.** Open its form, find the section and card, and edit the text. Sections and cards can be added, reordered and removed with the buttons in the form.

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

`projects.html` and `student-research.html` replaced `data-science.html` and `students.html`. The old addresses stay in the repository as small redirect pages, so old links still work. Do not delete them.
