"""Optional regional context; never queries websites using apartment-provider data."""
import csv,io,json,os,pathlib,sys,urllib.request,zipfile
from tracker import ROOT,read_json,write_json,in_bounds,now_utc,stamp
CTA='https://data.cityofchicago.org/resource/8pix-ypme.json?$limit=1000'
AFDC='https://developer.nlr.gov/api/alt-fuel-stations/v1.json?fuel_type=ELEC&state=IL&status=E&access=public&limit=all'

def fetch_bytes(url,key=None,limit=35_000_000):
    headers={'User-Agent':'SpicyHome/1.0'}
    if key: headers['X-Api-Key']=key
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=30) as r:
        b=r.read(limit+1)
        if len(b)>limit: raise ValueError('Regional data exceeds the size limit')
        return b

def cta_stations(payload,bounds):
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        info=z.getinfo('stops.txt')
        if info.file_size>30_000_000: raise ValueError('CTA stop file too large')
        rows=csv.DictReader(io.StringIO(z.read('stops.txt').decode('utf-8-sig')))
        stops=[]
        for row in rows:
            if row.get('location_type')!='1': continue
            lat,lng=float(row['stop_lat']),float(row['stop_lon'])
            if in_bounds(lat,lng,bounds): stops.append({'id':'cta:'+row['stop_id'],'title':row['stop_name'],'lat':lat,'lng':lng,'wheelchair_boarding':row.get('wheelchair_boarding','0')})
        if not stops: raise ValueError('CTA feed has no matching rail stations; preserving previous context')
        return stops

def cta_portal_stations(payload,bounds):
    rows=json.loads(payload)
    if not isinstance(rows,list) or not rows: raise ValueError('Invalid CTA station response')
    groups={};route_keys=['red','blue','g','brn','p','y','pnk','o']
    for row in rows:
        lat,lng=float(row['location']['latitude']),float(row['location']['longitude'])
        if not in_bounds(lat,lng,bounds): continue
        ident='cta:'+str(row['map_id'])
        if ident not in groups: groups[ident]={'id':ident,'title':row['station_name'],'lat':lat,'lng':lng,'routes':[],'ada_advertised':row.get('ada') is True}
        groups[ident]['routes']=sorted(set(groups[ident]['routes'])|{k for k in route_keys if row.get(k) is True})
    if not groups: raise ValueError('No matching CTA stations; preserving previous context')
    return list(groups.values())

def chargers(payload,bounds):
    data=json.loads(payload)
    if not isinstance(data.get('fuel_stations'),list): raise ValueError('Invalid AFDC response')
    result=[]
    for row in data['fuel_stations']:
        lat,lng=row.get('latitude'),row.get('longitude')
        if row.get('fuel_type_code')!='ELEC' or row.get('access_code')!='public' or row.get('status_code')!='E' or not in_bounds(lat,lng,bounds): continue
        result.append({'id':'afdc:'+str(row['id']),'title':row['station_name'],'lat':lat,'lng':lng,'connector_types':row.get('ev_connector_types',[]),'network':row.get('ev_network'),'pricing':row.get('ev_pricing'),'access':row.get('access_days_time'),'source_updated':row.get('updated_at'),'level2_ports':row.get('ev_level2_evse_num'),'dc_ports':row.get('ev_dc_fast_num')})
    return result

def main():
    cfg=read_json(ROOT/'data/search.json');data=read_json(ROOT/'dist/data.json');at=stamp(now_utc());ctx=data.setdefault('city_context',{});errors=[]
    try: data['transit_stops']=cta_portal_stations(fetch_bytes(CTA),cfg['bounds']);ctx['cta']={'updated_at':at,'source':CTA}
    except Exception as e: errors.append('CTA: '+type(e).__name__)
    key=os.environ.get('AFDC_API_KEY')
    if key:
        try: data['charging_stations']=chargers(fetch_bytes(AFDC,key),cfg['bounds']);ctx['afdc_status']='success';ctx['afdc']={'updated_at':at,'source':'https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/'}
        except Exception as e: errors.append('AFDC: '+type(e).__name__)
    else: ctx['afdc_status']='Key not configured; no public charging dataset fetched.'
    ctx['last_attempt_at']=at;ctx['errors']=errors
    write_json(ROOT/'dist/data.json',data)
    print(f"Regional context: {len(data.get('transit_stops',[]))} CTA stations, {len(data.get('charging_stations',[]))} public charging locations.")
    if errors: print('Previous context preserved for failed sources: '+', '.join(errors),file=sys.stderr);return 1
    return 0
if __name__=='__main__':raise SystemExit(main())
