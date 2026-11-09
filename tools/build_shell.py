"""Rewrite the navigation menu on every page (the menu is fixed page structure, not edited in Pages CMS)."""
import glob, re, os, json, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Main menu: top-level items in order. A top-level item with page None has no page of its own;
# its label opens the drop-down.
PRIMARY = [("index.html", "Home"), ("research.html", "Research"), ("teaching.html", "Teaching"),
           ("students.html", "Students"), ("about.html", "About"), (None, "Resources")]
UTILITY = []
# Drop-down children; each links to an existing page or section anchor.
SUB = {
    "research.html": [("Research Areas", "research.html#programme"), ("Current Projects", "projects.html"),
                      ("Publications", "publications.html"), ("Software / Codes", "kewpie3.html")],
    "teaching.html": [("Courses", "teaching.html#lecture-courses"), ("Laboratory Guides", "laboratory.html"),
                      ("Resources", "teaching.html#student-resources")],
    "students.html": [("Opportunities", "students.html#research-projects")],
    "about.html": [("Biography", "about.html"), ("CV", "cv.html"), ("Contact", "contact.html")],
    "Resources": [("Downloads", "class-manager-app.html"), ("Data and Tools", "data-engineering.html")],
}
# page -> menu item it belongs to (exact page gets aria-current="page", a child page gets "true")
CHILD = {"reaction-dynamics.html": "research.html", "earlier-research.html": "research.html",
         "projects.html": "research.html", "kewpie3.html": "research.html", "publications.html": "research.html",
         "phys143.html": "teaching.html", "mock-exam.html": "teaching.html", "laboratory.html": "teaching.html",
         "uncertainty.html": "teaching.html", "student-research.html": "students.html",
         "cv.html": "about.html", "contact.html": "about.html",
         "class-manager-app.html": "Resources", "data-engineering.html": "Resources", "numeralanalytics.html": "Resources"}

def menu(page):
    cur = CHILD.get(page) or (page if re.match(r"phys143-lecture-\d+(-practice)?\.html$", page) is None else "teaching.html")
    if re.match(r"phys143-lecture-\d+(-practice)?\.html$", page): cur = "teaching.html"
    out = ""
    for h, l in PRIMARY:
        key = h or l
        a = ""
        if h and h == page: a = ' aria-current="page"'
        elif key == cur: a = ' aria-current="true"'
        if key in SUB:
            lis = "".join(f'<li><a href="{html.escape(u)}"' + (' aria-current="page"' if u == page else '') + f'>{html.escape(t)}</a></li>' for t, u in SUB[key])
            if h:
                out += f'<div class="dd" data-key="{key}"><a href="{h}"{a}>{l}</a><button type="button" class="dd-btn" aria-expanded="false" aria-label="{l} links"><span aria-hidden="true">&#9662;</span></button><ul class="sub">{lis}</ul></div>'
            else:
                out += f'<div class="dd" data-key="{key}"><button type="button" class="dd-btn dd-label" aria-expanded="false"{a}>{l}<span aria-hidden="true">&#9662;</span></button><ul class="sub">{lis}</ul></div>'
        else:
            out += f'<a href="{h}"{a}>{l}</a>'
    return out

for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    page = os.path.basename(f)
    s = open(f, encoding="utf-8").read()
    if 'id="jump-links"' not in s: continue
    s2 = re.sub(r'(<div class="links" id="jump-links">).*?(</div></div></nav>)', lambda m: m.group(1) + menu(page) + m.group(2), s, flags=re.S)
    if s2 != s: open(f, "w", encoding="utf-8").write(s2)
