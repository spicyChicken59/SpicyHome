"""SpicyHome: one bounded provider request, observed history, atomic publication.
No scraping, scoring service, email, or secrets in browser outputs.
"""
from __future__ import annotations
import argparse, copy, datetime as dt, hashlib, json, math, os, pathlib, re, sys, urllib.error, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
UTC=dt.timezone.utc
ENDPOINT='https://api.rentcast.io/v1/listings/rental/long-term'

def now_utc(): return dt.datetime.now(UTC)
def stamp(d): return d.astimezone(UTC).isoformat().replace('+00:00','Z')
def read_json(path): return json.loads(path.read_text())
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
    os.replace(tmp,path)
def finite(value): return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)
def positive(value): return finite(value) and value>0
def bounded_text(value,limit): return isinstance(value,str) and bool(value.strip()) and len(value.encode('utf-16-le'))//2<=limit

def reserve(usage,config,reservation_id,now):
    """Each attempt stays counted even if cancelled or the provider times out."""
    if usage.get('schema_version')!=1 or not isinstance(usage.get('attempts'),list): raise ValueError('Invalid usage ledger; refusing a provider request')
    if not reservation_id or len(reservation_id)>160: raise ValueError('Invalid reservation ID')
    attempts=usage['attempts']
    if any(x.get('id')==reservation_id for x in attempts): raise ValueError('Reservation ID already exists; refusing reuse')
    floor=now-dt.timedelta(days=32)
    recent=[]
    for entry in attempts:
        when=dt.datetime.fromisoformat(entry['at'].replace('Z','+00:00'))
        if when.tzinfo is None or when>now+dt.timedelta(minutes=5): raise ValueError('Invalid usage timestamp')
        if when>=floor: recent.append(entry)
    cap=config['max_attempts_32_days']
    if not isinstance(cap,int) or not 1<=cap<=30: raise ValueError('Request cap must stay within 1–30 attempts per rolling 32 days')
    if len(recent)>=cap: raise ValueError('Rolling request budget reached; existing snapshot preserved')
    if sum(x['at'][:10]==stamp(now)[:10] for x in recent)>=config['max_attempts_utc_day']: raise ValueError('Today already has a request reservation; existing snapshot preserved')
    cities=config.get('cities',[config['city']])
    city=usage.get('next_city') if usage.get('next_city') in cities else cities[0]
    entry={'id':reservation_id,'at':stamp(now),'status':'reserved','city':city}
    return {'schema_version':1,'attempts':recent+[entry],'next_city':cities[(cities.index(city)+1)%len(cities)]}

def build_query(config):
    if config['city'] not in config.get('cities',[config['city']]): raise ValueError('Requested city is outside the configured rotation')
    if config['bedrooms']!=[1,2] or config['bathrooms']!=[1,1.5,2]: raise ValueError('This tracker requires 1–2 bedrooms and 1–2 bathrooms')
    if not (positive(config['rent_min']) and config['rent_max']>=config['rent_min']): raise ValueError('Invalid rent range')
    if config.get('limit')!=500: raise ValueError('One page of 500 is the supported request budget')
    return {'city':config['city'],'state':config['state'],'bedrooms':'1|2','bathrooms':'1|1.5|2','price':f"{config['rent_min']}:{config['rent_max']}",'status':'Active','limit':500,'offset':0,'includeTotalCount':'true'}

def get_listings(key,query,opener=urllib.request.urlopen):
    """Exactly one call. No retry: a lost response can still consume quota."""
    if not key: raise ValueError('RENTCAST_API_KEY is missing')
    request=urllib.request.Request(ENDPOINT+'?'+urllib.parse.urlencode(query),headers={'X-Api-Key':key,'Accept':'application/json','User-Agent':'SpicyHome/1.0'})
    with opener(request,timeout=30) as response:
        raw=response.read(12_000_001)
        if len(raw)>12_000_000: raise ValueError('Provider response exceeds 12 MB')
        rows=json.loads(raw)
        total=response.headers.get('X-Total-Count')
        if total is not None:
            try: total=int(total)
            except (TypeError,ValueError): raise ValueError('Invalid provider total count')
            if total<0: raise ValueError('Invalid provider total count')
        return rows,total

def in_bounds(lat,lng,b): return finite(lat) and finite(lng) and b['south']<=lat<=b['north'] and b['west']<=lng<=b['east']
def distance_miles(lat,lng,center):
    if not finite(lat) or not finite(lng):return None
    lat1,lat2=map(math.radians,[center['lat'],lat]);dlat=lat2-lat1;dlng=math.radians(lng-center['lng'])
    a=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
    return 3958.8*2*math.asin(min(1,math.sqrt(a)))

def in_search_area(lat,lng,config):
    if not in_bounds(lat,lng,config['bounds']):return False
    if 'radius_miles' not in config:return True
    return distance_miles(lat,lng,config['center'])<=config['radius_miles']

def layout_count(value, bedroom=False):
    return value if finite(value) and 0<=value<=20 and (value%1==0 if bedroom else value*2%1==0) else None

def reported_layout(row):
    beds=layout_count(row.get('bedrooms'),True);baths=layout_count(row.get('bathrooms'))
    # Only an explicit structured unit-layout field can contradict bed counts.
    # General descriptions may mention a yoga studio or multiple building plans.
    declarations={str(row.get(key) or '').strip().lower() for key in ('unitLayout','floorPlanType')}
    compact=bool(declarations & {'studio','convertible','efficiency','studio apartment'})
    one_bed=bool(declarations & {'one bedroom','one-bedroom','1 bedroom','1-bedroom','1 bed','1br'})
    two_bed=bool(declarations & {'two bedrooms','two bedroom','two-bedroom','2 bedrooms','2 bedroom','2-bedroom','2 bed','2br'})
    contradiction=sum((compact,one_bed,two_bed))>1 or one_bed and beds not in (None,1) or two_bed and beds not in (None,2)
    declaration='conflict' if contradiction else 'studio' if compact else 'one_bed' if one_bed else 'two_bed' if two_bed else None
    status='conflict' if contradiction else ('studio' if beds in (None,0) else 'conflict') if compact else 'studio' if beds==0 else 'unverified' if beds is None or baths is None else 'provider_reported' if beds in (1,2) and baths in (1,1.5,2) else 'other'
    fields='; '.join(f'{key}: {str(row[key])[:200]}' for key in ('unitLayout','floorPlanType') if row.get(key))
    return {'bedrooms':beds,'bathrooms':baths,'layout_status':status,'layout_declaration':declaration,'layout_note':f'Provider bedroom/bathroom fields: {beds!s}/{baths!s}.'+(f' Structured unit information: {fields}.' if fields else ' Separate bedroom not independently checked.')}

def explicit_layout_resolution(layout):
    return layout.get('layout_status')=='provider_reported' and ((layout.get('layout_declaration')=='one_bed' and layout.get('bedrooms')==1) or (layout.get('layout_declaration')=='two_bed' and layout.get('bedrooms')==2)) and layout.get('bathrooms') in (1,1.5,2)

def preserve_layout_evidence(previous,incoming):
    result=copy.deepcopy(incoming)
    explicit_studio=previous.get('layout_declaration') in ('studio','conflict')
    explicit_resolution=explicit_layout_resolution(incoming)
    if explicit_studio and not explicit_resolution and incoming.get('layout_declaration') not in ('studio','conflict'):
        result['layout_declaration']=previous['layout_declaration']
        result['layout_status']='studio' if incoming.get('bedrooms')==0 else 'conflict'
        result['layout_note']='Earlier structured unit information identified a studio/convertible or conflicting layout; numeric counts alone do not resolve it. '+incoming.get('layout_note','')
        if previous.get('layout_observed_at'):result['layout_observed_at']=previous['layout_observed_at']
    elif incoming.get('layout_status')=='unverified' and previous.get('layout_status') in ('studio','conflict','other'):
        for key in ('bedrooms','bathrooms','layout_status','layout_declaration','layout_note','layout_observed_at'):
            if key in previous:result[key]=previous[key]
    return result

def normalize(rows,config,at):
    if not isinstance(rows,list) or len(rows)>500: raise ValueError('Provider did not return one valid listing page')
    homes=[];seen=set();reported_by_id={};excluded={'outside_search_window':0,'missing_coordinates':0,'outside_layout_or_price':0,'inactive':0,'duplicate':0,'layout_corrections':{}}
    for row in rows:
        if not isinstance(row,dict) or not bounded_text(row.get('id'),171) or not bounded_text(row.get('formattedAddress'),2000): raise ValueError('Provider listing has no valid bounded stable ID or address')
        price=row.get('price')
        if not positive(price): raise ValueError('Provider listing contains an invalid rent; retaining the last complete snapshot')
        if str(row.get('city','')).casefold()!=config['city'].casefold() or row.get('state')!=config['state']: raise ValueError('Provider returned an unexpected city/state')
        layout=reported_layout(row)
        ident='rentcast:'+row['id']
        if layout['layout_status']=='provider_reported':
            prior_layout=reported_by_id.setdefault(ident,layout)
            if (layout['bedrooms'],layout['bathrooms'])!=(prior_layout['bedrooms'],prior_layout['bathrooms']):
                layout={**layout,'layout_status':'conflict','layout_declaration':'conflict','layout_note':'Duplicate provider rows disagree on bedroom/bathroom counts for this same listing ID. Confirm the exact unit layout.'}
        if layout['layout_status']!='provider_reported':
            ident='rentcast:'+row['id'];previous=excluded['layout_corrections'].get(ident)
            rank={'unverified':0,'other':1,'conflict':2,'studio':3}
            strength=lambda item:(item.get('layout_declaration') in ('studio','conflict'),rank[item['layout_status']])
            if not previous or strength(layout)>strength(previous):excluded['layout_corrections'][ident]=layout
        if row.get('status')!='Active': excluded['inactive']+=1;continue
        if layout['layout_status']!='provider_reported':
            excluded['outside_layout_or_price']+=1;continue
        if not config['rent_min']<=price<=config['rent_max']: excluded['outside_layout_or_price']+=1;continue
        lat,lng=row.get('latitude'),row.get('longitude')
        if not finite(lat) or not finite(lng) or (lat==0 and lng==0): excluded['missing_coordinates']+=1;continue
        if not in_search_area(lat,lng,config): excluded['outside_search_window']+=1;continue
        ident='rentcast:'+row['id']
        if ident in seen: excluded['duplicate']+=1;continue
        seen.add(ident)
        unknown={'status':'unknown','note':'Not reported by the listing provider; confirm with leasing.'}
        homes.append({'id':ident,'kind':'listing','title':row['addressLine1'] if bounded_text(row.get('addressLine1'),2000) else row['formattedAddress'],'address':row['formattedAddress'],'city':config['city'],'neighborhood':config['city']+' · neighborhood unverified' if config['city']=='Chicago' else config['city'],'rent':price,'sqft':row.get('squareFootage') if positive(row.get('squareFootage')) else None,'lat':lat,'lng':lng,'parking':{**unknown,'monthly':None},'charging':dict(unknown),'access':dict(unknown),'fees':{'monthly':None,'one_time':None},'amenities':[],'source_url':None,'sources':[{'url':'https://developers.rentcast.io/reference/property-listings','supports':'RentCast listing ID '+row['id']+'; no direct listing URL supplied by the API.'}],'observed_at':at,'provider_last_seen':row.get('lastSeenDate'),'listed_date':row.get('listedDate'),'seen_in_latest':True,'history':[{'date':at,'rent':price}]})
        homes[-1].update(layout)
        homes[-1]['unit_label']=row['addressLine2'] if bounded_text(row.get('addressLine2'),2000) else None
        homes[-1]['property_type']=row['propertyType'] if bounded_text(row.get('propertyType'),2000) else None
    # A conflicting duplicate must not leave an accepted copy in results.
    homes=[h for h in homes if h['id'] not in excluded['layout_corrections']]
    return homes,excluded

def combine(previous,seed,homes,excluded,total,returned,at,query,evidence=None):
    scanned_city=query.get('city','Chicago')
    if evidence is None:evidence={}
    def remember(ident,layout):
        if layout.get('layout_declaration') in ('studio','conflict'):
            evidence[ident]={key:layout[key] for key in ('bedrooms','bathrooms','layout_status','layout_declaration','layout_note','layout_observed_at') if key in layout}
        elif explicit_layout_resolution(layout):
            evidence.pop(ident,None)
    for home in previous.get('homes',[]):
        # A retained snapshot may predate evidence persisted during a failed
        # publication. Only a fresh explicit response may resolve that evidence.
        if home['kind']=='listing' and home['id'] not in evidence:remember(home['id'],home)
    old={h['id']:h for h in previous.get('homes',[]) if h['kind']=='listing'}
    for ident,layout in excluded.get('layout_corrections',{}).items():
        if ident in evidence:layout=preserve_layout_evidence(evidence[ident],layout)
        remember(ident,layout)
        if ident in old:
            prior=old[ident]
            if not prior.get('layout_status'):prior={**prior,**reported_layout(prior)}
            corrected=preserve_layout_evidence(prior,{**layout,'layout_observed_at':at})
            old[ident]=copy.deepcopy(prior);old[ident].update(corrected)
    events=list(previous.get('events',[]));current=[]
    for h in homes:
        prior=old.pop(h['id'],None)
        if h['id'] in evidence:h=preserve_layout_evidence(evidence[h['id']],h)
        if prior:
            h=preserve_layout_evidence(prior,h)
            history=list(prior.get('history',[]))
            # Same UTC day's price is the latest observed quote, never a fake extra day.
            history=[p for p in history if p['date'][:10]!=at[:10]]
            h['history']=(history+[{'date':at,'rent':h['rent']}])[-60:]
            if prior['rent']!=h['rent']:
                events.insert(0,{'at':at,'id':h['id'],'title':h['title'],'description':f"Observed rent changed from ${prior['rent']:,.0f} to ${h['rent']:,.0f}."})
        else:
            events.insert(0,{'at':at,'id':h['id'],'title':h['title'],'description':'First observed in the listing feed.'})
        remember(h['id'],h)
        current.append(h)
    # Retain IDs and observed prices so saved decisions survive a capped query's omissions.
    for h in old.values():
        h=copy.deepcopy(h)
        if h.get('city','Chicago')==scanned_city:
            if h.get('seen_in_latest',True): events.insert(0,{'at':at,'id':h['id'],'title':h['title'],'description':'Not in this area’s latest capped snapshot; availability is unverified.'})
            h['seen_in_latest']=False
        current.append(h)
    truncated=total is not None and total>returned
    accepted=sum(h.get('layout_status')=='provider_reported' for h in current if h.get('city','Chicago')==scanned_city and h.get('seen_in_latest'))
    coverage=(f"Latest area: {scanned_city}. One page returned {returned} of {total} matches" if total is not None else f"Latest area: {scanned_city}. One page returned {returned} matches; total count unavailable")+f"; {accepted} fit the layout, budget and 35-mile search. Other cities retain their own last observations."
    if truncated or total is None and returned==500: coverage+=' Coverage is incomplete.'
    if excluded.get('missing_coordinates',0): coverage+=f" {excluded['missing_coordinates']} could not be located."
    scans=copy.deepcopy(previous.get('provider',{}).get('area_scans',{}))
    if not scans and previous.get('provider',{}).get('last_success'):
        prior=previous['provider'];prior_city=prior.get('query',{}).get('city','Chicago')
        scans[prior_city]={'last_success':prior['last_success'],'returned':prior.get('returned'),'total':prior.get('total'),'truncated':prior.get('truncated',False)}
    prior_query=previous.get('provider',{}).get('query',{})
    prior_city=prior_query.get('city')
    if prior_city in scans and 'query' not in scans[prior_city]:scans[prior_city]['query']=copy.deepcopy(prior_query)
    scans[scanned_city]={'last_success':at,'returned':returned,'total':total,'truncated':truncated,'accepted':accepted,'query':copy.deepcopy(query)}
    result=copy.deepcopy(seed)
    result.update({'generated_at':at,'mode':'connected','provider':{'name':'RentCast','configured':True,'last_success':at,'status':'success','coverage':coverage,'returned':returned,'total':total,'truncated':truncated,'query':query,'exclusions':excluded,'area_scans':scans},'homes':copy.deepcopy(seed['homes'])+current,'events':events[:1000]})
    # Keep the dashboard bounded without letting a dense city evict every suburb.
    buckets={}
    for h in sorted(current,key=lambda h:(bool(h.get('seen_in_latest')),h['observed_at']),reverse=True):
        buckets.setdefault(h.get('city','Chicago'),[]).append(h)
    balanced=[]
    for index in range(max((len(group) for group in buckets.values()),default=0)):
        for group in buckets.values():
            if index<len(group):balanced.append(group[index])
    result['homes']=copy.deepcopy(seed['homes'])+balanced[:max(0,1000-len(seed['homes']))]
    result['provider']['archived_from_current_view']=len(current)+len(seed['homes'])-len(result['homes'])
    for key in ['charging_stations','transit_stops','city_context']:
        if key in previous: result[key]=previous[key]
    while len(json.dumps(result,indent=2,allow_nan=False).encode())>7_000_000:
        oldest=next((i for i in range(len(result['homes'])-1,-1,-1) if result['homes'][i]['kind']=='listing'),None)
        if oldest is None: raise ValueError('Current snapshot exceeds the safe browser size; previous snapshot preserved')
        result['homes'].pop(oldest);result['provider']['archived_from_current_view']+=1
    return result

def reserve_command(args):
    cfg=read_json(ROOT/'data/search.json');usage=read_json(ROOT/'data/usage.json')
    if not os.environ.get('RENTCAST_API_KEY'): raise ValueError('RENTCAST_API_KEY is missing; no request reserved')
    write_json(ROOT/'data/usage.json',reserve(usage,cfg,args.reservation,now_utc()))
    print('Reserved one request. Persist this reservation before calling the provider.')

def run_command(args):
    cfg=read_json(ROOT/'data/search.json');at=stamp(now_utc());usage=read_json(ROOT/'data/usage.json')
    entry=next((x for x in usage['attempts'] if x['id']==args.reservation),None)
    if not entry or entry['status']!='reserved': raise ValueError('No unused request reservation; refusing provider call')
    cfg={**cfg,'city':entry.get('city',cfg['city'])};query=build_query(cfg)
    evidence=read_json(ROOT/'data/layout-evidence.json')
    if evidence.get('schema_version')!=1 or not isinstance(evidence.get('records'),dict):raise ValueError('Invalid layout evidence ledger; refusing a provider request')
    reserved=dt.datetime.fromisoformat(entry['at'].replace('Z','+00:00'))
    if now_utc()-reserved>dt.timedelta(hours=1): raise ValueError('Reservation expired; refusing provider call')
    # Local consumption stops accidental repeated invocation in the same checkout.
    entry['status']='consumed';write_json(ROOT/'data/usage.json',usage)
    rows,total=get_listings(os.environ.get('RENTCAST_API_KEY'),query)
    if total is not None and total<len(rows): raise ValueError('Provider count contradicts returned page')
    homes,excluded=normalize(rows,cfg,at)
    if rows and not homes and excluded['missing_coordinates']==len(rows): raise ValueError('Every listing lacks usable coordinates; retaining the last snapshot')
    previous=read_json(ROOT/'dist/data.json');seed=read_json(ROOT/'data/seed.json')
    result=combine(previous,seed,homes,excluded,total,len(rows),at,query,evidence['records'])
    write_json(ROOT/'data/layout-evidence.json',evidence)
    write_json(ROOT/'dist/data.json',result)
    write_json(ROOT/'dist/status.json',{'schema_version':1,'attempted_at':at,'status':'success','message':result['provider']['coverage']})
    write_json(ROOT/'data/history'/f"{at[:10]}.json",result)
    print(result['provider']['coverage'])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['reserve','run']);parser.add_argument('--reservation',required=True);args=parser.parse_args()
    try:
        (reserve_command if args.command=='reserve' else run_command)(args)
    except Exception as exc:
        # Never echo credential-bearing request details or provider response bodies.
        message=str(exc) if isinstance(exc,ValueError) else f'{type(exc).__name__}: source request did not complete'
        write_json(ROOT/'dist/status.json',{'schema_version':1,'attempted_at':stamp(now_utc()),'status':'failed','message':message})
        print(message,file=sys.stderr);return 1
    return 0
if __name__=='__main__': raise SystemExit(main())
