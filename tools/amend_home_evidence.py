"""Apply bounded offline research without touching observation clocks or history."""
import pathlib
import sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from home_evidence import annotate_home_research, load_home_research
from tracker import read_json, write_json
if __name__=='__main__':
    ledger=load_home_research()
    for name in ('data/seed.json','dist/data.json'):
        path=ROOT/name
        before=read_json(path)
        after={**before,'homes':[annotate_home_research(h,ledger) for h in before['homes']]}
        if before!=after:write_json(path,after)
        print(name+': research applied; source clocks and scalar prices preserved')
