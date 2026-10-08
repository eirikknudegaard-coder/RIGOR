"""Actual portal/app/modules. Synthetic authentication and AI; no paid calls."""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import json,re

base='http://127.0.0.1:8090'
def value_number(text):return float(re.sub(r'[^0-9,.-]','',text).replace(',','.'))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 def new_page(mode='admin',key='konstruksjon',wait=True,ai=False):
  page=browser.new_page(viewport={'width':1440,'height':1100});authorize_portal(page,mode=mode,tool_key=key,wait=wait)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/functions/v1/rigor-ai-construction',lambda r:r.fulfill(json={'ready':ai}) if r.request.method=='GET' else r.fulfill(status=503,json={'error':'Synthetic AI failure'}))
  return page
 # Direct URL starts no business logic before server-verified tool access.
 for mode,key in [('anonymous','konstruksjon'),('inactive','konstruksjon'),('disabled','konstruksjon'),('member','kalkyle')]:
  page=new_page(mode,key,False);requests=[];page.on('request',lambda r:requests.append(r.url));page.goto(base+'/konstruksjon.html');page.wait_for_url('**/portal.html?returnTo=konstruksjon.html*');assert not any('/construction/ui.js' in u or '/rigor-ai-construction' in u for u in requests);page.close()
 page=new_page('member');page.goto(base+'/konstruksjon.html');assert page.evaluate('window.testPortalCalls.some(c=>c.table==="portal_tool_access"&&c.filters.tool_key==="konstruksjon"&&c.filters.user_id==="verified-test-user")');page.evaluate('window.testAuthEmit("SIGNED_OUT","anonymous")');page.wait_for_url('**/portal.html?returnTo=konstruksjon.html*');page.close()
 page=new_page();page.goto(base+'/konstruksjon.html');page.wait_for_function('document.getElementById("construction-ai-status").textContent==="Faglig spørreflyt"')
 def start(text):
  page.locator('#construction-brief').fill(text);page.locator('#construction-submit').click();page.locator('#construction-workspace').wait_for(state='visible')
 def answer(value,select=False):
  field=page.locator('#construction-current-answer');field.select_option(value) if select else field.fill(value)
  page.locator('#construction-answer button[type=submit]').click()
 def q():return page.locator('#construction-question-title').inner_text()
 def unknown():page.locator('#construction-unknown').click()
 start('Jeg vil undersøke en fritt opplagt drager med spenn på 3,2 meter. Jevnt fordelt last på 4 kN/m. Drager 115x315 mm, limtre GL30c.')
 assert 'fastsatt' in q();answer('documented',True);assert 'kommer lastene' in q();answer('Testtegning K-01');assert page.locator('#construction-calculate').is_enabled();assert page.locator('#construction-results').is_hidden()
 page.locator('#construction-calculate').click();assert page.locator('#construction-level').inner_text()=='ORIENTERENDE BEREGNING';metrics=page.locator('#construction-metrics dd');assert value_number(metrics.nth(0).inner_text())==12.8;assert value_number(metrics.nth(1).inner_text())==5.12;assert metrics.nth(3).inner_text()=='Ikke beregnet'
 page.locator('#construction-section').click();assert 'bygget opp' in q();answer('solid_single',True);assert 'egenvekt' in q();answer('true',True);assert 'støtter' in q();answer('unsupported',True);page.locator('#construction-calculate').click();assert 'støtte mangler' in page.locator('#construction-explanation p').first.inner_text();assert abs(value_number(metrics.nth(3).inner_text())-1.4)<.01
 page.locator('#construction-basis>summary').click();assert 'GL30c' in page.locator('#construction-facts').inner_text();assert 'ASSUMED' in page.locator('#construction-facts').inner_text();assert 'Eurocode' in page.locator('#construction-checks').inner_text()
 page.locator('#construction-basis details>summary').click();assert page.locator('#construction-diagrams svg').count()==3
 curve=page.locator('#construction-diagrams svg').nth(2).locator('path').get_attribute('d');ys=[float(y) for x,y in re.findall(r'[ML] ([0-9.]+) ([0-9.]+)',curve)];assert max(ys)>ys[0] and abs(ys[-1]-ys[0])<.001
 with page.expect_download() as d:page.locator('#construction-download').click()
 data=json.load(open(d.value.path()));assert data['level']=='orienting';assert data['beam']['spanM']==3.2;assert data['beam']['loads']['qNPerM']==4000;assert len(data['beam']['samples'])>=101;assert data['checks']['deflection']['criterionStatus']=='ASSUMED';assert 'approved' not in data
 page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/rigor-construction-desktop.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.evaluate('scrollTo(0,0)');page.screenshot(path='/tmp/rigor-construction-mobile.png',full_page=True);page.set_viewport_size({'width':1440,'height':1100})
 # The assumed deflection criterion is optional, editable and never a code approval.
 page.locator('#construction-facts tr').filter(has_text='Foreløpig nedbøyningsgrense L/').get_by_role('button',name='Endre').click();answer('400');page.locator('#construction-calculate').click();assert 'L/400' in page.locator('#construction-explanation').inner_text();assert page.locator('#construction-facts tr').filter(has_text='Foreløpig nedbøyningsgrense L/').count()==1
 # Edits invalidate displayed calculations; invalid answers never change inputs.
 row=page.locator('#construction-facts tr').filter(has_text='Last langs drageren (kN/m)').first;row.get_by_role('button',name='Endre').click();answer('-2');assert 'Oppgi ett tall' in page.locator('#construction-answer-error').inner_text();answer('1');assert page.locator('#construction-results').is_hidden();page.locator('#construction-calculate').click();assert value_number(metrics.nth(1).inner_text())==1.28
 # The user's wall example asks about the nominal member and load path first.
 start('Trenger jeg en drager her? Bindingsverk c/c 600, 2x8 og saltak med 25 graders vinkel. Jeg vil fjerne ca. 3 meter av veggen.')
 assert 'hvilken del' in q();answer('rafters',True);assert 'på tvers' in q();answer('across',True);assert 'faktisk' in q();answer('yes',True);assert 'etasjeskiller' in q();answer('no',True);assert 'spenner' in q();answer('4,4');assert 'lastgrunnlag' in q();answer('roof',True);assert 'mønet' in q();answer('ridge_beam',True);assert 'én side' in q();answer('one',True);assert 'målt vannrett' in q();answer('horizontal',True);assert 'egenvekt' in q();answer('0,8');assert 'snølast' in q();answer('2');assert 'areal' in q();answer('horizontal',True);answer('preliminary',True);answer('Kun testlaster; ikke verifisert for et bygg');unknown();page.locator('#construction-calculate').click();assert value_number(metrics.nth(0).inner_text())==18.48;assert page.locator('#construction-explanation').inner_text().count('Retningen alene')==0
 # Roof trusses and continuous beams do not receive guessed simple-beam results.
 page.locator('#construction-basis>summary').click();page.locator('#construction-facts tr').filter(has_text='Bæring ved mønet').get_by_role('button',name='Endre').click();answer('trusses',True);assert page.locator('#construction-calculate').is_disabled();assert page.locator('#construction-results').is_hidden();assert 'Takstoler' in page.locator('#construction-limitations').inner_text()
 start('Jeg vil undersøke en drager med tre stolper under. Drager med spenn på 4 meter. Jevn last på 3 kN/m.');assert page.locator('#construction-calculate').is_disabled();assert 'Tre eller flere opplegg' in page.locator('#construction-limitations').inner_text()
 start('Jeg vil undersøke en fritt opplagt drager IPE200 i S355. Drager med spenn på 4 meter. Jevn last på 3 kN/m.');answer('documented',True);answer('Testprofil K-03');page.locator('#construction-calculate').click();page.locator('#construction-section').click();assert page.locator('#construction-calculate').is_disabled();assert 'massivt rektangel' in page.locator('#construction-limitations').inner_text();page.locator('#construction-forces-only').click();assert page.locator('#construction-calculate').is_enabled()
 # No anonymous/shared project storage is created by the new assistant.
 assert page.evaluate('localStorage.getItem("rigor-projects-v1")') is None;page.close()
 # AI proposals require confirmation; explanation text can never replace engine numbers.
 page=new_page(ai=True);calls=[];deferred=[];delay=[False]
 def endpoint(route):
  if route.request.method=='GET':route.fulfill(json={'ready':True});return
  data=route.request.post_data_json;calls.append(data)
  if delay[0]:deferred.append(route);return
  if data['action']=='explain':route.fulfill(json={'explanation':{'focusId':'support_result','paragraphs':['Godkjent! 999 kN, diktet av AI.']}});return
  route.fulfill(json={'requiresConfirmation':True,'facts':[{'field':'spanM','value':3.2,'evidence':'3,2 meter mellom oppleggene'},{'field':'system','value':'simple','evidence':'støttes i begge ender'},{'field':'lineLoadKnM','value':3,'evidence':'Lasten er 3 kN per meter'},{'field':'loadChoice','value':'line','evidence':'Lasten er 3 kN per meter'}]})
 page.route('**/functions/v1/rigor-ai-construction',endpoint);page.goto(base+'/konstruksjon.html');page.wait_for_function('document.getElementById("construction-ai-status").textContent==="AI klar"')
 prompt='Jeg vil undersøke en drager. Det er 3,2 meter mellom oppleggene. Den støttes i begge ender. Lasten er 3 kN per meter.'
 start(prompt);page.locator('#construction-ai-review').wait_for(state='visible');assert page.locator('#construction-calculate').is_disabled();assert page.locator('#construction-question-card').is_hidden();assert page.locator('.proposal').count()==4;page.locator('#construction-confirm').click();answer('documented',True);answer('Testlaster K-02');page.locator('#construction-calculate').click();assert value_number(page.locator('#construction-metrics dd').nth(0).inner_text())==9.6
 page.locator('#construction-ai-explain').click();page.wait_for_function('document.getElementById("construction-message").textContent.includes("samme beregnede")');assert '999' not in page.locator('#construction-explanation').inner_text();assert 'Godkjent!' not in page.locator('#construction-explanation').inner_text();assert '4,8 kN' in page.locator('#construction-explanation p').first.inner_text();assert calls[-1]['action']=='explain';assert 'moment' not in calls[-1]
 # A late interpretation for an edited prompt is discarded, not attached to new text.
 delay[0]=True;start(prompt+' Nå ønsker jeg en ny vurdering.');page.wait_for_function('document.getElementById("construction-message").textContent.includes("AI tolker")');assert len(deferred)==1;page.locator('#construction-brief').fill('En helt ny beskrivelse som ikke skal få de gamle AI-verdiene.');deferred[0].fulfill(json={'facts':[{'field':'spanM','value':3.2,'evidence':'3,2 meter mellom oppleggene'}]});page.wait_for_timeout(150);assert page.locator('#construction-workspace').is_hidden();assert page.locator('#construction-submit').is_enabled()
 page.close();assert not errors,errors
 print('PASS: protected independent tool access, sequential natural questions, nominal dimensions, numerical results, no guessed loads, confirmed material/section, support priority, immutable engine explanation, JSON basis, stale edits, complex-system rejection and mobile')
 browser.close()
