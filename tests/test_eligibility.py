import copy
import datetime as dt
import json
import pathlib
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
import eligibility as e
import tracker as t

RECORDS = e.load_evidence()
ID = 'rentcast:2030-Greenwood-St,-Unit-1BR,-Evanston,-IL-60201'
ANNOTATION = RECORDS[ID]['evidence']
FEED = json.loads((ROOT / 'dist/data.json').read_text())
HOME = next(h for h in FEED['homes'] if h['id'] == ID)
SEED = json.loads((ROOT / 'data/seed.json').read_text())
CFG = {**json.loads((ROOT / 'data/search.json').read_text()), 'city': 'Evanston'}


def provider_row(**changes):
    row = dict(id=ID.removeprefix('rentcast:'), formattedAddress=HOME['address'],
               addressLine1=HOME['title'], addressLine2='Unit 1BR', city='Evanston', state='IL',
               bedrooms=1, bathrooms=1, price=1271, status='Active', latitude=HOME['lat'], longitude=HOME['lng'])
    return {**row, **changes}


class EligibilityTests(unittest.TestCase):
    def test_exact_identity_only_not_a_name_or_cheap_price_rule(self):
        before = copy.deepcopy(HOME)
        before.pop('eligibility_evidence', None)
        self.assertEqual(e.annotate_home(before, RECORDS)['eligibility_evidence'], ANNOTATION)
        self.assertNotIn('eligibility_evidence', before)
        for unrelated in [dict(before, id='cheap', rent=1271), dict(before, id='similar', title='2030 Greenwood St'),
                          dict(before, id=ID + '-2', address=HOME['address'])]:
            self.assertEqual(e.annotate_home(unrelated, RECORDS), unrelated)
        for conflict in [dict(before, address='2030 Greenwood St, Unit 2, Evanston, IL 60201'),
                         dict(before, city='Chicago'), dict(before, bedrooms=2)]:
            with self.assertRaisesRegex(ValueError, 'identity conflict'):
                e.annotate_home(conflict, RECORDS)

    def test_amendment_is_annotation_only_idempotent_and_does_not_mutate_input(self):
        before = copy.deepcopy(FEED)
        for h in before['homes']:
            h.pop('eligibility_evidence', None)
        original = copy.deepcopy(before)
        after = e.annotate_feed(before, RECORDS)
        self.assertEqual(before, original)
        self.assertEqual(after, e.annotate_feed(after, RECORDS))
        self.assertEqual([h['id'] for h in after['homes'] if 'eligibility_evidence' in h], [ID])
        for h in after['homes']:
            h.pop('eligibility_evidence', None)
        self.assertEqual(after, before, 'all rents, price history, events, provider and feed timestamps are identical')

    def test_mocked_refresh_preserves_source_day_while_provider_price_and_date_change(self):
        previous = e.annotate_feed({**FEED, 'homes': [HOME]}, RECORDS)
        at = '2026-09-25T12:00:00Z'
        homes, excluded = t.normalize([provider_row(price=1400)], CFG, at)
        result = t.combine(previous, SEED, homes, excluded, 1, 1, at, {'city': 'Evanston'})
        current = next(h for h in result['homes'] if h['id'] == ID)
        self.assertEqual(current['rent'], 1400)
        self.assertEqual(current['observed_at'], at)
        self.assertEqual(current['eligibility_evidence'], ANNOTATION)
        self.assertEqual(current['eligibility_evidence']['source']['observed_at'], '2026-09-19')
        moves = [x for x in result['events'] if x['id'] == ID and 'Observed rent changed' in x['description']]
        self.assertEqual(len(moves), 1, 'only the provider rent change makes a movement')
        again = t.combine(result, SEED, homes, excluded, 1, 1, at, {'city': 'Evanston'})
        self.assertEqual(next(h for h in again['homes'] if h['id'] == ID)['eligibility_evidence'], ANNOTATION)
        self.assertEqual(again['events'], result['events'])
        self.assertEqual(len([h for h in again['homes'] if h['id'] == ID]), 1)

    def test_omission_and_reappearance_keep_evidence_without_duplicate_records(self):
        previous = e.annotate_feed({**FEED, 'homes': [HOME]}, RECORDS)
        omitted = t.combine(previous, SEED, [], {}, 0, 0, '2026-09-25T12:00:00Z', {'city': 'Evanston'})
        retained = next(h for h in omitted['homes'] if h['id'] == ID)
        self.assertEqual(retained['eligibility_evidence'], ANNOTATION)
        self.assertEqual(retained['history'], HOME['history'])
        self.assertFalse(retained['seen_in_latest'])
        homes, excluded = t.normalize([provider_row()], CFG, '2026-09-26T12:00:00Z')
        returned = t.combine(omitted, SEED, homes, excluded, 1, 1, '2026-09-26T12:00:00Z', {'city': 'Evanston'})
        self.assertEqual(len([h for h in returned['homes'] if h['id'] == ID]), 1)
        self.assertEqual(next(h for h in returned['homes'] if h['id'] == ID)['eligibility_evidence'], ANNOTATION)

    def test_retained_evidence_is_not_erased_if_enrichment_is_omitted(self):
        previous = e.annotate_feed({**FEED, 'homes': [HOME]}, RECORDS)
        homes, excluded = t.normalize([provider_row()], CFG, '2026-09-26T12:00:00Z')
        result = t.combine(previous, SEED, homes, excluded, 1, 1, '2026-09-26T12:00:00Z', {'city': 'Evanston'}, eligibility={})
        self.assertEqual(next(h for h in result['homes'] if h['id'] == ID)['eligibility_evidence'], ANNOTATION)

    def test_mocked_failed_request_cannot_rewrite_feed_or_annotation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            (root / 'data').mkdir(); (root / 'dist').mkdir()
            now = dt.datetime(2026, 9, 25, 12, tzinfo=dt.timezone.utc)
            for path, value in {'data/search.json': CFG, 'data/usage.json': {'attempts': [{'id': 'mock', 'at': t.stamp(now), 'status': 'reserved', 'city': 'Evanston'}]},
                                'data/layout-evidence.json': {'schema_version': 1, 'records': {}},
                                'data/eligibility-evidence.json': {'schema_version': 1, 'records': RECORDS},
                                'dist/data.json': e.annotate_feed(FEED, RECORDS)}.items():
                (root / path).write_text(json.dumps(value))
            before = (root / 'dist/data.json').read_bytes()
            with patch.object(t, 'ROOT', root), patch.object(t, 'now_utc', return_value=now), patch.object(t, 'get_listings', side_effect=OSError('mocked failure')) as provider:
                with self.assertRaises(OSError): t.run_command(SimpleNamespace(reservation='mock'))
                provider.assert_called_once()
            self.assertEqual((root / 'dist/data.json').read_bytes(), before)
            self.assertFalse((root / 'data/history').exists())

    def test_invalid_annotation_and_ledger_are_rejected(self):
        for patcher in [lambda v: v.update(scope='unrestricted'), lambda v: v.update(note='x' * 601),
                        lambda v: v['source'].update(url='javascript:alert(1)'), lambda v: v['source'].update(url='https://user:pass@example.com'),
                        lambda v: v['source'].update(observed_at='2026-02-30'), lambda v: v['source'].pop('name')]:
            bad = copy.deepcopy(ANNOTATION); patcher(bad)
            self.assertFalse(e.valid_evidence(bad))
            with self.assertRaises(ValueError): e.annotate_home(dict(HOME, eligibility_evidence=bad), RECORDS)
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'ledger.json'
            path.write_text(json.dumps({'schema_version': 1, 'records': {ID: {'identity': {}, 'evidence': ANNOTATION}}}))
            with self.assertRaises(ValueError): e.load_evidence(path)


if __name__ == '__main__':
    unittest.main()
