"""Validate quizzes/lectureN.js. Exit status 1 if any check fails.

Checks per question: four distinct options, exactly one correct index in range,
non-empty explanation and review reference, known type, unique id, no ampersand
used as 'and'. For calculation questions the correct option must equal the stored
computed value to the stated significant figures, and no distractor may equal it.
"""
import glob, json, math, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TYPES = {"concept", "calc", "graph", "misconception"}
EXPECTED = 20
errors = []


def err(msg):
    errors.append(msg)


def parse_number(text):
    t = re.sub(r"<[^>]+>", "", text.replace("<sup>", "e").replace("</sup>", ""))
    t = text.replace("−", "-")
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)(?:×10<sup>(-?\d+)</sup>)?", t)
    if not m:
        m2 = re.match(r"^\s*(-?\d+(?:\.\d+)?)", t)
        return float(m2.group(1)) if m2 else None
    base = float(m.group(1))
    return base * 10 ** int(m.group(2)) if m.group(2) else base


def sig_round(x, sf):
    if x == 0:
        return 0.0
    return round(x, sf - 1 - math.floor(math.log10(abs(x))))


def main():
    files = sorted(glob.glob(os.path.join(ROOT, "quizzes", "lecture*.js")), key=lambda p: int(re.findall(r"\d+", os.path.basename(p))[0]))
    total = 0
    counts = {}
    for path in files:
        raw = open(path, encoding="utf-8").read()
        m = re.search(r"window\.PHYS143_QUIZ\[(\d+)\]\s*=\s*(\{.*\});\s*$", raw, re.S)
        if not m:
            err(f"{path}: cannot parse")
            continue
        n = int(m.group(1))
        data = json.loads(m.group(2))
        qs = data["questions"]
        counts[n] = len(qs)
        total += len(qs)
        if data["lecture"] != n:
            err(f"L{n}: lecture field mismatch")
        if len(qs) != EXPECTED:
            err(f"L{n}: {len(qs)} questions, expected {EXPECTED}")
        ids = set()
        types = {}
        for q in qs:
            qid = q.get("id", "?")
            if qid in ids:
                err(f"{qid}: duplicate id")
            ids.add(qid)
            if not qid.startswith(f"L{n}-"):
                err(f"{qid}: id prefix")
            opts = q.get("options", [])
            if len(opts) != 4:
                err(f"{qid}: {len(opts)} options")
            if len(set(o.strip().lower() for o in opts)) != len(opts):
                err(f"{qid}: duplicate options")
            if not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < len(opts)):
                err(f"{qid}: bad answer index")
            if q.get("type") not in TYPES:
                err(f"{qid}: bad type")
            types[q.get("type")] = types.get(q.get("type"), 0) + 1
            for k in ("q", "exp", "ref"):
                if not q.get(k, "").strip():
                    err(f"{qid}: missing {k}")
            blob = " ".join([q.get("q", ""), q.get("exp", ""), q.get("ref", "")] + opts)
            if "&" in blob:
                err(f"{qid}: contains an ampersand")
            if re.search(r"\b(option|choice) [A-D]\b", q.get("exp", ""), re.I):
                err(f"{qid}: explanation refers to a letter, but options are shuffled")
            if "{a}" in blob:
                err(f"{qid}: unreplaced placeholder")
            c = q.get("calc")
            if c:
                got = parse_number(opts[q["answer"]])
                want = sig_round(c["value"], c["sf"])
                if got is None or not math.isclose(got, want, rel_tol=1e-9, abs_tol=1e-12):
                    err(f"{qid}: correct option {opts[q['answer']]!r} does not match computed {want}")
                for i, o in enumerate(opts):
                    if i != q["answer"]:
                        v = parse_number(o)
                        if v is not None and math.isclose(v, got, rel_tol=1e-9):
                            err(f"{qid}: distractor {o!r} equals the correct value")
        print(f"Lecture {n}: {len(qs)} questions, types {types}")
    print(f"Total: {total} questions in {len(files)} files")
    if errors:
        print("\nFAILED:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("All checks passed.")


main()
