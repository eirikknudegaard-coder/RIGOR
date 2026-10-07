from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import json

# The actual confusing question wording supplied by the user, including the
# invalid cladding question. Keep this fixture independent of our catalogue.
labels=['Hva er arealet på terrassen (m²)?','Hva er høyden fra terreng til terrassens overflate?','Ønskes spesifikke dimensjoner på bjelkelaget (f.eks. dimensjon og senteravstand)?','Hvilket materiale og profil ønskes på terrassebordene?','Ønskes stående eller liggende terrassebord?','Hva slags rekkverkstilbehør ønskes (høyde, type, materiale)?']
proposal={'summary':'Avklar terrassearbeidet','items':[
    {'elementId':'terrace.strip.joists','taskIds':['step0','step1'],'scope':'requested','reason':'Eksisterende dekke og bjelkelag skal skiftes'},
    {'elementId':'terrace.strip.deck','taskIds':['step0','step1'],'scope':'related','reason':'Rensk etter demontering'}],'questions':labels}
module='export async function assistantStatus(){return true;} export async function requestEstimate(brief){window.testBriefs=window.testBriefs||[];window.testBriefs.push(brief);return '+json.dumps(proposal)+';}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100});authorize_portal(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/ai-estimate-client.js*',lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(json={'version':1,'sources':[],'offers':[]}))
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.locator('#job-brief').fill('Jeg skal bytte terrasse med nytt dekke og bjelkelag, inklusive rekkverk.')
    page.locator('#start-detailed').click();page.locator('#project-name').fill('Faglige terrasseavklaringer');page.locator('#project-submit').click()
    page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
    questions=page.locator('#assistant-questions');form=questions.locator('.assistant-answer-form')
    assert form.locator('[data-clarification]').count()==10
    assert form.locator('select').count()==3
    assert form.locator('input[type=number]').count()==4
    assert form.locator('input[type=text]').count()==3
    assert 'stående eller liggende terrassebord' not in questions.inner_text()
    assert form.get_by_label('Hvilket materiale ønsker du til terrassebordene?').input_value()==''
    form.get_by_label('Hva er arealet på terrassen?',exact=False).fill('50')
    form.get_by_label('Hvor høyt er terrassegulvet over terrenget?',exact=False).fill('4')
    form.get_by_label('Hvilken bjelkedimensjon er oppgitt eller prosjektert?',exact=False).fill('48 × 198 mm, oppgitt i tegning')
    form.get_by_label('Hva er senteravstanden mellom bjelkene?',exact=False).fill('600')
    form.get_by_label('Hvilket materiale ønsker du til terrassebordene?').select_option('Royalimpregnert tre')
    form.get_by_label('Hvilken overflate ønsker du på terrassebordene?').select_option('Glatt')
    form.get_by_label('Hvilken type rekkverk ønsker du?',exact=False).select_option('Glassfelt')
    form.get_by_label('Hvilken rekkverkshøyde er oppgitt eller prosjektert?',exact=False).fill('1')
    form.get_by_label('Andre ønsker til terrassebordene',exact=False).fill('Brun farge')
    form.get_by_label('Tilbehør og andre ønsker til rekkverket',exact=False).fill('Håndløper')
    assert page.locator('tr[data-row-index]').count()==0
    source=questions.locator('.assistant-sources');source.locator('summary').click()
    assert source.locator('a').count()==4
    assert source.locator('a').last.get_attribute('href').endswith('/12/iii/12-15')
    questions.screenshot(path='/tmp/rigor-terrace-professional-questions.png')
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    questions.screenshot(path='/tmp/rigor-terrace-professional-questions-mobile.png')
    form.get_by_role('button',name='Oppdater forslag med svarene').click()
    page.wait_for_function('window.testBriefs.length===2')
    page.locator('#assistant-preview').wait_for(state='visible')
    sent=page.evaluate('window.testBriefs[1]')
    for answer in ['Terrasseareal: 50 m²','Terrassehøyde: 4 m','Bjelkeavstand: 600 mm','Terrassebordmateriale: Royalimpregnert tre','Terrassebordprofil: Glatt','Rekkverkstype: Glassfelt','Rekkverkshøyde: 1 m','Brun farge','Håndløper']:
        assert answer in sent,(answer,sent)
    assert 'Takareal:' not in sent;assert 'stående eller liggende terrassebord' not in sent
    assert page.locator('.assistant-answer-form').count()==0
    assert page.locator('[data-assistant-quantity]').first.input_value()=='50'
    assert page.locator('tr[data-row-index]').count()==0
    page.locator('#assistant-apply').click()
    assert page.locator('tr[data-row-index]').count()==3
    assert page.locator('#hours').inner_text()=='20 t'
    page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click()
    assert 'Terrassehøyde: 4 m' in page.locator('#job-brief').input_value()
    assert page.locator('tr[data-row-index]').count()==3
    assert not errors,errors
    print('PASS: user screenshot questions, valid dropdowns/numeric/text fields, wrong direction removed, cited sources, no automatic work changes, preserved answers/area, no repeat questions, deduplication/reload and mobile')
    browser.close()
