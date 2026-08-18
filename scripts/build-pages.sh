#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/_site"
BASE="${PAGES_BASE:-/${GITHUB_REPOSITORY##*/}}"
BASE="/${BASE#/}"
BASE="${BASE%/}"

rm -rf "$SITE"
mkdir -p "$SITE/krpano" "$SITE/assets" "$SITE/data" "$SITE/editor" "$SITE/preview" "$SITE/js"

cp -a "$ROOT/public/." "$SITE/"
cp -a "$ROOT/krpano/." "$SITE/krpano/"
cp -a "$ROOT/assets/." "$SITE/assets/"
cp "$ROOT/data/tour.json" "$SITE/data/tour.json"
cp "$ROOT/public/preview.html" "$SITE/index.html"
cp "$ROOT/public/editor.html" "$SITE/editor/index.html"
cp "$ROOT/public/preview.html" "$SITE/preview/index.html"
touch "$SITE/.nojekyll"

cat > "$SITE/js/config.js" <<EOF
window.APP_BASE = "${BASE}";
window.withBase = function (path) {
  var base = window.APP_BASE || "";
  var p = String(path || "");
  if (!p) return base || "/";
  if (p.charAt(0) !== "/") p = "/" + p;
  return base + p;
};
EOF

python3 - "$SITE" "$BASE" <<'PY'
import os
import sys

site, base = sys.argv[1], sys.argv[2]
old_base = '<base href="/" />'
new_base = '<base href="' + base + '/" />'

for root, _, files in os.walk(site):
    for name in files:
        if not name.endswith(".html"):
            continue
        path = os.path.join(root, name)
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        if old_base not in text:
            print("warn: missing base tag in", path, file=sys.stderr)
            continue
        with open(path, "w", encoding="utf-8") as f:
            f.write(text.replace(old_base, new_base, 1))
PY

echo "Prepared GitHub Pages site with base ${BASE}/"
