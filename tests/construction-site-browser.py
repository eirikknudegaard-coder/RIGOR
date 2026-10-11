"""Published/local site-load flow. Synthetic portal auth, no paid AI or user data."""
from playwright.sync_api import sync_playwright
from portal_test_support import authorize_portal
import os,json
base=os.environ.get('RIGOR_TEST_BASE','http://127.0.0.1:8090')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100});errors=[]
    authorize_portal(page,tool_key='konstruksjon')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/functions/v1/rigor-ai-construction',lambda r:r.fulfill(json={'ready':False}))
    page.goto(base+'/konstruksjon.html')
    page.wait_for_function('document.getElementById("construction-ai-status").textContent==="Faglig spørreflyt"')
    page.locator('#construction-brief').fill('Jeg vil kontrollere en drager for snølast. Saltak med 30 grader i Grimstad, 70 moh.')
    page.locator('#construction-submit').click()
    panel=page.locator('#construction-site-panel')
    assert panel.get_attribute('open') is not None
    assert page.locator('#site-municipality').input_value()=='4202'
    assert page.locator('#site-altitudeM').input_value()=='70'
    assert '4,5 kN/m²' in panel.inner_text()
    for id,value in {'roofType':'gable','snowExposure':'normal','snowSliding':'free','snowDrift':'none','thermal':'normal'}.items():page.locator('#site-'+id).select_option(value)
    page.locator('#site-roofAngleDeg').fill('30')
    run=panel.get_by_role('button',name='Beregn stedlig lastgrunnlag',exact=True)
    apply=panel.get_by_role('button',name='Bruk beregnet snølast i tak-/terrasseskjemaet')
    run.click();assert apply.is_disabled()
    panel.locator('details>summary').click()
    page.locator('#site-standardSource').fill('NS-EN 1991-1-3:2003+A1:2015+NA:2018 – testgrunnlag kontrollert')
    page.locator('#site-confirmed').check();run.click()
    assert 'Karakteristisk snølast på tak: 3,6 kN/m²' in panel.inner_text()
    assert apply.is_enabled();apply.click()
    page.locator('#construction-basis>summary').click()
    row=page.locator('#construction-facts tr').filter(has_text='Snølast på taket (kN/m²)').first
    assert '3,6' in row.inner_text() and 'Stedlig beregning:' in row.inner_text()
    # Editing height removes the derived roof load and requires the missing rule.
    page.locator('#construction-facts tr').filter(has_text='Byggestedets høyde over havet').get_by_role('button',name='Endre').click()
    page.locator('#construction-current-answer').fill('200')
    page.locator('#construction-answer button[type=submit]').click()
    assert 'Stedlig beregning:' not in page.locator('#construction-facts').inner_text()
    assert page.locator('#site-altitudeM').input_value()=='200'
    assert not page.locator('#site-confirmed').is_checked()
    page.locator('#site-confirmed').check();run.click()
    assert 'over tabellens høydegrense' in panel.inner_text();assert apply.is_disabled()
    # A current merged municipality never chooses one of its old norm areas.
    page.locator('#site-municipality').select_option('4204')
    assert page.locator('#site-area').input_value()==''
    page.locator('#site-area').select_option('Søgne');page.locator('#site-altitudeM').fill('50')
    assert 'marksnølast 3,5 kN/m²' in panel.inner_text()
    # Wind remains a signed/directional load basis, never a downward roof load.
    page.locator('#site-actions').select_option('wind')
    for id,value in {'terrain':'II','topography':'hill','terrainTransition':'no'}.items():page.locator('#site-'+id).select_option(value)
    for id,value in {'heightM':'10','altitudeFactor':'1','altitudeFactorSource':'Dokumentert høydefaktor for teststedet','turbulenceIntensity':'0.2','turbulenceSource':'Dokumentert turbulens for teststedet'}.items():page.locator('#site-'+id).fill(value)
    page.locator('#site-confirmed').check();run.click()
    assert 'Vindkasttrykk qp:' not in panel.inner_text() and apply.is_disabled()
    page.locator('#site-topography').select_option('flat');page.locator('#site-confirmed').check();run.click()
    assert 'Vindkasttrykk qp: 1,028 kN/m²' in panel.inner_text()
    assert apply.is_disabled()
    with page.expect_download() as dl:panel.get_by_role('button',name='Last ned stedlig lastgrunnlag (JSON)').click()
    data=json.load(open(dl.value.path()));assert data['level']=='load_basis';assert data['wind']['vb0']==26;assert data['input']['area']=='Søgne'
    # Transfer to the terrace form also retains its source and clears on edits.
    page.locator('#construction-brief').fill('Hvor mange stolper trenger jeg på terrassen? Snølast i Grimstad, 70 moh.')
    page.locator('#construction-submit').click()
    for id,value in {'roofType':'flat','snowExposure':'normal','snowSliding':'free','snowDrift':'none','thermal':'normal'}.items():page.locator('#site-'+id).select_option(value)
    page.locator('#site-roofAngleDeg').fill('0')
    if not panel.locator('details').evaluate('e=>e.open'):panel.locator('details>summary').click()
    page.locator('#site-standardSource').fill('NS-EN 1991-1-3:2003+A1:2015+NA:2018 – testgrunnlag kontrollert')
    page.locator('#site-confirmed').check();run.click();apply.click()
    assert page.locator('#rib-member').input_value()=='terrace'
    assert page.locator('#rib-snowStatus').input_value()=='documented'
    assert page.locator('#rib-snowKnM2').input_value()=='3.6'
    assert 'Stedlig beregning:' in page.locator('#rib-snowSource').input_value()
    page.locator('#site-altitudeM').fill('200')
    assert page.locator('#rib-snowStatus').input_value()=='unknown'
    assert page.locator('#rib-snowKnM2').input_value()==''
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    page.screenshot(path='/tmp/rigor-site-loads-mobile.png',full_page=True)
    browser.close()
print('PASS: municipality/altitude flow, old areas, reference snow, gated adoption, stale-height clearing, wind/topography, signed-load separation, JSON and mobile')
