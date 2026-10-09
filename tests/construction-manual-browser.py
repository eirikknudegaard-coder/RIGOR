from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright

base='http://127.0.0.1:8090'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    errors=[]
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.on('pageerror',lambda e:errors.append(str(e)))
    authorize_portal(page,tool_key='konstruksjon')
    ai_calls=[]
    def ai(route):
        if route.request.method=='GET':route.fulfill(json={'ready':True})
        else:
            ai_calls.append(route.request.post_data_json)
            route.fulfill(json={'facts':[{'field':'spacingMm','value':600,'evidence':'cc60'}],'requiresConfirmation':True,'partial':True,'rejectedFields':['widthMm']})
    page.route('**/functions/v1/rigor-ai-construction',ai)
    page.goto(base+'/konstruksjon.html')
    page.locator('#construction-mode-manual').click()
    assert page.locator('#construction-composer').is_hidden()
    for key,value in {'widthMm':'115','heightMm':'315','lengthM':'4','bearingMm':'100','limitRatio':'300'}.items():page.locator('#rib-'+key).fill(value)
    page.locator('#rib-grade').select_option('GL30c');page.locator('#rib-serviceClass').select_option('2')
    page.locator('#rib-expression').select_option('6.10')
    page.locator('#rib-restrained').check();page.locator('#rib-supportsVerified').check()
    for load,q in [('load-1','1'),('load-2','2')]:
        page.locator('#rib-'+load+'-qKnM').fill(q);page.locator('#rib-'+load+'-source').fill('K-01: browser test only')
    for key,value in {'psi0':'.7','psi1':'.5','psi2':'.3'}.items():page.locator('#rib-load-2-'+key).fill('0'+value)
    submit=page.locator('.rib-submit')
    submit.click();page.locator('.rib-report h2').wait_for(state='visible')
    assert 'ufullstendig' in page.locator('.rib-report h2').inner_text()
    assert 'NA' in page.locator('.rib-report').inner_text()
    page.locator('#rib-standardSource').fill('Test first-generation EN profile, not a real project NA check')
    page.locator('#rib-confirmed').check();submit.click()
    assert page.locator('.rib-report h2').inner_text()=='Innenfor det beregnede medlemsomfanget'
    assert 'Sluttnedbøyning' in page.locator('.rib-report').inner_text()
    assert not ai_calls
    with page.expect_download() as dl:page.locator('.rib-report button').click()
    assert dl.value.suggested_filename=='rigor-medlemsberegning.json'
    page.locator('#rib-widthMm').fill('48');assert page.locator('.rib-report').is_hidden();assert not page.locator('#rib-confirmed').is_checked()
    page.locator('#rib-heightMm').fill('98');submit.click();assert 'overskredet' in page.locator('.rib-report h2').inner_text()
    # Steel mixed moment cannot become a complete column check.
    page.locator('#rib-member').select_option('column');page.locator('#rib-family').select_option('steel')
    assert page.locator('#rib-load-1-qKnM').is_hidden();assert page.locator('#rib-load-1-nKn').is_visible()
    for key,value in {'widthMm':'100','heightMm':'100','lengthM':'3','effectiveYM':'3','effectiveZM':'3','fyMPa':'355','strengthSource':'Thickness 10 mm: product test','thetaDenominator':'200'}.items():page.locator('#rib-'+key).fill(value)
    page.locator('#rib-bucklingCurve').select_option('c');page.locator('#rib-globalSway').check()
    page.locator('#rib-load-1-nKn').fill('10');page.locator('#rib-load-2-nKn').fill('0')
    page.locator('#rib-confirmed').check();submit.click()
    assert 'ufullstendig' in page.locator('.rib-report h2').inner_text();assert '6.3.3' in page.locator('.rib-report').inner_text();assert 'skjevstillingskraft' in page.locator('.rib-report').inner_text()
    # Concrete upper-bound reference must not be called a designed column.
    page.locator('#rib-family').select_option('concrete')
    for key,value in {'widthMm':'300','heightMm':'500','fckMPa':'30','fykMPa':'500','reinforcementMm2':'1200'}.items():page.locator('#rib-'+key).fill(value)
    submit.click();assert 'ufullstendig' in page.locator('.rib-report h2').inner_text();assert 'andreordens' in page.locator('.rib-report').inner_text()
    # The original terrace wording proceeds to geometry, even with partial AI.
    page.locator('#construction-mode-ai').click()
    brief='Hvor mange søyler trenger jeg på min terrasse? Jeg legger dobbel langsgående bjelke der det trengs, og enkle cc60 bjelker på tvers. Hvor bør stolpene plasseres?'
    page.locator('#construction-brief').fill(brief);page.locator('#construction-submit').click()
    page.locator('#construction-message').filter(has_text='Noen detaljer').wait_for()
    assert page.locator('#construction-question-title').inner_text()=='Hvor lang er terrassen langs huset?'
    for answer in ['8','4','1.2']:
        page.locator('#construction-current-answer').fill(answer);page.locator('#construction-answer button[type=submit]').click()
    page.locator('#construction-current-answer').select_option('free_standing');page.locator('#construction-answer button[type=submit]').click()
    page.locator('#construction-open-manual').click()
    assert page.locator('#rib-member').input_value()=='terrace'
    assert page.locator('#rib-terraceLengthM').input_value()=='8'
    assert page.locator('#rib-spacingMm').input_value()=='600'
    for key,value in {'joistSpanM':'2.1','beamSpanM':'2.9','deadKnM2':'0.5','liveKnM2':'2','spanSource':'K-11: checked span test, not actual project'}.items():page.locator('#rib-'+key).fill(value)
    submit.click();assert '12 støttepunkter' in page.locator('.rib-report').inner_text();assert 'hver planke' in page.locator('.rib-report').inner_text();assert page.locator('.rib-report svg circle').count()==12
    assert len(ai_calls)==1
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#construction-manual').scroll_into_view_if_needed();page.screenshot(path='/tmp/rigor-rib-mobile.png',full_page=True)
    page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path='/tmp/rigor-rib-desktop.png',full_page=True)
    assert not errors,errors
    print('PASS: no-AI beam/column form, EN combinations, unverified NA gating, material switch, stale results, steel/RC incomplete checks, JSON, original terrace prompt/geometry/load plan and mobile')
    browser.close()
