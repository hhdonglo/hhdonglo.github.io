# Editing the site on github.com

You can change the most common content without touching any page layout. Everything below is edited directly on github.com: open the file, click the pencil icon (Edit this file), change the text, then click **Commit changes**. The live site updates about a minute later (refresh the page with Ctrl+Shift+R, or Cmd+Shift+R on a Mac).

Each edited file is plain text in JSON format. Two rules keep it valid:

1. Keep every piece of text inside double quotes, and keep the commas between items. The last item in a list has no comma after it.
2. If a mistake breaks a file, the page falls back to its older built-in copy. Fix the file, or open the file's History and click the previous version to restore it.

## Where each item lives

| What | File |
| --- | --- |
| Publications, filters, selected publications on the home page | `data/publications.json` |
| Research areas, current research, previous research, "Currently" chips on the home page | `data/research.json` |
| Projects page (introduction, certification, project cards) | `data/projects.json` |
| PHYS 143 lectures: titles, summaries, learning outcomes, file links, status | `data/lectures.json` |
| Email, phone, office, profile links (Google Scholar, ORCID, GitHub, LinkedIn), footer line | `data/site.json` |

Pages not listed here (About, CV, Student Research, Teaching, Laboratory) are ordinary pages: open the `.html` file and edit the text between the tags.

## Writing text

Inside any text value you can use:

- `**bold**` for bold, `*italic*` for italics, `^3^` for a superscript (S^3^ gives S³)
- `[link text](https://example.org)` for a link; links to other pages of this site are written like `[Research](research.html)`

Write accents and symbols as ordinary characters (é, –, ’).

## Common changes

**Add a publication.** In `data/publications.json`, find the group (for example "Journal articles") and add an item inside its `"items"` list, after a comma:

```json
{ "tag": "2026", "text": "A. Author and **H. Donglo** (2026). Title of the paper. *Journal*, Vol. 1, pp. 1-10. [DOI](https://doi.org/...)" }
```

`tag` decides which year button shows it. Use `"2026"`, `"2024"`, `"2023"`, `"earlier"` (2020 and before) or `"pending"` (preprints and manuscripts in preparation). To make a new year button, add a line to `"filters"`, for example `{ "id": "2027", "label": "2027" }`, and use `"tag": "2027"` on its items.

**Show a publication on the home page.** Add or change a line in the `"home"` list of the same file (`label` is the small year or word on the left).

**Move a manuscript to published.** Cut its item from the "Manuscripts in preparation" group, paste it into "Journal articles", and change its text and `tag`.

**Add a research project.** In `data/research.json`, add a block to `"current"` (or `"previous"`):

```json
{ "status": "Current project", "chip": "Short name for the home page", "title": "Project title", "paragraphs": ["**Objective:** ...", "**Output:** ..."] }
```

Research areas are the four items in `"areas"`; they are numbered automatically.

**Add a project on the Projects page.** In `data/projects.json`, copy one block inside `"projects"` and change `title`, `type`, `description`, `details` (label and text pairs), `tools` (the small tags) and `repo` (GitHub link).

**Publish a lecture.** In `data/lectures.json`, find Lecture 6 (it currently has `"status": "soon"`) and replace its block with:

```json
{
  "number": 6,
  "title": "Title of the lecture",
  "status": "available",
  "summary": "One sentence on what the lecture covers.",
  "outcomes": ["First outcome.", "Second outcome."],
  "slides": "PHYS143/lecture_6/lecture06_xxx.pdf",
  "tutorial": "PHYS143/lecture_6/lecture06_tutorial.pdf",
  "supplement": "PHYS143/lecture_6/lecture06_supplement.pdf"
}
```

First upload the PDFs: open the folder on github.com, click **Add file**, **Upload files**, drag the PDFs in and commit. Leave out `tutorial` or `supplement` if a file does not exist yet; the page then shows "not available". To mark a lecture as coming soon again, use `"status": "soon"` and remove the other fields except `number` and `note`.

**Change contact details.** Edit `data/site.json`. The Contact page, the footer and the home page links all read from it.

## Page addresses

The pages `projects.html` and `student-research.html` replaced `data-science.html` and `students.html`. The old addresses stay in the repository as small redirect pages, so old links still work. Do not delete them.

## Practice questions

The quiz questions are separate files in the `quizzes` folder and are edited as before.
