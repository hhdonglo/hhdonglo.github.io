# lecture-view/

What happens when a lecture card on Course and Content is clicked: the lecture view, and presentation mode for teaching in class.

| File | Does |
| --- | --- |
| `state.js` | The rules, as plain functions (no screen, no files): where a lecture stands (held, due and not yet held, due now, next, not yet due), whether the slides can be presented (a PDF), the keys, moving between pages, the timer text and the page address. Change a key or a label here. |
| `view.js` | The lecture view: description, status, quiz bank, every document by role, and the Present button. If there are no slides, or they are a Word file, it says so plainly and offers Attach slides. |
| `present.js` | Presentation mode: full screen, one slide at a time, slide counter, timer, dark or light surround, blank screen, exit. |
| `slide-cache.js` | The rules for smooth slide changes, as plain functions: which pages to have ready (the current, next, previous and after-next), the size a page is drawn at to fit the screen, and which drawn pages are kept. |
| `slide-show.js` | Swaps slides without a blink: the slide on screen stays until the next one is drawn off screen, then they are swapped in one step. Draws the neighbouring pages in advance and drops them when the screen size changes. |
| `slide-renderer.js` | Draws one PDF page onto an off-screen canvas, using the bundled PDF reader. |
| `vendor/pdfjs/` | The PDF reader (pdf.js 4.10.38, Apache-2.0), unchanged, shipped inside CM. Nothing is loaded from the internet. |
| `lecture-view.css` | The look of both. |

Where the Present button is: on every lecture card whose slides are a PDF (gold, first in the row of chips), in the lecture view, and in the slides panel that opens when the Slides chip is clicked. All three start the same presentation (`present.js`).

A document's Open button uses the existing panel (`../lecture-viewer.js`), so Update, Replace, Delete and "Wrong file?" are unchanged, and so is Edit on the card (`../lecture-list.js`). The card's title or any free part of the card opens the lecture view.

## Presentation keys

Next: right arrow, down arrow, space, Page Down, Enter. Previous: left arrow, up arrow, Page Up. First and last: Home, End. B blanks the screen, T changes dark or light (remembered), P pauses the timer, R resets it, H shows the keys, Esc exits. Clicking the right two thirds of the slide goes forward, the left third back. The bar at the bottom hides after three seconds without the mouse moving.

## Notes

- Full screen is asked for inside the click on Present, before the file is read (the browser refuses it otherwise), and any open panel is closed first. The slide fills the screen; the bar at the bottom fades after three seconds. Esc leaves full screen and the presentation.
- Smooth changes: the next, previous and after-next slides are drawn in advance at the size of the screen (kept: five pages). Changing slide paints a page that is already drawn onto the one canvas on screen in a single step, so there is no blank or white moment. If a page is not ready yet (a jump to a far slide), the old slide stays until the new one is drawn. The bottom bar and the dark or light surround are not redrawn; only the slide count changes. A change of window size redraws the current slide first, then the neighbours. If the PDF reader cannot read a file, CM falls back to the PDF viewer built into CM (that fallback can blink). Fonts that a PDF does not embed are drawn with the system's fonts.
- Slides are drawn by the bundled PDF reader, so nothing is converted or sent anywhere. The page count comes from `cm:lectureFileView` (`../../lecture-files/ipc.js`, through `peek.js`). The dark or light choice changes the surround of the slide; the slide keeps the colours of its PDF.
- The quiz projector also reacts when full screen ends. Presentation mode stops that event first (capture listener in `present.js`), so the scan code window does not open when a lecture ends. No code of the quiz projector was changed.
- Held and due come from `cm:lectureProgress` (the same numbers as the Class Analytics lecture card). A course without a lecture target shows no status.

Tests: `test/lecture-view.test.js`, `test/slide-show.test.js`.
