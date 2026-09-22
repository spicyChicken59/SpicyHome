"""Offline, identity-bound home research. Never a provider or quote observation."""
import copy
import datetime as dt
import json
import math
import pathlib
import re
from urllib.parse import urlsplit
from eligibility import identity_matches, text_ok
ROOT = pathlib.Path(__file__).resolve().parents[1]
VALUES = {'balcony': {'private','juliet','shared','none','unspecified'},
          'laundry': {'in_unit_both','washer_only','dryer_only','shared','hookups','none','unspecified'},
          'eligibility': {'income_restricted','unrestricted','mixed_program'}}
ATTRS = set(VALUES) | {'neighborhood','sqft','height','floor','view','availability','price','parking'}

def day_ok(s):
    try: return isinstance(s,str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',s)) and dt.date.fromisoformat(s).isoformat()==s
    except ValueError: return False

def valid_home_evidence(items):
    if not isinstance(items,list) or len(items)>100: return False
    for e in items:
        if not isinstance(e,dict) or set(e)!={'attribute','value','status','scope','subject','applies','note','source'}:return False
        if e['attribute'] not in ATTRS or e['status'] not in ('reported','unknown','conflicting') or e['scope'] not in ('building','plan','unit','address') or e['applies'] not in ('all','selected','exact','general'):return False
        if not text_ok(e['subject'],180) or not text_ok(e['note'],1200):return False
        s=e['source']
        if not isinstance(s,dict) or set(s)!={'name','url','observed_at'} or not text_ok(s['name'],160) or not text_ok(s['url'],2000) or not day_ok(s['observed_at']):return False
        try:
            u=urlsplit(s['url'])
            if u.scheme not in ('http','https') or not u.hostname or u.username or u.password or re.search(r'[\s\\]',s['url']):return False
        except ValueError:return False
        a,v=e['attribute'],e['value']
        if e['status'] in ('unknown','conflicting'):
            if v is not None:return False
        elif a in VALUES:
            if not isinstance(v,str) or v not in VALUES[a]:return False
        elif a=='neighborhood':
            if not isinstance(v,list) or not 0<len(v)<=10 or not all(text_ok(n,100) for n in v):return False
        elif a in ('sqft','floor'):
            if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v):return False
            if a=='sqft' and not 0<v<=100000:return False
            if a=='floor' and (not -10<=v<=200 or v%1):return False
        elif a=='availability':
            if not day_ok(v):return False
        elif not text_ok(v,600):return False
    return True

def merge_observations(old,new):
    result=copy.deepcopy(old)
    for item in new:
        if item not in result:result.append(copy.deepcopy(item))
    if not valid_home_evidence(result):raise ValueError('Invalid home evidence')
    return result

def load_home_research(path=None):
    ledger=json.loads((path or ROOT/'data/home-evidence.json').read_text())
    if ledger.get('schema_version')!=1 or not isinstance(ledger.get('records'),dict):raise ValueError('Invalid home research ledger')
    for ident,entry in ledger['records'].items():
        if not text_ok(ident,180) or ident in ('__proto__','constructor','prototype') or not isinstance(entry,dict) or set(entry)!={'identity','evidence'}:raise ValueError('Invalid research identity')
        identity=entry['identity']
        if not isinstance(identity,dict) or set(identity)!={'address','city','floor_plan'} or not all(text_ok(v,2000) for v in identity.values()):raise ValueError('Invalid research identity')
        if not valid_home_evidence(entry['evidence']):raise ValueError('Invalid home evidence')
    return ledger['records']

def retain_home_research(previous,incoming):
    result=copy.deepcopy(incoming)
    if 'home_evidence' in previous:
        identity={k:previous.get(k) for k in ('address','city','floor_plan') if previous.get(k) is not None}
        if previous['id']!=incoming['id'] or not identity_matches(incoming,identity):raise ValueError('Home research identity conflict; previous snapshot retained')
        result['home_evidence']=merge_observations(previous['home_evidence'],incoming.get('home_evidence',[]))
    return result

def annotate_home_research(home,records):
    result=copy.deepcopy(home)
    if 'home_evidence' in result and not valid_home_evidence(result['home_evidence']):raise ValueError('Invalid retained home evidence')
    entry=records.get(home['id'])
    if entry:
        if not identity_matches(home,entry['identity']):raise ValueError('Home research identity conflict; previous snapshot retained')
        result['home_evidence']=merge_observations(result.get('home_evidence',[]),entry['evidence'])
    return result
