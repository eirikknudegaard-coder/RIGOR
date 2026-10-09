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
    page.wait_for_function('!document.getElementById("brief-generate").disabled')
    page.locator('#brief-generate').click()
    page.locator('[data-clarification="terrace-area"]').fill('50');page.locator('#assistant-continue').click()
    if page.locator('[data-clarification="terrace-joists"]').count():
        page.locator('[data-clarification="terrace-joists"]').select_option('Skiftes');page.locator('#assistant-continue').click()
    assert page.locator('[data-clarification="terrace-access"]').evaluate('e=>e.tagName')=='SELECT'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-clarification="terrace-access"]').select_option('Høy terrasse / krevende tilkomst');page.locator('#assistant-continue').click()
    page.locator('#assistant-preview').wait_for(state='visible')
    assert page.locator('#assistant-questions').is_hidden()
    assert 'stående eller liggende terrassebord' not in page.locator('#ai-budget').inner_text()
    assert page.locator('tr[data-row-index]').count()==0
    assert page.locator('[data-assistant-quantity]').first.input_value()=='50'
    sent=page.evaluate('window.testBriefs[0]');assert 'Terrasseareal: 50 m²' in sent and 'Høy terrasse' in sent
    page.locator('#assistant-apply').click();assert page.locator('tr[data-row-index]').count()==3
    page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click()
    assert 'Terrasseareal: 50 m²' in page.locator('#job-brief').input_value()
    assert page.locator('tr[data-row-index]').count()==3
    assert not errors,errors
    print('PASS: current sequential numeric/dropdown terrace controls, invalid direction removed, preserved answers/area, no automatic work changes, deduplication/reload and mobile')
    browser.close()
