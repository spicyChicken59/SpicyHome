"""Run the inherited tour and quote browser sections without unrelated map checks.

Assertions and fixtures are copied verbatim. Only ROOT points at the input
script's repository so the extracted script can live in an output directory.
"""
from pathlib import Path
import json
import sys

source, destination = map(Path, sys.argv[1:])
text = source.read_text()
prefix = text[:text.index('  // --- 1. a press')]
old_root = "const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');"
assert prefix.count(old_root) == 1
prefix = prefix.replace(old_root, 'const ROOT = ' + json.dumps(str(source.resolve().parents[1])) + ';')
section = text[text.index('  // --- 9. the tour-day walkthrough'):text.rindex('} finally {')]
body = prefix + '  const DESK_HOMES = JSON.parse(FEED).homes;\n' + section + text[text.rindex('} finally {'):]
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(body)
