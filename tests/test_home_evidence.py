import copy
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
import home_evidence as e
import tracker as t
LEDGER=e.load_home_research()
FEED=json.loads((ROOT/'dist/data.json').read_text())
SEED=json.loads((ROOT/'data/seed.json').read_text())
HOME=next(h for h in FEED['homes'] if h['id']=='coast')

class HomeEvidenceTests(unittest.TestCase):
    def test_annotation_only_and_idempotent_with_identity_guards(self):
        old=copy.deepcopy(HOME);old.pop('home_evidence')
        before=copy.deepcopy(old);after=e.annotate_home_research(old,LEDGER)
        self.assertEqual(old,before)
        self.assertEqual(after,e.annotate_home_research(after,LEDGER))
        self.assertEqual(after.pop('home_evidence'),LEDGER['coast']['evidence'])
        self.assertEqual(after,before)
        for key,value in [('address','Another address'),('city','Evanston'),('floor_plan','1x1J')]:
            with self.assertRaisesRegex(ValueError,'identity conflict'):e.annotate_home_research({**HOME,key:value},LEDGER)
        other={**before,'id':'another-coast'}
        self.assertEqual(e.annotate_home_research(other,LEDGER),other)

    def test_refresh_seed_and_ledger_omission_retain_separate_source_dates(self):
        legacy=copy.deepcopy(SEED)
        for h in legacy['homes']:h.pop('home_evidence',None)
        at='2026-09-26T12:00:00Z'
        after=t.combine(FEED,legacy,[],{},0,0,at,{'city':'Chicago'},research={})
        kept=next(h for h in after['homes'] if h['id']=='coast')
        self.assertEqual(kept,HOME)
        self.assertEqual(kept['observed_at'],'2026-09-07')
        self.assertEqual(kept['home_evidence'][0]['source']['observed_at'],'2026-09-22')
        self.assertFalse(any(x['id']=='coast' and 'rent changed' in x['description'] for x in after['events']))

    def test_provider_omission_refresh_and_reappearance_keep_research_and_real_history(self):
        # A synthetic provider identity tests the future enrichment path without a request.
        home=copy.deepcopy(HOME);home.update(id='rentcast:synthetic',kind='listing',rent=2400,history=[{'date':'2026-09-07','rent':2400}],seen_in_latest=True)
        seed={**SEED,'homes':[]};previous={**FEED,'homes':[home],'events':[]}
        omitted=t.combine(previous,seed,[],{},0,0,'2026-09-25T12:00:00Z',{'city':'Chicago'},research={})
        kept=omitted['homes'][0];self.assertFalse(kept['seen_in_latest']);self.assertEqual(kept['home_evidence'],home['home_evidence']);self.assertEqual(kept['history'],home['history'])
        incoming=copy.deepcopy(home);incoming.pop('home_evidence');incoming.update(rent=2450,observed_at='2026-09-26T12:00:00Z')
        returned=t.combine(omitted,seed,[incoming],{},1,1,'2026-09-26T12:00:00Z',{'city':'Chicago'},research={})
        self.assertEqual(len(returned['homes']),1);self.assertEqual(returned['homes'][0]['home_evidence'],home['home_evidence']);self.assertEqual(returned['homes'][0]['rent'],2450)
        self.assertEqual(len([x for x in returned['events'] if 'Observed rent changed' in x['description']]),1)
        self.assertEqual(returned['homes'][0]['home_evidence'][0]['source']['observed_at'],'2026-09-22')

    def test_new_observations_append_without_overwriting_old(self):
        extra=copy.deepcopy(HOME['home_evidence'][0]);extra['source']['observed_at']='2026-09-23';extra['note']='Synthetic later clarification.'
        before=copy.deepcopy(HOME)
        after=e.retain_home_research(HOME,{**HOME,'home_evidence':[extra]})
        self.assertEqual(HOME,before);self.assertEqual(after['home_evidence'][:-1],HOME['home_evidence']);self.assertEqual(after['home_evidence'][-1],extra)
        self.assertEqual(e.retain_home_research(after,after),after)

    def test_malformed_sources_are_rejected_in_ledger_and_retention(self):
        for patch in [{'scope':'city'},{'applies':'most'},{'attribute':'ai_score'},{'status':'confirmed'},{'value':False}]:
            evidence=copy.deepcopy(HOME['home_evidence']);evidence[0].update(patch)
            self.assertFalse(e.valid_home_evidence(evidence))
            with self.assertRaises(ValueError):e.retain_home_research({**HOME,'home_evidence':evidence},HOME)
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'bad.json';bad=copy.deepcopy(LEDGER);bad['coast']['identity']['floor_plan']=False
            path.write_text(json.dumps({'schema_version':1,'records':bad}))
            with self.assertRaises(ValueError):e.load_home_research(path)

    def test_js_python_evidence_validation_agree_on_shared_boundaries(self):
        valid=copy.deepcopy(HOME['home_evidence']);cases=[valid]
        for key,val in [('status','yes'),('scope','apartment'),('applies','sometimes'),('value',False)]:
            bad=copy.deepcopy(valid);bad[0][key]=val;cases.append(bad)
        for value in ['2026-02-30','2026-09-22T00:00:00Z','']:
            bad=copy.deepcopy(valid);bad[0]['source']['observed_at']=value;cases.append(bad)
        js="import {validHomeEvidence} from './dist/model.js';let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(JSON.parse(s).map(validHomeEvidence)));"
        result=subprocess.run(['node','--input-type=module','-e',js],cwd=ROOT,input=json.dumps(cases),text=True,capture_output=True,check=True)
        self.assertEqual(json.loads(result.stdout),[e.valid_home_evidence(c) for c in cases])

if __name__=='__main__':unittest.main()
