"""Dated source annotations. Offline identity matching; never an eligibility decision."""
import copy
import datetime as dt
import json
import pathlib
import re
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]


def text_ok(value, limit):
    return isinstance(value, str) and bool(value.strip()) and len(value.encode('utf-16-le')) // 2 <= limit


def valid_evidence(value):
    if not isinstance(value, dict) or set(value) != {'condition', 'scope', 'note', 'source'}:
        return False
    if value['condition'] != 'income_restricted' or value['scope'] not in ('address', 'offer') or not text_ok(value['note'], 600):
        return False
    source = value['source']
    if not isinstance(source, dict) or set(source) != {'name', 'url', 'observed_at', 'supports'}:
        return False
    if not text_ok(source['name'], 160) or not text_ok(source['supports'], 1200) or not text_ok(source['url'], 2000):
        return False
    try:
        url = urlsplit(source['url'])
        if url.scheme not in ('https', 'http') or not url.hostname or url.username or url.password or re.search(r'[\s\\]', source['url']):
            return False
        day = source['observed_at']
        return isinstance(day, str) and bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}', day)) and dt.date.fromisoformat(day).isoformat() == day
    except (ValueError, TypeError):
        return False


def load_evidence(path=None):
    ledger = json.loads((path or ROOT / 'data/eligibility-evidence.json').read_text(encoding='utf-8'))
    if not isinstance(ledger, dict) or ledger.get('schema_version') != 1 or not isinstance(ledger.get('records'), dict):
        raise ValueError('Invalid eligibility evidence ledger')
    for ident, entry in ledger['records'].items():
        if not text_ok(ident, 180) or ident in ('__proto__', 'constructor', 'prototype') or not isinstance(entry, dict):
            raise ValueError('Invalid eligibility evidence identity')
        identity = entry.get('identity')
        if not isinstance(identity, dict) or set(identity) != {'address', 'city', 'bedrooms', 'bathrooms'} or not text_ok(identity['address'], 2000) or not text_ok(identity['city'], 500):
            raise ValueError('Invalid eligibility evidence identity')
        if any(isinstance(identity[k], bool) or not isinstance(identity[k], (int, float)) or not 0 <= identity[k] <= 20 for k in ('bedrooms', 'bathrooms')):
            raise ValueError('Invalid eligibility evidence layout')
        if not valid_evidence(entry.get('evidence')):
            raise ValueError('Invalid eligibility source annotation')
    return ledger['records']


def identity_matches(home, identity):
    return all(
        isinstance(home.get(k), str) and isinstance(identity[k], str) and home[k].strip().casefold() == identity[k].strip().casefold()
        if k in ('address', 'city') else home.get(k) == identity[k]
        for k in identity
    )


def retain_evidence(previous, incoming):
    """A provider refresh has no authority to silently erase retained source evidence."""
    result = copy.deepcopy(incoming)
    if 'eligibility_evidence' in previous:
        identity = {k: previous.get(k) for k in ('address', 'city')}
        if previous['id'] != incoming['id'] or not identity_matches(incoming, identity):
            raise ValueError('Eligibility evidence identity conflict; previous snapshot retained')
        if not valid_evidence(previous['eligibility_evidence']):
            raise ValueError('Invalid retained eligibility evidence')
        result['eligibility_evidence'] = copy.deepcopy(previous['eligibility_evidence'])
    return result


def annotate_home(home, records):
    result = copy.deepcopy(home)
    if 'eligibility_evidence' in result and not valid_evidence(result['eligibility_evidence']):
        raise ValueError('Invalid eligibility source annotation')
    entry = records.get(home['id'])
    if entry:
        if not identity_matches(home, entry['identity']):
            raise ValueError('Eligibility evidence identity conflict; previous snapshot retained')
        if not valid_evidence(entry['evidence']):
            raise ValueError('Invalid eligibility source annotation')
        result['eligibility_evidence'] = copy.deepcopy(entry['evidence'])
    return result


def annotate_feed(feed, records):
    """Annotation only: no observation clocks, history, rent, order or events change."""
    result = copy.deepcopy(feed)
    result['homes'] = [annotate_home(home, records) for home in feed['homes']]
    return result
