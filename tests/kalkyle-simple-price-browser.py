from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from datetime import datetime, timezone
import csv, io, json, re

def amount(text):
    return float(re.sub(r'[^0-9,.-]', '', text).replace(',', '.'))

stamp=datetime.now(timezone.utc).isoformat()
def offer(id,name,kind,unit,price,package=1):
    return dict(id=id,chain='obs',source_id='SKU-'+id,name=name,kind=kind,unit=unit,url='https://www.obsbygg.no/'+id,checked_at=stamp,availability='https://schema.org/InStock',vat='inkl',original_ore=round(price*package*125),normalized_ore=round(price*100),package_price_ex_vat_ore=round(price*package*100),package_quantity=package,quantity_basis='package' if package>1 else 'unit',original_unit='rull' if package>1 else unit,price_kind='public')
catalog=dict(version=1,updated_at=stamp,sources=[],stores=[],offers=[offer('undertak','Test Undertak 10 m²','membranes','m2',40,10),offer('sloyfer','23x48 Impregnert lekt','battens','m',13.2),offer('lekter','36x48 Lekt','battens','m',18)],last_run=dict(finished_at=stamp))
proposal={'summary':'Kontroll av underlag og avslutninger','items':[{'elementId':'roof.underlay','taskIds':['underlay','battens','laths'],'scope':'requested','reason':'Finnes allerede'},{'elementId':'roof.edge','taskIds':['edge'],'scope':'related','reason':'Avklar faktisk kantlengde'}],'questions':[]}
module='export async function assistantStatus(){return true;} export async function requestEstimate(brief){window.testBrief=brief;window.testAICalls=(window.testAICalls||0)+1;return '+json.dumps(proposal)+';}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});authorize_portal(page);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/ai-estimate-client.js*',lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(content_type='application/json',body=json.dumps(catalog)))
    page.on('dialog',lambda d:d.accept())
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.locator('#start-simple').click();page.locator('#project-name').fill('Forenklet pris');page.locator('#project-submit').click()
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#simple').click()
    for option in ['removal','cover','rig','waste']:
        page.locator('#options input[value='+option+']').uncheck()
    page.locator('#basis').select_option('footprint');page.locator('#area').fill('30');page.locator('#area').press('Tab')
    selected=page.locator('#simple-completion .completion-task')
    assert selected.count()==3
    assert page.locator('#estimate-kind').inner_text()=='KJENT DELSUM'
    labor=amount(page.locator('#total').inner_text());assert labor>0
    assert page.locator('#export').is_disabled()
    page.locator('.export-basis summary').click()
    assert page.locator('#export-work').is_enabled();assert page.locator('#export-purchase').is_disabled();assert page.locator('#export-sale').is_disabled()
    # Select documented market products directly from the simplified view.
    for index,product in enumerate(['undertak','sloyfer','lekter']):
        selected.nth(index).get_by_role('button',name='Velg markedsvare',exact=True).click()
        page.locator('#material-product').select_option(product);page.locator('#material-submit').click()
    total=amount(page.locator('#total').inner_text());assert total>labor
    assert page.locator('#estimate-kind').inner_text()=='DITT PRISANSLAG'
    assert page.locator('#export').is_enabled();assert page.locator('#export-purchase').is_enabled();assert page.locator('#export-sale').is_enabled()
    # A documented manual price is available in the same view and persists.
    group=page.locator('#simple-completion .completion-group').first
    group.locator('summary').first.click()
    selected.nth(0).locator('.completion-manual summary').click()
    form=selected.nth(0).locator('form');form.locator('[name=price]').fill('55');form.locator('[name=source]').fill('Byggevarehus tilbud')
    form.get_by_role('button',name='Bruk innkjøpspris').click()
    area=30/(3**.5/2)
    expected=area*.5*1.1*1265.625+area*(55+13.2/.6+18/.5)*1.2
    assert abs(amount(page.locator('#total').inner_text())-expected)<.01
    group.locator('summary').first.click()
    assert 'Byggevarehus tilbud' in page.locator('#simple-completion').inner_text()
    # Codes can be mapped without renumbering the original element.
    page.locator('#detailed').click();first=page.locator('tr[data-row-index]').filter(has_text='Legge undertak').first
    code=first.locator('.post-code').inner_text();assert code.startswith('RG-A-')
    first.locator('.code-button').click();assert page.locator('#code-salary').input_value()==''
    page.locator('#code-work').fill('TAK-ARBEID');page.locator('#code-purchase').fill('UNDERTAK');page.locator('#code-sale').fill('TAK-SALG')
    page.locator('#codes-form').get_by_role('button',name='Lagre kodekobling').click()
    assert first.locator('.post-code').inner_text()=='TAK-ARBEID'
    # Exports separate plans, procurement and customer sales, and reconcile exactly.
    exported={}
    for kind in ['work','purchase','sale']:
        with page.expect_download() as download: page.locator('#export-'+kind).click()
        exported[kind]=list(csv.reader(io.StringIO(open(download.value.path(),encoding='utf-8-sig').read()),delimiter=';'))
    assert exported['work'][1][3]=='TAK-ARBEID';assert exported['work'][1][4]==''
    assert 'faktisk timeregistrering' in exported['work'][1][-1]
    assert exported['purchase'][1][3]=='UNDERTAK';assert exported['purchase'][1][6]==''
    assert exported['purchase'][2][6]=='SKU-sloyfer'
    assert abs(sum(float(r[9]) for r in exported['sale'][1:])-amount(page.locator('#total').inner_text()))<.01
    page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt').click()
    assert first.locator('.post-code').inner_text()=='TAK-ARBEID'
    assert 'Byggevarehus tilbud' in first.inner_text()
    assert abs(amount(page.locator('#total').inner_text())-expected)<.01
    # The AI check uses actual wizard data, converts footprint once, and avoids duplicates.
    page.locator('#simple').click();page.locator('#job-brief').fill('Tidligere var det saltak med 45 grader og 20 m² takflate.')
    assert page.evaluate('window.testAICalls||0')==0
    page.locator('#wizard-ai-review').click();page.locator('#assistant-preview').wait_for(state='visible')
    assert page.evaluate('window.testAICalls')==1
    assert 'Takareal: 30 m²' in page.evaluate('window.testBrief')
    assert 'Takvinkel: 30 grader' in page.evaluate('window.testBrief')
    existing=page.locator('#assistant-items [data-element-id="roof.underlay"]')
    assert not existing.locator('[data-assistant-element]').is_checked()
    assert abs(float(existing.locator('[data-assistant-quantity]').input_value())-30/(3**.5/2))<1e-8
    assert page.locator('#assistant-items [data-element-id="roof.edge"] [data-assistant-quantity]').input_value()==''
    before_count=page.locator('tr[data-row-index]').count()
    page.locator('#assistant-apply').click();assert page.locator('#wizard').is_visible()
    assert page.locator('tr[data-row-index]').count()==before_count+1
    assert page.locator('#estimate-kind').inner_text()=='KJENT DELSUM'
    task=page.locator('#simple-completion [data-completion-id^="roof.edge."]')
    task.get_by_label('Avklar mengde Montere kant- og takfotbeslag').fill('12');task.get_by_label('Avklar mengde Montere kant- og takfotbeslag').press('Tab')
    task.locator('.completion-manual summary').click();form=task.locator('form');form.locator('[name=price]').fill('100');form.locator('[name=source]').fill('Beslagleverandør');form.get_by_role('button',name='Bruk innkjøpspris').click()
    assert page.locator('#estimate-kind').inner_text()=='DITT PRISANSLAG'
    assert page.locator('#export').is_enabled()
    # Drawer stays open for several selections and supports Escape and narrow screens.
    page.locator('#detailed').click();page.locator('#library-browser summary').click();page.locator('#library-dialog').wait_for(state='visible')
    assert page.locator('.library-card').count()>=140
    page.locator('#library-search').fill('undertak');assert page.locator('.library-card').count()>1
    page.locator('#library-close').focus();page.keyboard.press('Escape');page.locator('#library-dialog').wait_for(state='hidden')
    page.set_viewport_size({'width':390,'height':844});page.locator('#simple').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#wizard').screenshot(path='/tmp/rigor-simple-price-mobile.png')
    page.set_viewport_size({'width':1440,'height':1000});page.locator('#simple-completion').screenshot(path='/tmp/rigor-simple-prices.png')
    page.locator('#detailed').click();page.locator('#library-browser summary').click();page.locator('#library-dialog').screenshot(path='/tmp/rigor-library-drawer.png')
    assert not errors,errors
    print('PASS: simplified partial/complete estimates, market and manual sources, rates, stable mappings, independent exports and exact reconciliation, reload, AI scope/data, unknown lengths, drawer and mobile')
    browser.close()
