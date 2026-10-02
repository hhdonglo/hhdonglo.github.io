"""Create phys143-lecture-N.html for every lecture in data/lectures.json (one page per lecture, content drawn by assets/render.js).
To add a lecture 13 by hand: copy phys143-lecture-12.html to phys143-lecture-13.html and change data-n and the title."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, "data", "lectures.json"), encoding="utf-8"))
src = open(os.path.join(ROOT, "phys143.html"), encoding="utf-8").read()
head = src[:src.index('<main id="main">')]
tail = src[src.index("</main>"):]
disc = re.search(r'<aside class="disclaimer".*?</aside>', src, re.S).group(0)
for g in d["groups"]:
    for l in g["lectures"]:
        n = l["number"]; soon = l["status"] == "soon"
        title = f"Lecture {n:02d} — " + ("Coming soon" if soon else l["title"])
        h = re.sub(r"<title>.*?</title>", f"<title>{title} | PHYS 143 | Hope Donglo, Academic Website</title>", head, flags=re.S)
        h = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="PHYS 143 {title}: learning objectives, slides, tutorial, supplementary note and practice questions.">', h, flags=re.S)
        main = (f'<main id="main"><div class="wrap">\n<p class="crumb"><a href="index.html">Home</a> &rsaquo; <a href="teaching.html">Teaching</a> &rsaquo; <a href="phys143.html">PHYS 143</a> &rsaquo; Lecture {n:02d}</p>\n'
                f'<h2 id="lecture">{title}</h2>\n<p class="sec-sub"></p>\n<div data-render="lecture" data-n="{n}"></div>\n{disc}\n')
        t = tail
        open(os.path.join(ROOT, f"phys143-lecture-{n}.html"), "w", encoding="utf-8").write(h + main + t)
print("lecture pages written")
