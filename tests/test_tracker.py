import copy,datetime as dt,io,json,pathlib,sys,unittest,zipfile
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'src'))
import tracker as t
import city_context as city
ROOT=pathlib.Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/'data/search.json').read_text());SEED=json.loads((ROOT/'data/seed.json').read_text());NOW=dt.datetime(2026,9,7,13,17,tzinfo=dt.timezone.utc)
def row(**kw):
 d=dict(id='a',formattedAddress='200 W Adams St Unit 2, Chicago, IL 60606',addressLine1='200 W Adams St',city='Chicago',state='IL',bedrooms=1,bathrooms=1,price=2400,status='Active',latitude=41.879,longitude=-87.634,squareFootage=720);d.update(kw);return d
class ReservationTests(unittest.TestCase):
 def test_one_daily_attempt_including_failures(self):
  u=t.reserve({'schema_version':1,'attempts':[]},CFG,'a',NOW);u['attempts'][0]['status']='consumed'
  with self.assertRaisesRegex(ValueError,'already'):t.reserve(u,CFG,'b',NOW)
 def test_reused_id_fails(self):
  u=t.reserve({'schema_version':1,'attempts':[]},CFG,'a',NOW)
  with self.assertRaisesRegex(ValueError,'reuse'):t.reserve(u,CFG,'a',NOW+dt.timedelta(days=1))
 def test_rolling_budget_does_not_reset_on_month_boundary(self):
  attempts=[dict(id=str(i),at=t.stamp(NOW-dt.timedelta(days=i+1)),status='reserved') for i in range(30)]
  with self.assertRaisesRegex(ValueError,'budget'):t.reserve(dict(schema_version=1,attempts=attempts),CFG,'new',NOW)
 def test_old_attempts_expire(self):
  old=dict(id='old',at=t.stamp(NOW-dt.timedelta(days=33)),status='consumed');self.assertEqual(len(t.reserve(dict(schema_version=1,attempts=[old]),CFG,'new',NOW)['attempts']),1)
 def test_invalid_or_future_ledger_fails(self):
  for u in [{},dict(schema_version=1,attempts=[dict(at='bad')]),dict(schema_version=1,attempts=[dict(at=t.stamp(NOW+dt.timedelta(days=3)))])]:
   with self.assertRaises((ValueError,KeyError)):t.reserve(u,CFG,'new',NOW)
class FeedTests(unittest.TestCase):
 def test_studio_unknown_and_bool_layouts_are_not_coerced(self):
  for patch in [dict(bedrooms=0),dict(bedrooms=True),dict(bathrooms=True),dict(bedrooms=None),dict(bedrooms=1,unitLayout='Studio')]:
   homes,excluded=t.normalize([row(**patch)],CFG,t.stamp(NOW));self.assertEqual(homes,[]);self.assertIn('rentcast:a',excluded['layout_corrections'])
 def test_amenity_mentions_do_not_classify_a_unit(self):
  homes,_=t.normalize([row(description='Yoga studio and studios, one and two bedrooms available',addressLine2='Unit 2',propertyType='Apartment')],CFG,t.stamp(NOW))
  self.assertEqual(homes[0]['layout_status'],'provider_reported');self.assertEqual(homes[0]['unit_label'],'Unit 2')
 def test_corrected_studio_supersedes_retained_one_bed_history(self):
  at=t.stamp(NOW);homes,excluded=t.normalize([row()],CFG,at);first=t.combine(SEED,SEED,homes,excluded,1,1,at,{})
  before=copy.deepcopy(first['homes'][-1]['history'])
  homes,excluded=t.normalize([row(bedrooms=0)],CFG,t.stamp(NOW+dt.timedelta(days=1)))
  result=t.combine(first,SEED,homes,excluded,1,1,t.stamp(NOW+dt.timedelta(days=1)),{})
  old=result['homes'][-1];self.assertEqual(old['bedrooms'],0);self.assertEqual(old['layout_status'],'studio');self.assertEqual(old['history'],before)
  again=t.combine(result,SEED,[],{},0,0,t.stamp(NOW+dt.timedelta(days=2)),{})
  self.assertEqual(again['homes'][-1]['bedrooms'],0)
  homes,excluded=t.normalize([row(bedrooms=None)],CFG,t.stamp(NOW+dt.timedelta(days=3)))
  unknown=t.combine(again,SEED,homes,excluded,1,1,t.stamp(NOW+dt.timedelta(days=3)),{})
  self.assertEqual(unknown['homes'][-1]['layout_status'],'studio');self.assertEqual(unknown['homes'][-1]['bedrooms'],0)
 def test_conflicting_duplicate_does_not_publish_accepted_copy(self):
  for rows in [[row(),row(bedrooms=0)],[row(bedrooms=0),row()]]:
   homes,excluded=t.normalize(rows,CFG,t.stamp(NOW));self.assertEqual(homes,[])
 def test_explicit_studio_without_bed_count_stays_nonmatching(self):
  homes,excluded=t.normalize([row(bedrooms=None,unitLayout='Studio')],CFG,t.stamp(NOW))
  self.assertEqual(excluded['layout_corrections']['rentcast:a']['layout_status'],'studio')
 def test_inactive_and_duplicate_unknown_cannot_erase_studio_evidence(self):
  for rows in [[row(bedrooms=0,status='Inactive')],[row(bedrooms=0),row(bedrooms=None)],[row(bedrooms=None),row(bedrooms=0)]]:
   homes,excluded=t.normalize(rows,CFG,t.stamp(NOW));self.assertEqual(homes,[])
   self.assertEqual(excluded['layout_corrections']['rentcast:a']['layout_status'],'studio')
 def test_both_structured_layout_fields_are_checked(self):
  for fields in [dict(unitLayout='One bedroom',floorPlanType='Studio'),dict(unitLayout='Studio',floorPlanType='One bedroom')]:
   homes,excluded=t.normalize([row(**fields)],CFG,t.stamp(NOW));self.assertEqual(homes,[])
   self.assertEqual(excluded['layout_corrections']['rentcast:a']['layout_declaration'],'conflict')
 def test_explicit_studio_survives_weaker_counts_until_explicitly_resolved(self):
  previous=SEED
  steps=[{},dict(unitLayout='Studio'),dict(bedrooms=2),dict(bedrooms=None),{},dict(unitLayout='One bedroom')]
  for day,fields in enumerate(steps):
   at=t.stamp(NOW+dt.timedelta(days=day));homes,excluded=t.normalize([row(**fields)],CFG,at)
   previous=t.combine(previous,SEED,homes,excluded,1,1,at,{})
   home=next(h for h in previous['homes'] if h['id']=='rentcast:a')
   self.assertEqual(home['layout_status'],'provider_reported' if day in (0,5) else 'conflict')
   if 0<day<5:self.assertEqual(home['layout_declaration'],'studio')
 def test_duplicate_numeric_studio_cannot_discard_explicit_evidence(self):
  for rows in [[row(bedrooms=0),row(unitLayout='Studio')],[row(unitLayout='Studio'),row(bedrooms=0)]]:
   homes,excluded=t.normalize(rows,CFG,t.stamp(NOW));self.assertEqual(homes,[])
   self.assertEqual(excluded['layout_corrections']['rentcast:a']['layout_declaration'],'studio')
 def test_numeric_only_layout_can_be_corrected_by_later_numeric_evidence(self):
  previous=SEED
  for day,fields in enumerate([{},dict(bedrooms=0),{}]):
   at=t.stamp(NOW+dt.timedelta(days=day));homes,excluded=t.normalize([row(**fields)],CFG,at)
   previous=t.combine(previous,SEED,homes,excluded,1,1,at,{})
  self.assertEqual(previous['homes'][-1]['layout_status'],'provider_reported')
 def test_query_is_one_page_without_listing_age_cutoff(self):
  q=t.build_query(CFG);self.assertEqual(q['price'],'1200:3000');self.assertEqual(q['limit'],500);self.assertNotIn('daysOld',q)
 def test_parking_and_charging_are_unknown(self):
  h,e=t.normalize([row()],CFG,t.stamp(NOW));self.assertEqual(h[0]['parking']['status'],'unknown');self.assertEqual(h[0]['charging']['status'],'unknown');self.assertIsNone(h[0]['source_url'])
 def test_non_downtown_and_missing_coordinates_are_counted(self):
  h,e=t.normalize([row(id='a',latitude=42),row(id='b',latitude=None)],CFG,t.stamp(NOW));self.assertEqual(h,[]);self.assertEqual(e['outside_search_window'],1);self.assertEqual(e['missing_coordinates'],1)
 def test_invalid_rent_fails_instead_of_empty_success(self):
  for v in [None,float('nan'),float('inf'),-1,True,'2400']:
   with self.assertRaises(ValueError):t.normalize([row(price=v)],CFG,t.stamp(NOW))
 def test_malformed_response_fails(self):
  for rows in [{},[None],[row(id=None)],[row(formattedAddress='')]]:
   with self.assertRaises(ValueError):t.normalize(rows,CFG,t.stamp(NOW))
 def test_wrong_city_is_not_silently_published(self):
  with self.assertRaises(ValueError):t.normalize([row(city='Evanston')],CFG,t.stamp(NOW))
 def test_duplicate_ids_do_not_duplicate_homes(self):
  h,e=t.normalize([row(),row()],CFG,t.stamp(NOW));self.assertEqual(len(h),1);self.assertEqual(e['duplicate'],1)
 def test_layout_price_and_inactive_filters(self):
  h,e=t.normalize([row(bedrooms=2),row(id='b',price=4000),row(id='c',status='Inactive')],CFG,t.stamp(NOW));self.assertFalse(h);self.assertEqual(e['outside_layout_or_price'],2);self.assertEqual(e['inactive'],1)
 def test_price_change_uses_same_id_and_preserves_actual_history(self):
  at=t.stamp(NOW);h,e=t.normalize([row()],CFG,at);first=t.combine(SEED,SEED,h,e,1,1,at,{})
  later=t.stamp(NOW+dt.timedelta(days=1));h,e=t.normalize([row(price=2300)],CFG,later);second=t.combine(first,SEED,h,e,1,1,later,{})
  self.assertEqual(second['homes'][-1]['history'],[dict(date=at,rent=2400),dict(date=later,rent=2300)]);self.assertIn('$2,400 to $2,300',second['events'][0]['description'])
 def test_missing_listing_is_not_claimed_rented(self):
  at=t.stamp(NOW);h,e=t.normalize([row()],CFG,at);first=t.combine(SEED,SEED,h,e,1,1,at,{});second=t.combine(first,SEED,[],{},0,0,t.stamp(NOW+dt.timedelta(days=1)),{})
  self.assertFalse(second['homes'][-1]['seen_in_latest']);self.assertIn('unverified',second['events'][0]['description'])
 def test_capped_coverage_is_explicit(self):
  d=t.combine(SEED,SEED,[],{},900,500,t.stamp(NOW),{});self.assertTrue(d['provider']['truncated']);self.assertIn('incomplete',d['provider']['coverage'])
 def test_retention_bound_keeps_current_and_seed_homes(self):
  old=copy.deepcopy(SEED);base=t.normalize([row()],CFG,t.stamp(NOW))[0][0]
  old['homes'] += [{**base,'id':'old:'+str(i),'seen_in_latest':False} for i in range(1200)]
  result=t.combine(old,SEED,[base],{},1,1,t.stamp(NOW),{});self.assertLessEqual(len(result['homes']),1000);self.assertTrue(any(h['id']=='rentcast:a' for h in result['homes']));self.assertGreater(result['provider']['archived_from_current_view'],0)
 def test_transport_uses_header_timeout_and_one_call(self):
  class R:
   headers={'X-Total-Count':'1'}
   def read(self,n):return json.dumps([row()]).encode()
   def __enter__(self):return self
   def __exit__(self,*a):pass
  calls=[]
  def opener(req,timeout):calls.append((req,timeout));return R()
  rows,total=t.get_listings('secret-value',t.build_query(CFG),opener);self.assertEqual(len(calls),1);self.assertEqual(calls[0][1],30);self.assertNotIn('secret-value',calls[0][0].full_url);self.assertEqual(total,1)
 def test_transport_failure_does_not_retry(self):
  calls=[]
  def opener(req,timeout):calls.append(req);raise TimeoutError()
  with self.assertRaises(TimeoutError):t.get_listings('key',{},opener)
  self.assertEqual(len(calls),1)
class ContextTests(unittest.TestCase):
 def test_chargers_are_public_electric_locations_only(self):
  common=dict(id=1,station_name='Station',latitude=41.88,longitude=-87.63,fuel_type_code='ELEC',access_code='public',status_code='E')
  result=city.chargers(json.dumps({'fuel_stations':[common,{**common,'id':2,'access_code':'private'}]}).encode(),CFG['bounds']);self.assertEqual(len(result),1)
 def test_cta_parent_stations_not_duplicate_platforms(self):
  f=io.BytesIO()
  with zipfile.ZipFile(f,'w') as z:z.writestr('stops.txt','stop_id,stop_name,stop_lat,stop_lon,location_type\n40000,Example,41.88,-87.63,1\n30000,Platform,41.88,-87.63,0\n')
  self.assertEqual(len(city.cta_stations(f.getvalue(),CFG['bounds'])),1)
if __name__=='__main__':unittest.main()
