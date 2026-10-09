"""Computed span, real 2D editing, invalidation and exported calculation; no AI."""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os

base=os.getenv('RIGOR_TEST_BASE_URL','http://127.0.0.1:8090')
output=Path(os.getenv('RIGOR_QA_OUTPUT','/tmp/rigor-terrace-browser'));output.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name,width,height in [('desktop',1440,1000),('mobile',390,844)]:
  page=browser.new_page(viewport={'width':width,'height':height},accept_downloads=True);authorize_portal(page,tool_key='konstruksjon')
  errors=[];calls=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def ai(route):
   if route.request.method=='GET':route.fulfill(json={'ready':True})
   else:calls.append(route.request.post_data_json);route.fulfill(status=500,json={'error':'No provider request permitted in manual test'})
  page.route('**/functions/v1/rigor-ai-construction',ai)
  page.goto(base+'/konstruksjon.html');page.locator('#construction-mode-manual').click();page.locator('#rib-member').select_option('terrace')
  for key,value in {'terraceLengthM':'5','terraceDepthM':'4','terraceHeightM':'2'}.items():page.locator('#rib-'+key).fill(value)
  assert page.locator('#rib-joistSpanM').count()==0 and page.locator('#rib-beamSpanM').count()==0
  panel=page.locator('.terrace-panel');panel.get_by_text('Standardgrunnlag og kontrollomfang',exact=True).click()
  page.locator('#rib-terraceBearingMm').fill('180');page.locator('#rib-equalSharing').check()
  page.locator('.terrace-submit').click();page.locator('.terrace-report h2').wait_for()
  assert '2,745 m' in page.locator('.terrace-report').inner_text()
  assert 'Snølast på terrassen er ikke avklart' in page.locator('.terrace-report').inner_text()
  assert 'NA' in page.locator('.terrace-report').inner_text()
  assert page.locator('.terrace-workspace svg .terrace-support').count()>4
  with page.expect_download() as dl:page.get_by_role('button',name='Last ned beregning (JSON)',exact=True).click()
  path=output/(name+'-calculation.json');dl.value.save_as(path);data=json.loads(path.read_text())
  assert data['kind']=='terrace_span_design' and data['status']=='preliminary'
  assert abs(data['equilibrium']['gExpectedKn']-data['equilibrium']['gReactionKn'])<1e-8
  assert abs(data['equilibrium']['qReactionKn']-80)<1e-8
  assert all(c['result']['input']['widthMm']==48 for c in data['checks']if c['role']=='beam')
  # Mouse dragging moves a real line; accessible coordinate controls also work on mobile.
  if name=='desktop':
   handle=page.get_by_role('button',name='Velg dragerlinje 2 m',exact=True);handle.scroll_into_view_if_needed();box=handle.bounding_box()
   page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2+15,steps=5);page.mouse.up()
   assert float(page.get_by_label('Koordinat for valgt linje (m)').input_value())>2
  page.get_by_label('Velg linje i 2D-planen').select_option('row:1')
  page.get_by_label('Koordinat for valgt linje (m)').fill('2.8');page.get_by_role('button',name='Flytt valgt linje',exact=True).click()
  assert page.locator('.terrace-report').is_hidden()
  assert page.get_by_role('button',name='Last ned beregning (JSON)',exact=True).is_disabled()
  assert 'Planen er endret' in page.locator('.terrace-workspace').inner_text()
  page.locator('.terrace-submit').click()
  assert 'Overskredet' in page.locator('.terrace-report').inner_text()
  page.get_by_role('button',name='Fordel automatisk igjen',exact=True).click()
  assert 'Foreløpig' in page.locator('.terrace-report').inner_text()
  page.get_by_role('button',name='+ Dragerlinje',exact=True).click();assert page.locator('.terrace-report').is_hidden()
  page.locator('.terrace-submit').click()
  with page.expect_download() as dl:page.get_by_role('button',name='Last ned 2D-skisse (SVG)',exact=True).click()
  path=output/(name+'-plan.svg');dl.value.save_as(path);svg=path.read_text()
  assert 'NaN' not in svg and '<svg' in svg and 'terrace-handle' not in svg
  # Larger snow load must reduce the computed joist limit.
  page.locator('#rib-snowStatus').select_option('documented');page.locator('#rib-snowKnM2').fill('6');page.locator('#rib-snowSource').fill('Numerical benchmark for terrace surface snow, not ground snow')
  page.get_by_role('button',name='Fordel automatisk igjen',exact=True).click()
  with page.expect_download() as dl:page.get_by_role('button',name='Last ned beregning (JSON)',exact=True).click()
  path=output/(name+'-snow.json');dl.value.save_as(path);snow=json.loads(path.read_text())
  assert snow['joistLimit']['limitM']<data['joistLimit']['limitM']
  assert abs(snow['equilibrium']['snowReactionKn']-120)<1e-8
  page.locator('.terrace-report').scroll_into_view_if_needed();page.screenshot(path=str(output/(name+'.png')),full_page=True)
  assert not calls and not errors,(calls,errors)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  print('PASS',name,'computed span, weights, discrete load path, real drag / accessible 2D controls, stale result protection, SVG/JSON and snow',flush=True)
  page.close()
 browser.close()
