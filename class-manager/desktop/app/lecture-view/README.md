# lecture-view/

What happens when a lecture card on Course and Content is clicked: the lecture view, and presentation mode for teaching in class.

| File | Does |
| --- | --- |
| `state.js` | The rules, as plain functions (no screen, no files): where a lecture stands (held, due and not yet held, due now, next, not yet due), whether the slides can be presented (a PDF), the keys, moving between pages, the timer text and the page address. Change a key or a label here. |
| `view.js` | The lecture view: description, status, quiz bank, every document by role, and the Present button. If there are no slides, or they are a Word file, it says so plainly and offers Attach slides. |
| `present.js` | Presentation mode: full screen, one slide at a time, slide counter, timer, dark or light surround, blank screen, exit. |
| `lecture-view.css` | The look of both. |

A document's Open button uses the existing panel (`../lecture-viewer.js`), so Update, Replace, Delete and "Wrong file?" are unchanged, and so is Edit on the card (`../lecture-list.js`). The card's title or any free part of the card opens the lecture view.

## Presentation keys

Next: right arrow, down arrow, space, Page Down, Enter. Previous: left arrow, up arrow, Page Up. First and last: Home, End. B blanks the screen, T changes dark or light (remembered), P pauses the timer, R resets it, H shows the keys, Esc exits. Clicking the right two thirds of the slide goes forward, the left third back. The bar at the bottom hides after three seconds without the mouse moving.

## Notes

- Slides are drawn by the PDF viewer built into CM, so nothing is converted or sent anywhere. The page count comes from `cm:lectureFileView` (`../../lecture-files/ipc.js`, through `peek.js`). The dark or light choice changes the surround of the slide; the slide keeps the colours of its PDF.
- The quiz projector also reacts when full screen ends. Presentation mode stops that event first (capture listener in `present.js`), so the scan code window does not open when a lecture ends. No code of the quiz projector was changed.
- Held and due come from `cm:lectureProgress` (the same numbers as the Class Analytics lecture card). A course without a lecture target shows no status.

Tests: `test/lecture-view.test.js`.
