from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from datetime import datetime, timezone
import json
stamp=datetime.now(timezone.utc).isoformat()
def offer(id,name,kind,unit,price):
 return dict(id=id,name=name,kind=kind,unit=unit,chain='obs',source_id=id,url='https://www.obsbygg.no/test/'+id,checked_at=stamp,availability='https://schema.org/InStock',vat='inkl',original_ore=round(price*125),normalized_ore=round(price*100),package_price_ex_vat_ore=round(price*100),package_quantity=1,quantity_basis='unit',original_unit=unit,price_kind='public')
catalog={'version':1,'offers':[offer('hunton','Hunton trefiberisolasjon 100 mm','insulation','m2',200),offer('glava','Glava mineralull isolasjon 100 mm','insulation','m2',100),offer('frame48','48x48 Lekt','battens','m',30),offer('frame23','23x48 Lekt','battens','m',15)],'stores':[],'sources':[]}

terrace={'summary':'Riving og ny terrasse med avtalt rekkverk','items':[
 {'elementId':'terrace.strip.joists','taskIds':['step0','step1'],'reason':'Eksisterende dekke og bjelkelag skiftes','scope':'requested'},
 {'elementId':'terrace.new.joists','taskIds':['joists'],'reason':'Nytt bjelkelag, dimensjonering må kontrolleres','scope':'requested'},
 {'elementId':'terrace.new.deck','taskIds':['deck'],'reason':'28x120 impregnert terrassebord','scope':'requested'},
 {'elementId':'terrace.new.railing','taskIds':['railing'],'reason':'12 meter rekkverk','scope':'requested'}],
 'questions':['Hva er arealet?','Ønskes stående eller liggende terrassebord?','Hvilken overflate ønsker du?']}
wall={'summary':'Etterisolering av avtalt veggareal','items':[
 {'elementId':'insulation.insulation','taskIds':['frame','insulation'],'reason':'Oppgitt isolasjon og utlekting; produkt må velges','scope':'requested'},
 {'elementId':'insulation.cladding','taskIds':['barrier','cladding'],'reason':'Vindsperre og kledning','scope':'requested'}],
 'questions':['Skal du ha isolasjon?','Skal du ha vindsperre?','Skal kledningen være liggende eller stående?','Hvor stort er arealet?']}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000});authorize_portal(page);errors=[];calls=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def endpoint(route):
  if route.request.method=='GET':route.fulfill(content_type='application/json',body='{"ready":true}');return
  data=route.request.post_data_json;calls.append(data)
  route.fulfill(content_type='application/json',body=json.dumps(wall if 'yttervegg' in data['brief'] else terrace))
 page.route('**/functions/v1/rigor-ai-estimate',endpoint)
 page.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(catalog)))
 page.goto('http://127.0.0.1:8090/kalkyle.html');page.locator('#start-simple').click();page.locator('#project-name').fill('Terrasse AI budsjett');page.locator('#project-submit').click()
 page.wait_for_function('!document.getElementById("brief-generate").disabled')
 initial=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.rows')
 page.locator('#job-brief').fill('Skal rive gammel terrasse og bygge ny. Ca. 35 m². 28x120 impregnert terrassebord og omtrent 12 meter rekkverk.')
 page.locator('#brief-generate').click();page.locator('#assistant-clarification').wait_for(state='visible');assert len(calls)==0
 assert page.locator('[data-clarification]').count()==1
 page.locator('[data-clarification]').select_option('Skiftes');page.locator('#assistant-continue').click();assert len(calls)==0
 assert 'bakkenivå' in page.locator('#assistant-clarification-fields').inner_text()
 page.locator('[data-clarification]').select_option('I bakkenivå / lav terrasse');page.locator('#assistant-continue').click();page.locator('#ai-budget').wait_for(state='visible')
 assert len(calls)==1 and calls[0]['mode']=='simple_estimator';assert len(calls[0]['context']['questionsAnswered'])==2
 assert page.locator('#assistant-questions').is_hidden();assert page.locator('#assistant-clarification').is_hidden()
 assert 'kjent delsum' in page.locator('#ai-budget').inner_text();assert '35 m²' in page.locator('#ai-budget').inner_text();assert '12 m' in page.locator('#ai-budget').inner_text()
 # Real sourced rates can provide budget ranges without selecting every product.
 for element,minimum,maximum in [('terrace.new.joists','200','250'),('terrace.new.deck','400','500'),('terrace.new.railing','700','900')]:
  page.locator('#ai-experience-editor summary').click();page.locator('#ai-rate-element').select_option(element);page.locator('#ai-rate-type').select_option('complete')
  page.locator('#ai-rate-min').fill(minimum);page.locator('#ai-rate-max').fill(maximum);page.locator('#ai-rate-source').fill('Dokumentert testjobb, ikke norm');page.locator('#ai-rate-date').fill(datetime.now(timezone.utc).date().isoformat());page.locator('#ai-rate-confidence').select_option('medium');page.get_by_role('button',name='Lagre erfaringstall',exact=True).click()
 assert page.locator('#ai-budget h3').inner_text()=='Foreløpig budsjettanslag'
 assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.rows')==initial
 saved=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].aiContext');assert len(saved['priceBasis']['experienceRates'])==3
 page.locator('#ai-budget').screenshot(path='/tmp/rigor-ai-budget-desktop.png')
 page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();page.locator('#ai-budget').wait_for(state='visible');assert 'Foreløpig budsjettanslag' in page.locator('#ai-budget').inner_text()
 page.locator('#ai-make-detailed').click();page.locator('#assistant-preview').wait_for(state='visible');assert len(calls)==1 and calls[0]['mode']=='simple_estimator'
 page.locator('#assistant-apply').click();count=page.locator('tr[data-row-index]').count();assert count==6
 page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible');assert page.locator('[data-assistant-element]:checked').count()==0;assert page.locator('tr[data-row-index]').count()==count
 # A detailed explicit wall request asks only for the missing area.
 page.locator('#project-back').click();page.locator('#start-detailed').click();page.locator('#project-name').fill('Yttervegg AI');page.locator('#project-submit').click()
 page.locator('#job-brief').fill('Legg inn 100 mm Hunton trefiberisolasjon på ytterveggen, ny vindsperre, 48x48 utlekting og liggende kledning.')
 before_calls=len(calls);page.locator('#brief-generate').click();assert page.locator('[data-clarification]').count()==1;assert 'veggareal' in page.locator('#assistant-clarification-fields').inner_text();assert len(calls)==before_calls
 page.locator('[data-clarification]').fill('140');page.locator('#assistant-continue').click();page.locator('#assistant-preview').wait_for(state='visible');assert page.locator('[data-assistant-quantity]').nth(0).input_value()=='140';assert page.locator('#assistant-questions').is_hidden()
 page.locator('#assistant-apply').click();assert page.locator('tr[data-row-index]').count()==7
 # Explicit dimensions and product material limit actual market product choices.
 rows=page.locator('tr[data-row-index]')
 rows.nth(1).locator('.row-market-button').click();values=page.locator('#material-product option').evaluate_all('(options)=>options.map(o=>o.value)');assert 'hunton' in values and 'glava' not in values;page.locator('#material-cancel').click()
 rows.nth(0).locator('.row-market-button').click();values=page.locator('#material-product option').evaluate_all('(options)=>options.map(o=>o.value)');assert 'frame48' in values and 'frame23' not in values;page.locator('#material-cancel').click()
 page.locator('#detailed').click();first=page.locator('tr[data-row-index]').first;first.locator('input').nth(3).fill('123');page.locator('#save').click()
 row_snapshot=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[1].snapshot.rows')
 page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible');assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[1].snapshot.rows')==row_snapshot
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path='/tmp/rigor-ai-modes-mobile.png',full_page=True)
 assert not errors,errors
 print('PASS: sequential dropdown questions, mode transport, sourced budget ranges, unchanged rows, saved context, detailed conversion, explicit wall facts, duplicate prevention, manual edits and mobile')
 browser.close()
