"""Rewrite the navigation menu on every page (the menu is fixed page structure, not edited in Pages CMS)."""
import glob, re, os, json, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIMARY = [("index.html", "Home"), ("research.html", "Research"), ("teaching.html", "Teaching"), ("projects.html", "Projects"),
           ("data-engineering.html", "Data Science, ML and Engineering"), ("students.html", "Students"), ("about.html", "About")]
UTILITY = [("cv.html", "CV"), ("publications.html", "Publications"), ("contact.html", "Contact")]
# page -> menu item it belongs to (exact page gets aria-current="page", a child page gets "true")
HOME = json.load(open(os.path.join(ROOT, "data", "pages", "home.json"), encoding="utf-8"))
SUB = {x["url"]: x["links"] for x in HOME["blocks"]}
CHILD = {"superheavy.html": "research.html", "phys143.html": "teaching.html", "laboratory.html": "teaching.html", "uncertainty.html": "teaching.html"}

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
            lis = "".join(f'<li><a href="{html.escape(i["url"])}">{html.escape(i["label"])}</a></li>' for i in SUB[h])
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
