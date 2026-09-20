"""Apply retained source annotations to the current feed without a provider run.

Never writes historical feeds, provider dates, status or usage. Repeating is a no-op.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from eligibility import annotate_feed, load_evidence
from tracker import read_json, write_json

if __name__ == '__main__':
    path = ROOT / 'dist/data.json'
    before = read_json(path)
    after = annotate_feed(before, load_evidence())
    if before != after:
        write_json(path, after)
        print('Updated current-feed eligibility annotation only.')
    else:
        print('Current-feed eligibility evidence already matches; no changes.')
