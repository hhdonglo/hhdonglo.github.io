# lecture-files/

Which files are the lecture documents, what each one is, and what the lecturer can do with it. Shown on Course and Content (`app/lecture-list.js`, `app/lecture-viewer.js`).

| File | Does |
| --- | --- |
| `types.js` | Only PDF and Word (`.docx`) files can be lecture documents. Tells figures apart by name or folder (`fig_agree.pdf`, `figures/`). Pure. |
| `classify.js` | Slides or lecture notes, handout, tutorial, supplement or reference, from the file name, the folder, the first page and the page count. Returns a confidence and the reasons. Pure. |
| `peek.js` | Reads the first two pages of a PDF or Word file (and its page count), remembered by path, size and date. |
| `describe.js` | A title and one sentence quoted from the first page of the notes. Never written from outside knowledge. Pure. |
| `build.js` | The decisions: documents or ignored (with a reason), one document per role per lecture, the rows of the cards. Pure. |
| `store.js` | The lecturer's choices and edited descriptions, `data/lecture-files.json` in the course folder. |
| `actions.js` | Choose another file, replace, take off the lecture, move to Removed, undo. |
| `ipc.js` | `cm:lectureOverview` and `cm:lectureFile*`, `cm:lectureDescription`. |

## What is ignored, and why

Every file in the folder is either a lecture document or ignored with a reason, and the card page lists the counts so nothing disappears silently:

- **Figures**: names such as `fig_*`, `figure*`, `img*`, `plot*`, folders such as `figures/` or `images/`, and a one page PDF with almost no text.
- **Not PDF or Word**: Markdown, text, tables and the like (working notes). Quiz banks load through their own paths.
- **Backups, drafts and copies**: folders named backup, old, removed, working and similar; names with draft, old, copy, v2, "(1)".
- **Duplicates**: the same file name twice, or the same bytes and first page under a plain name.
- **Extra documents**: a second file with the same role as one already chosen (for example three plain lecture files). The best one is taken; the others are ignored.
- **No lecture number found**.

Each ignored PDF or Word file can be added back from its lecture card (choose the role, press Add back). The lecture's Files count is the documents taken in, never the ignored ones. The loaders (course pack import, course folder, linked folder) still copy or read the whole folder, and never alter the originals; this module is the one place that decides what a lecture shows.

## Order of authority for a role

1. The lecturer's choice (`lecture-files.json`; a role taken off stays empty).
2. The course's own list (`data/lectures.json`).
3. CM's guess, with its confidence shown on the chip (green 75 percent or more, amber 50 to 74, red below). A plain name with no keyword is a weak guess; other candidates for the same role lower the confidence further, so a doubtful pick is visible.

## Viewing and changing a file

A chip opens the document in a panel: a PDF in the PDF viewer, a Word file as text. In the panel: choose another file for the role ("Wrong file?"), Update (opens the file in its own program, then "Show the updated file"), Replace (a PDF or Word file from the computer; the old file stays in the folder), Delete (asks first: take it off the lecture, or take it off and move the file to `removed/` in the course folder). Nothing is erased. Undo is offered after each change. A linked folder is the lecturer's own: CM never moves or deletes files there.

## Descriptions

A description comes from the course's own text, then the lecturer's edit, then a draft quoted from the notes (title and first question or sentence of the opening page), marked "Drafted from <file>". Keep saves it; Edit changes it. When the notes give nothing usable, the card says so and no text is made up.

The lecture view and presentation mode that open from a card are in `app/lecture-view/` (see its README).

Tests: `test/lecture-files.test.js`.
