"""Extract the existing tour section verbatim for bounded baseline reproduction."""
from pathlib import Path
import sys

source, destination = map(Path, sys.argv[1:])
text = source.read_text()
start = text.index('  // --- 9. the tour-day walkthrough')
end = text.index('  // --- 11. personal quote dates', start)
body = (text[:text.index('  // --- 1. a press')]
        + '  const DESK_HOMES = JSON.parse(FEED).homes;\n'
        + text[start:end] + text[text.rindex('} finally {'):])
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(body)
