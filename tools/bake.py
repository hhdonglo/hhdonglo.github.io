"""Store the rendered content of every data-render container in the page source as the no-JavaScript fallback.
Usage: serve the repo (python3 -m http.server 8765), then: python3 tools/bake.py"""
import glob, json, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = [os.path.basename(f) for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))) if "data-render=" in open(f, encoding="utf-8").read()]
subprocess.run(["node", os.path.join(ROOT, "tools", "bake.js"), "http://localhost:8765"] + files, check=True)
data = json.load(open("/tmp/claude-0/bake.json"))
VOID = {"br", "img", "hr", "input", "meta", "link"}
def close_of(s, start, tag):
    depth, i = 1, start
    pat = re.compile(r"<(/?)" + tag + r"\b[^>]*?(/?)>", re.I)
    for m in pat.finditer(s, start):
        if m.group(1): depth -= 1
        elif not m.group(2): depth += 1
        if depth == 0: return m.start()
    raise ValueError("unbalanced " + tag)
for f in files:
    path = os.path.join(ROOT, f); s = open(path, encoding="utf-8").read(); pos = 0; k = 0; out = []
    for m in re.finditer(r"<(\w+)\b[^>]*\bdata-render=\"([^\"]+)\"[^>]*>", s):
        if m.start() < pos: continue
        end = close_of(s, m.end(), m.group(1))
        key, html = data[f][k]; k += 1
        assert key == m.group(2), (f, key, m.group(2))
        out.append(s[pos:m.end()] + html); pos = end
    out.append(s[pos:])
    open(path, "w", encoding="utf-8").write("".join(out))
print("baked", len(files), "pages")
