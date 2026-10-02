# Undergraduate Physics Lectures

PHYS 143. Lecturer: Hope DONGLO.

Disclaimer: this is an independent personal website, open to anyone who finds it useful. Official course information and instructions for registered students are provided on Sakai; students at the University of Ghana should visit Sakai for official course information.

Contact: Physics Department, Office 24. Email hdonglo@ug.edu.gh or hkdonglo@gmail.com. Tel. 020 48 10 352. LinkedIn: https://www.linkedin.com/in/hopedonglo.

Website: https://hhdonglo.github.io/

Practice questions: https://hhdonglo.github.io/practice.html (multiple-choice, 20 per lecture, drafts for review). Sources and checks are in `tools/`.

## PHYS 143

| No. | Topic | Lecture deck | Tutorial | Supplement |
|---|---|---|---|---|
| 1 | Vectors | [PDF](PHYS143/lecture_1/lecture01_vectors.pdf) | Not available | [PDF](PHYS143/lecture_1/lecture01_supplement.pdf) |
| 2 | Motion | [PDF](PHYS143/lecture_2/lecture02_motion.pdf) | [PDF](PHYS143/lecture_2/lecture02_tutorial.pdf) | [PDF](PHYS143/lecture_2/lecture02_supplement.pdf) |
| 3 | Newton's laws | [PDF](PHYS143/lecture_3/lecture03_forces.pdf) | [PDF](PHYS143/lecture_3/lecture03_tutorial.pdf) | [PDF](PHYS143/lecture_3/lecture03_supplement.pdf) |
| 4 | Work and kinetic energy | [PDF](PHYS143/lecture_4/lecture04_work.pdf) | [PDF](PHYS143/lecture_4/lecture04_tutorial.pdf) | [PDF](PHYS143/lecture_4/lecture04_supplement.pdf) |
| 5 | Potential energy and energy conservation | [PDF](PHYS143/lecture_5/lecture05_energy.pdf) | [PDF](PHYS143/lecture_5/lecture05_tutorial.pdf) | [PDF](PHYS143/lecture_5/lecture05_supplement.pdf) |
| 6 | Coming soon | Coming soon | Coming soon | Coming soon |
| 7 | Impulse and momentum | [PDF](PHYS143/lecture_7/lecture07_momentum.pdf) | [PDF](PHYS143/lecture_7/lecture07_tutorial.pdf) | [PDF](PHYS143/lecture_7/lecture07_supplement.pdf) |
| 8 | Rotation | [PDF](PHYS143/lecture_8/lecture08_rotation.pdf) | [PDF](PHYS143/lecture_8/lecture08_tutorial.pdf) | [PDF](PHYS143/lecture_8/lecture08_supplement.pdf) |
| 9 | Temperature and heat | [PDF](PHYS143/lecture_9/lecture09_temperature.pdf) | [PDF](PHYS143/lecture_9/lecture09_tutorial.pdf) | [PDF](PHYS143/lecture_9/lecture09_supplement.pdf) |
| 10 | Thermal properties of matter | [PDF](PHYS143/lecture_10/lecture10_thermal_properties.pdf) | [PDF](PHYS143/lecture_10/lecture10_tutorial.pdf) | [PDF](PHYS143/lecture_10/lecture10_supplement.pdf) |
| 11 | First law of thermodynamics | [PDF](PHYS143/lecture_11/lecture11_first_law.pdf) | [PDF](PHYS143/lecture_11/lecture11_tutorial.pdf) | [PDF](PHYS143/lecture_11/lecture11_supplement.pdf) |
| 12 | Second law of thermodynamics | [PDF](PHYS143/lecture_12/lecture12_second_law.pdf) | [PDF](PHYS143/lecture_12/lecture12_tutorial.pdf) | [PDF](PHYS143/lecture_12/lecture12_supplement.pdf) |

## Laboratory skills (under development)

Uncertainty analysis, a three-contact lecture supporting the laboratory courses PHYS 105, 106 and 205: [page](https://hhdonglo.github.io/uncertainty.html), [deck PDF](PHYS105/lecture_1/lecture01_uncertainty.pdf). The tutorial and supplement are not yet published. This page is still under development.

## Structure

```
PHYS143/
  lecture_N/   deck, tutorial and supplement PDFs
index.html     home page for GitHub Pages (static HTML and CSS, light and dark mode)
assets/thumbs/ title-slide previews of each deck (WebP)
```

## Editing

See [EDITING.md](EDITING.md). Content is edited with Pages CMS forms (configured in `.pages.yml`) and stored in `data/*.json`, `data/pages/*.json` and `quizzes/lectureN.json`; pages are drawn by `assets/render.js`.

## Tools

- `tools/build_shell.py` rewrites the menu on every page.
- `tools/make_lecture_pages.py` creates `phys143-lecture-N.html` from `data/lectures.json`.
- `tools/bake.py` (with `tools/bake.js`, Playwright and a local server on port 8765) stores the rendered content in each page as the no-JavaScript fallback. Run it after changing the data files.
