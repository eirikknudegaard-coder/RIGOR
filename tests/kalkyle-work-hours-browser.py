from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import json,re,csv,io

def amount(text):return float(re.sub(r'[^0-9,.-]','',text).replace(',','.'))
proposal={'summary':'Riving av terrassebord','items':[{'elementId':'terrace.strip.deck','taskIds':['step0','step1'],'scope':'requested','reason':'Oppgitt terrasseflate'}],'questions':[]}
module='export async function assistantStatus(){return true;} export async function requestEstimate(){return '+json.dumps(proposal)+';}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});authorize_portal(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/ai-estimate-client.js*',lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(json={'version':1,'sources':[],'offers':[]}))
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.locator('#job-brief').fill('Jeg skal rive terrassebord på en terrasse på 50 m².')
    page.locator('#start-detailed').click();page.locator('#project-name').fill('Terrasse med arbeidstimer');page.locator('#project-submit').click()
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#brief-generate').click()
    page.locator('#assistant-preview').wait_for(state='visible');page.locator('#assistant-apply').click()
    rows=page.locator('tr[data-row-index]');assert rows.count()==2
    assert [r.locator('[data-field=hours]').input_value() for r in rows.all()]==['0.2','0.05']
    assert '10 beregnede timer' in rows.nth(0).inner_text(),rows.nth(0).inner_text()
    assert '2,5 beregnede timer' in rows.nth(1).inner_text(),rows.nth(1).inner_text()
    assert 'Beregnet arbeid: 12,5 timer' in page.locator('.element-row').inner_text()
    assert 'RIGOR-planleggingsanslag' in rows.nth(0).inner_text()
    assert abs(amount(page.locator('#total').inner_text())-15820.3125)<.01
    assert page.locator('#hours').inner_text()=='12,5 t';assert page.locator('#export-sale').is_enabled()
    # Simulate a pre-fix saved AI/library snapshot with missing times, retaining
    # the real account storage, rates and user-selected work.
    page.locator('#project-back').click()
    page.evaluate('''() => {const key=window.testAccountKey(),record=JSON.parse(localStorage.getItem(key)),projects=JSON.parse(record.entries['rigor-projects-v1']);projects[0].snapshot.rows.forEach((r,i)=>{r.hours=0;r.requiresTime=true;r.timeSource='';r.fromAssistant=i===0;});record.entries['rigor-projects-v1']=JSON.stringify(projects);localStorage.setItem(key,JSON.stringify(record));}''')
    page.reload();page.get_by_role('button',name='Åpne prosjekt').click()
    assert [r.locator('[data-field=hours]').input_value() for r in rows.all()]==['0.2','0.05']
    assert abs(amount(page.locator('#labor-total').inner_text())-15820.3125)<.01
    page.locator('#rates-tab').click();page.locator('#wage').fill('600')
    assert abs(amount(page.locator('#total').inner_text())-18984.375)<.01
    page.locator('#detailed').click();rows.nth(0).locator('[data-field=hours]').fill('0.3');rows.nth(0).locator('[data-field=factor]').fill('1.2')
    assert '18 beregnede timer' in rows.nth(0).inner_text()
    page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt').click()
    assert rows.nth(0).locator('[data-field=hours]').input_value()=='0.3';assert rows.nth(0).locator('[data-field=factor]').input_value()=='1.2'
    assert 'Registrert i prosjektet' in rows.nth(0).inner_text()
    # The screenshot selects two packages containing the same decking task.
    page.locator('#library-browser summary').click();page.locator('#library-search').fill('Riving av terrasse med bjelkelag')
    card=page.locator('.library-card').first;card.locator('summary').click();card.locator('input[type=number]').fill('50');card.get_by_role('button',name='Legg til valgte oppgaver').click();page.locator('#library-close').click()
    assert 'unngå dobbel arbeidstid' in page.locator('#time-overlap').inner_text()
    rows.nth(0).locator('input[type=checkbox]').uncheck();assert page.locator('#time-overlap').inner_text()==''
    assert page.locator('#hours').inner_text()=='20 t';assert abs(amount(page.locator('#total').inner_text())-30375)<.01
    page.locator('.export-basis summary').click()
    with page.expect_download() as download:page.locator('#export-sale').click()
    sale=list(csv.reader(io.StringIO(open(download.value.path(),encoding='utf-8-sig').read()),delimiter=';'))
    assert abs(sum(float(row[9]) for row in sale[1:])-30375)<.01
    page.locator('#simple').click()
    for group in page.locator('.completion-group').all():
        if group.get_attribute('open') is None:group.locator('summary').first.click()
    assert 'Arbeidspris:' in page.locator('#simple-completion').inner_text()
    assert 'beregnede timer' in page.locator('#simple-completion').inner_text()
    task=page.locator('.completion-task').filter(has_text='Renske festemidler').first
    task.locator('.completion-time summary').click();task.get_by_label('Avklar grunntid Renske festemidler',exact=True).fill('0.1');task.get_by_label('Avklar grunntid Renske festemidler',exact=True).press('Tab')
    assert page.locator('#hours').inner_text()=='22,5 t';assert abs(amount(page.locator('#total').inner_text())-34171.875)<.01
    page.locator('#detailed').click();page.locator('.time-basis summary').click()
    assert 'medgått tid' in page.locator('.time-basis').inner_text()
    page.locator('#details').screenshot(path='/tmp/rigor-work-hours-desktop.png')
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/rigor-work-hours-mobile.png',full_page=True)
    assert not errors,errors
    print('PASS: AI/library deck person-hours, exact configured labor price, repair saved missing norms, manual overrides/reload, duplicate work warning, exports, simplified adjustment, source explanation and mobile')
    browser.close()
