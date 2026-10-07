from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import json,re,csv,io

def amount(text):return float(re.sub(r'[^0-9,.-]','',text).replace(',','.'))
proposal={'summary':'Riving av terrasse med bjelkelag og rensk','items':[
    {'elementId':'terrace.strip.joists','taskIds':['step0','step1'],'scope':'requested','reason':'Bord og bjelkelag skal demonteres'},
    {'elementId':'terrace.strip.deck','taskIds':['step0','step1'],'scope':'requested','reason':'Terrassebord og festemidler'}],'questions':[]}
module='export async function assistantStatus(){return true;} export async function requestEstimate(){return window.aiProposalOverride || '+json.dumps(proposal)+';}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});authorize_portal(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/ai-estimate-client.js*',lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(json={'version':1,'sources':[],'offers':[]}))
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.locator('#job-brief').fill('Jeg skal rive terrasse med bjelkelag på en terrasse på 50 m².')
    page.locator('#start-detailed').click();page.locator('#project-name').fill('AI uten dobbeltposter');page.locator('#project-submit').click()
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
    joists=page.locator('.assistant-item[data-element-id="terrace.strip.joists"]')
    deck=page.locator('.assistant-item[data-element-id="terrace.strip.deck"]')
    assert page.locator('[data-assistant-task]:checked').count()==3
    assert deck.locator('[data-assistant-task="step0"]').is_disabled()
    assert 'Telles én gang' in deck.inner_text()
    # Deselecting the owner releases the shared task in the other package.
    joists.locator('[data-assistant-element]').uncheck()
    assert deck.locator('[data-assistant-task="step0"]').is_enabled()
    assert deck.locator('[data-assistant-task="step0"]').is_checked()
    joists.locator('[data-assistant-element]').check()
    assert deck.locator('[data-assistant-task="step0"]').is_disabled()
    page.locator('#assistant-preview').screenshot(path='/tmp/rigor-ai-overlap-preview.png')
    page.locator('#assistant-apply').click()
    rows=page.locator('tr[data-row-index]');assert rows.count()==3
    assert rows.filter(has_text='Demontere terrassebord').count()==1
    assert rows.filter(has_text='Demontere bjelkelag').count()==1
    assert rows.filter(has_text='Renske festemidler').count()==1
    assert page.locator('#hours').inner_text()=='20 t'
    assert abs(amount(page.locator('#total').inner_text())-25312.5)<.01
    assert not page.locator('#overlap-notice').is_visible()
    page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
    assert page.locator('[data-assistant-element]:checked').count()==0
    assert page.locator('#assistant-apply').is_disabled()
    # The independent application guard must hold even if stale preview
    # checkboxes incorrectly allow every proposed task.
    page.evaluate('''() => {document.querySelectorAll('#assistant-items input[type=checkbox]').forEach(input=>{input.disabled=false;input.checked=true;});document.getElementById('assistant-apply').disabled=false;}''')
    page.locator('#assistant-apply').click()
    assert rows.count()==3;assert 'Ingen dobbeltposter' in page.locator('#brief-status').inner_text()
    assert page.locator('#hours').inner_text()=='20 t'
    page.locator('#project-back').click()
    # A partially present package still offers its missing tasks.
    one={'summary':'Kun terrassebord','items':[{'elementId':'terrace.strip.deck','taskIds':['step0'],'scope':'requested','reason':'Bord skal rives'}],'questions':[]}
    page.evaluate('(proposal)=>window.aiProposalOverride=proposal',one)
    page.locator('#job-brief').fill('Jeg skal rive terrasse med bjelkelag på en terrasse på 50 m².')
    page.locator('#start-detailed').click();page.locator('#project-name').fill('Delvis arbeidsliste');page.locator('#project-submit').click()
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible');page.locator('#assistant-apply').click()
    assert rows.count()==1
    board=rows.first;board.locator('[data-field=hours]').fill('0.33');board.locator('[data-field=factor]').fill('1.2')
    page.evaluate('(proposal)=>window.aiProposalOverride=proposal',proposal)
    page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
    assert page.locator('[data-assistant-element]:checked').count()==2
    assert page.locator('[data-assistant-task="step0"]:checked').count()==0
    assert page.locator('[data-assistant-task="step1"]:checked').count()==2
    page.locator('#assistant-apply').click();assert rows.count()==3
    assert board.locator('[data-field=hours]').input_value()=='0.33'
    assert board.locator('[data-field=factor]').input_value()=='1.2'
    assert page.locator('#hours').inner_text()=='29,8 t'
    # Simulate the old screenshot's saved double board task. All values must
    # stay intact until the user confirms that these rows cover the same area.
    page.locator('#project-back').click()
    page.evaluate('''() => {const key=window.testAccountKey(),record=JSON.parse(localStorage.getItem(key)),projects=JSON.parse(record.entries['rigor-projects-v1']),project=projects.find(p=>p.name==='Delvis arbeidsliste'),board=project.snapshot.rows[0];project.snapshot.rows.push({...board,id:'legacy-duplicate',taskKey:'terrace.strip.joists.step0',elementId:'terrace.strip.joists-ai-legacy',elementName:'Riving av terrasse med bjelkelag',hours:.2,factor:1,manualTime:false,manualFactor:false,fromAssistant:true});record.entries['rigor-projects-v1']=JSON.stringify(projects);localStorage.setItem(key,JSON.stringify(record));}''')
    page.reload();page.locator('.project-card').filter(has_text='Delvis arbeidsliste').get_by_role('button',name='Åpne prosjekt',exact=True).click()
    assert rows.count()==4;assert page.locator('#hours').inner_text()=='39,8 t'
    page.locator('#simple').click();assert page.locator('#overlap-review').is_visible()
    page.locator('#overlap-review').click();assert page.locator('#overlap-apply').is_disabled()
    page.locator('#overlap-cancel').click();assert page.locator('#hours').inner_text()=='39,8 t'
    page.locator('#overlap-review').click();page.locator('[data-overlap-group]').check()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#overlap-dialog').screenshot(path='/tmp/rigor-overlap-review-mobile.png')
    page.evaluate('''() => {window.originalSetItem=Storage.prototype.setItem;const key=window.testAccountKey();Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Full storage','QuotaExceededError');return window.originalSetItem.call(this,name,value);};}''')
    page.locator('#overlap-apply').click()
    assert 'Postene er beholdt' in page.locator('#overlap-status').inner_text()
    assert page.locator('#hours').inner_text()=='39,8 t'
    assert page.locator('#overlap-dialog').is_visible()
    page.evaluate('() => {Storage.prototype.setItem=window.originalSetItem;}')
    page.locator('#overlap-apply').click();assert rows.count()==4
    assert page.locator('#hours').inner_text()=='29,8 t'
    assert not page.locator('#overlap-notice').is_visible()
    page.locator('#detailed').click()
    assert rows.first.locator('[data-field=hours]').input_value()=='0.33'
    assert rows.first.locator('[data-field=factor]').input_value()=='1.2'
    assert not rows.last.locator('input[type=checkbox]').is_checked()
    page.locator('#project-back').click();page.reload();page.locator('.project-card').filter(has_text='Delvis arbeidsliste').get_by_role('button',name='Åpne prosjekt',exact=True).click()
    assert rows.count()==4;assert not rows.last.locator('input[type=checkbox]').is_checked()
    assert page.locator('#hours').inner_text()=='29,8 t'
    page.locator('.export-basis summary').click()
    with page.expect_download() as download:page.locator('#export-sale').click()
    sale=list(csv.reader(io.StringIO(open(download.value.path(),encoding='utf-8-sig').read()),delimiter=';'))
    assert len(sale)==4
    assert abs(sum(float(row[9]) for row in sale[1:])-amount(page.locator('#total').inner_text()))<.01
    assert not errors,errors
    print('PASS: AI package overlap, selection transfer, repeat/stale apply guard, partial elements, preserved overrides, reviewed legacy duplicates, reload, correct price/CSV and mobile')
    browser.close()
