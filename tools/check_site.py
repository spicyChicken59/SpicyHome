"""Validate authored static entrypoints, shared design provenance and public data."""
import hashlib,json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];DIST=ROOT/'dist';errors=[]
html=(DIST/'index.html').read_text()
for ref in re.findall(r'(?:src|href)="([^"#]+)"',html):
 if not ref.startswith(('http:','https:','data:','mailto:')) and not (DIST/ref).is_file() and ref!='./':errors.append('Missing local asset: '+ref)
for path in DIST.rglob('*'):
 if path.is_file() and path.name in ['.env','.git','usage.json','search.json']:errors.append('Private setup/state file in public assets: '+str(path))
manifest=json.loads((DIST/'design-system/provenance.json').read_text())
for name,expected in manifest['files'].items():
 p=DIST/'design-system'/name
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:errors.append('Shared asset differs from immutable provenance: '+name)
feed=json.loads((DIST/'data.json').read_text());ids=[]
for h in feed['homes']:
 ids.append(h['id'])
 if h['bedrooms']!=1 or h['bathrooms']!=1:errors.append('Unexpected layout: '+h['id'])
 if h['kind']=='building' and not h.get('sources'):errors.append('Building without sources: '+h['id'])
if len(ids)!=len(set(ids)):errors.append('Duplicate apartment IDs')
if (DIST/'data.json').stat().st_size>8_000_000:errors.append('Public feed exceeds browser limit')
if errors:print('\n'.join(errors),file=sys.stderr);raise SystemExit(1)
print(f"Static entrypoints, {len(manifest['files'])} immutable design assets and {len(ids)} apartment records verified.")
