"""Write phys143-introduction.html and phys143-introduction-practice.html (the introduction is not a numbered lecture, so it is not in data/lectures.json).
The quiz is quizzes/lecture0.json, built by tools/quiz_src/lecture0.py."""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "phys143-lecture-1.html"), encoding="utf-8").read()
head = src[:src.index('<main id="main">')]
tail = src[src.index("</main>"):]
disc = re.search(r'<aside class="disclaimer".*?</aside>', src, re.S).group(0)
SUM = "Additional practice material on physical quantities, units and measurement uncertainty: SI units and conversions, dimensional consistency, significant figures, error and uncertainty, and order-of-magnitude estimates. Official course information is on Sakai."
OUT = ["Convert quantities to SI units and check that equations are dimensionally consistent.",
       "State a measurement with its uncertainty and the right number of significant figures.",
       "Round the result of a calculation correctly.",
       "Distinguish error from uncertainty, and accuracy from precision.",
       "Estimate a quantity to an order of magnitude."]
def res(path, label, primary=False):
    return ('<div class="res"><span class="res-l">%s</span><span class="res-b"><a class="btn%s" href="%s" target="_blank" rel="noopener">Preview<span class="vh"> %s for the introduction</span><span class="vh"> (opens in a new tab)</span></a>'
            '<a class="btn" href="%s" download>Download<span class="vh"> %s for the introduction</span></a></span></div>') % (label, " primary" if primary else "", path, label, path, label)
buttons = ('<div class="lecture-buttons" role="group" aria-label="Introduction resources">' + res("PHYS143/introduction/introduction_slides.pdf", "Slides", True)
           + res("PHYS143/introduction/introduction_handout.pdf", "Handout") + res("PHYS143/introduction/introduction_supplement.pdf", "Supplementary note")
           + res("PHYS143/introduction/introduction_tutorial.pdf", "Tutorial sheet")
           + '<a class="btn" href="phys143-introduction-practice.html">Practice questions<span class="vh"> for the introduction</span></a></div>')
title = "Introduction — Physical quantities and measurement"
h = re.sub(r"<title>.*?</title>", "<title>%s | PHYS 143 | Hope Donglo</title>" % title, head, flags=re.S)
h = re.sub(r'<meta name="description" content=".*?">', '<meta name="description" content="PHYS 143 introduction: slides, handout, supplementary note, tutorial sheet and practice questions on physical quantities, units and uncertainty.">', h, flags=re.S)
main = ('<main id="main"><div class="wrap">\n<p class="crumb"><a href="index.html">Home</a> &rsaquo; <a href="teaching.html">Teaching</a> &rsaquo; <a href="phys143.html">PHYS 143</a> &rsaquo; Introduction</p>\n'
        '<h2 id="lecture">%s</h2>\n<p class="sec-sub">%s</p>\n<div>%s'
        '<details class="fold" id="objectives" open><summary>Learning objectives</summary><div class="ov-card"><p>Students should be able to:</p><ul>%s</ul></div></details>'
        '<nav class="pager" aria-label="Lecture navigation"><span></span><a class="toc" href="phys143.html#weekly">PHYS 143 contents</a><a class="next" href="phys143-lecture-1.html">Lecture 01 &rarr;</a></nav></div>\n%s\n') % (
        title, SUM, buttons, "".join("<li>%s</li>" % o for o in OUT), disc)
open(os.path.join(ROOT, "phys143-introduction.html"), "w", encoding="utf-8").write(h + main + tail)
pt = "Introduction — Practice questions"
h2 = re.sub(r"<title>.*?</title>", "<title>%s | PHYS 143 | Hope Donglo</title>" % pt, head, flags=re.S)
h2 = re.sub(r'<meta name="description" content=".*?">', '<meta name="description" content="PHYS 143 introduction — practice questions: twenty multiple-choice questions for practice, not assessment.">', h2, flags=re.S)
pm = ('<main id="main"><div class="wrap">\n<p class="crumb"><a href="index.html">Home</a> &rsaquo; <a href="teaching.html">Teaching</a> &rsaquo; <a href="phys143.html">PHYS 143</a> &rsaquo; <a href="phys143-introduction.html">Introduction</a> &rsaquo; Practice questions</p>\n'
      '<h2 id="practice-title">%s</h2>\n<p class="sec-sub"><a href="phys143-introduction.html">&larr; Back to the introduction</a> &middot; For practice, not assessment. Progress and best scores are stored only in this browser.</p>\n'
      '<div class="ov-card"><div id="quiz-app" class="quiz" data-lecture="0"><noscript>The practice questions need JavaScript. Please enable it in your browser.</noscript></div></div>\n%s\n') % (pt, disc)
t2 = tail.replace('<script src="assets/site.js"></script>', '<script src="assets/site.js"></script>\n<script src="assets/tracking.js"></script>\n<script src="assets/practice.js" charset="utf-8"></script>')
open(os.path.join(ROOT, "phys143-introduction-practice.html"), "w", encoding="utf-8").write(h2 + pm + t2)
print("introduction pages written")
