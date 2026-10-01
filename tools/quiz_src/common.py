"""Helpers for authoring PHYS 143 practice questions.

Calculation answers are computed here from the problem data, so the stated
correct option always equals the computed value. Run build.py to write
quizzes/lectureN.js, then validate_quizzes.py to check the output.
"""
import math

SUP = str.maketrans("0123456789-+", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺")
_pos_cycle = [2, 0, 3, 1, 1, 3, 0, 2]


def fmt(v, sf=3):
    """Format a number to sf significant figures, with a true minus sign."""
    if v == 0:
        return "0"
    if abs(v) >= 1e5 or abs(v) < 1e-3:
        mant, exp = f"{v:.{sf - 1}e}".split("e")
        s = f"{mant}\u00d710<sup>{int(exp)}</sup>"
        return s.replace("-", "\u2212")
    e = math.floor(math.log10(abs(v)))
    r = round(v, sf - 1 - e)
    e2 = math.floor(math.log10(abs(r)))  # rounding may carry (9.996 -> 10.0)
    dec = max(sf - 1 - e2, 0)
    return f"{r:.{dec}f}".replace("-", "\u2212")


def val(v, unit="", sf=3):
    u = unit
    if u in ("°", "%"):
        return fmt(v, sf) + u
    return fmt(v, sf) + (" " + u if u else "")


class Lecture:
    def __init__(self, number, title):
        self.number = number
        self.title = title
        self.qs = []
        self._i = 0

    def _add(self, typ, q, options_correct_first, exp, ref, calc=None):
        assert len(options_correct_first) == 4, q
        assert len(set(options_correct_first)) == 4, ("duplicate options", q)
        pos = _pos_cycle[len(self.qs) % len(_pos_cycle)]
        others = options_correct_first[1:]
        opts = others[:pos] + [options_correct_first[0]] + others[pos:]
        d = {
            "id": f"L{self.number}-{len(self.qs) + 1:02d}",
            "type": typ,
            "q": q,
            "options": opts,
            "answer": pos,
            "exp": exp,
            "ref": ref,
        }
        if calc:
            d["calc"] = calc
        self.qs.append(d)

    def C(self, q, correct, wrongs, exp, ref, typ="concept"):
        """Non-numerical question. typ: concept, graph or misconception."""
        self._add(typ, q, [correct] + list(wrongs), exp, ref)

    def N(self, q, value, unit, wrongs, exp, ref, sf=3, typ="calc"):
        """Numerical question. wrongs are numbers (same unit). exp may contain {a} for the answer."""
        correct = val(value, unit, sf)
        ws = [val(w, unit, sf) for w in wrongs]
        assert correct not in ws, ("wrong equals correct", q, correct, ws)
        assert len(ws) == 3
        exp = exp.replace("{a}", correct)
        self._add(typ, q, [correct] + ws, exp, ref, calc={"value": value, "unit": unit, "sf": sf})
