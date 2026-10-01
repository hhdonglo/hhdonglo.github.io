"""Write quizzes/lectureN.js from tools/quiz_src/lectureN.py (each defines L, a Lecture)."""
import importlib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "quizzes")
sys.path.insert(0, HERE)

def main():
    nums = [int(a) for a in sys.argv[1:]] or [n for n in range(1, 13)]
    for n in nums:
        path = os.path.join(HERE, f"lecture{n}.py")
        if not os.path.exists(path):
            continue
        mod = importlib.import_module(f"lecture{n}")
        L = mod.L
        data = {"lecture": L.number, "title": L.title, "questions": L.qs}
        js = ("window.PHYS143_QUIZ = window.PHYS143_QUIZ || {};\n"
              f"window.PHYS143_QUIZ[{L.number}] = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, f"lecture{n}.js"), "w", encoding="utf-8") as f:
            f.write(js)
        print(f"lecture{n}.js: {len(L.qs)} questions")

main()
