"""Rewrite the navigation menu on every page (the menu is fixed page structure, not edited in Pages CMS)."""
import glob, re, os, json, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIMARY = [("index.html", "Home"), ("research.html", "Research"), ("projects.html", "Projects"),
           ("data-engineering.html", "Data Science for Physics"), ("teaching.html", "Teaching"),
           ("publications.html", "Publications"), ("students.html", "Students"), ("about.html", "About")]
UTILITY = [("cv.html", "CV"), ("contact.html", "Contact")]
# page -> menu item it belongs to (exact page gets aria-current="page", a child page gets "true")
# Drop-down children follow the site map; each links to an existing page or section anchor.
SUB = {
    "research.html": [("Research Overview", "research.html#overview"), ("Research Questions", "research.html#questions"),
                      ("Nuclear Reaction Dynamics", "reaction-dynamics.html"), ("Uncertainty Quantification", "research.html#uncertainty")],
    "projects.html": [("KEWPIE3", "kewpie3.html"), ("Other Computational Projects", "data-engineering.html#pipelines")],
    "data-engineering.html": [("Scientific Computing", "data-engineering.html#scientific-computing"), ("Data Science", "data-engineering.html#data-science"),
                              ("Machine Learning", "data-engineering.html#machine-learning"), ("Data Engineering", "data-engineering.html#data-engineering-area")],
    "teaching.html": [("Courses", "teaching.html#lecture-courses"), ("Lecture Notes", "phys143.html#weekly")],
    "publications.html": [("Journal Articles", "publications.html#journal-articles"), ("Preprints", "publications.html#preprints"), ("Theses", "publications.html#theses")],
    "students.html": [("Supervision", "students.html#undergraduate"), ("Project Opportunities", "students.html#research-projects")],
}
CHILD = {"reaction-dynamics.html": "research.html", "phys143.html": "teaching.html", "laboratory.html": "teaching.html", "uncertainty.html": "teaching.html", "kewpie3.html": "projects.html", "student-research.html": "students.html"}

def menu(page):
    cur = CHILD.get(page) or (page if re.match(r"phys143-lecture-\d+(-practice)?\.html$", page) is None else "teaching.html")
    if re.match(r"phys143-lecture-\d+(-practice)?\.html$", page): cur = "teaching.html"
    out = ""
    for i, (h, l) in enumerate(PRIMARY + UTILITY):
        a = ""
        if h == page: a = ' aria-current="page"'
        elif h == cur: a = ' aria-current="true"'
        cls = ""
        if (h, l) in UTILITY: cls = ' class="util first"' if h == UTILITY[0][0] else ' class="util"'
        if h in SUB:
            lis = "".join(f'<li><a href="{html.escape(u)}">{html.escape(t)}</a></li>' for t, u in SUB[h])
            out += f'<div class="dd" data-key="{h}"><a href="{h}"{a}>{l}</a><button type="button" class="dd-btn" aria-expanded="false" aria-label="{l} links"><span aria-hidden="true">&#9662;</span></button><ul class="sub">{lis}</ul></div>'
        else:
            out += f'<a href="{h}"{cls}{a}>{l}</a>'
    return out

for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    page = os.path.basename(f)
    s = open(f, encoding="utf-8").read()
    if 'id="jump-links"' not in s: continue
    s2 = re.sub(r'(<div class="links" id="jump-links">).*?(</div></div></nav>)', lambda m: m.group(1) + menu(page) + m.group(2), s, flags=re.S)
    if s2 != s: open(f, "w", encoding="utf-8").write(s2)
