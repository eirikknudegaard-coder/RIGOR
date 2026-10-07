from playwright.sync_api import sync_playwright
from datetime import datetime, timezone
import json, re

def amount(text):
    return float(re.sub(r'[^0-9,.-]', '', text).replace(',', '.'))

stamp=datetime.now(timezone.utc).isoformat()
def offer(id,name,kind,unit,price,store=None,package=1):
    return dict(id=id,chain='byggmax' if store else 'obs',source_id=id,name=name,kind=kind,unit=unit,url=('https://www.byggmax.no/' if store else 'https://www.obsbygg.no/')+id,checked_at=stamp,availability='https://schema.org/InStock',vat='inkl',original_ore=round(price*package*125),normalized_ore=round(price*100),package_price_ex_vat_ore=round(price*package*100),package_quantity=package,quantity_basis='package' if package>1 else 'unit',original_unit='rull' if package>1 else unit,price_kind='local' if store else 'public',**({'store_id':store,'store_name':'Arendal' if store=='2314' else 'Grimstad'} if store else {}))
catalog=dict(version=1,updated_at=stamp,sources=[],stores=[dict(chain='byggmax',id='2314',name='Arendal'),dict(chain='byggmax',id='2327',name='Grimstad')],offers=[offer('underlay','Test Undertak 10 m²','membranes','m2',40,package=10),offer('batten','23x48 Impregnert lekt','battens','m',13.2,'2314'),offer('lath','36x48 Lekt','battens','m',18,'2314'),offer('otherstore','23x48 Impregnert lekt','battens','m',99,'2327')],last_run=dict(finished_at=stamp))
proposal={'summary':'Undertak, sløyfer og lekter','items':[{'elementId':'roof.underlay','taskIds':['underlay','battens','laths'],'scope':'requested','reason':'Oppgitt arbeid'}],'questions':[]}
module='export async function assistantStatus(){return true;} export async function requestEstimate(){return '+json.dumps(proposal)+';}'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/ai-estimate-client.js',lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(content_type='application/json',body=json.dumps(catalog)))
    page.goto('http://127.0.0.1:8090/kalkyle.html');page.wait_for_function('!document.getElementById("brief-generate").disabled')
    page.locator('#job-brief').fill('Saltak med 45 grader og 30 m² takflate. Ta med takstein, undertak, sløyfer og lekter.')
    page.locator('#start-detailed').click();page.locator('#project-name').fill('AI priser');page.locator('#project-submit').click()
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#save-rate-defaults').click()
    assert page.locator('#wage-help').is_visible();assert '1 265,63' in page.locator('#hourly').inner_text().replace('\xa0',' ')
    page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible');page.locator('#assistant-apply').click()
    row=page.locator('tr[data-row-index]')
    assert row.count()==3
    assert [r.locator('[data-field=hours]').input_value() for r in row.all()]==['0.25','0.12','0.13']
    assert all(r.locator('[data-field=factor]').input_value()=='1.25' for r in row.all())
    assert abs(amount(page.locator('#labor-total').inner_text())-23730.46875)<.01
    assert page.locator('#estimate-kind').inner_text()=='KJENT DELSUM'
    assert abs(amount(page.locator('#total').inner_text())-23730.46875)<.01
    assert 'Materialpris mangler' in row.nth(0).inner_text()
    assert 'kr/m ekskl. MVA' in row.nth(1).inner_text()
    assert 'roof.underlay' not in row.nth(0).inner_text()
    # Cancelling a store selection must not alter the project's price basis.
    before_store=page.evaluate('JSON.parse(localStorage.getItem("rigor-projects-v1"))[0].snapshot.marketStores')
    row.nth(1).get_by_role('button',name='Velg markedsvare til Montere sløyfer').click();page.locator('#material-store').select_option('2327');page.locator('#material-cancel').click()
    assert page.evaluate('JSON.parse(localStorage.getItem("rigor-projects-v1"))[0].snapshot.marketStores')==before_store
    for i,product in enumerate(['underlay','batten','lath']):
        row.nth(i).locator('.row-market-button').click()
        if i>0: page.locator('#material-store').select_option('2314')
        page.locator('#material-product').select_option(product);page.locator('#material-submit').click()
    assert [r.locator('[data-field=material]').input_value() for r in row.all()]==['40','13.2','18']
    assert abs(amount(page.locator('#total').inner_text())-27258.46875)<.01
    assert 'Per m² arbeid: 22,00' in row.nth(1).inner_text().replace('\xa0',' ')
    assert '23x48 Impregnert lekt' in row.nth(1).inner_text()
    assert 'Kjøp 3 rull' in row.nth(0).inner_text()
    # Changes to the defined time price must immediately reach the quote.
    page.locator('#rates-tab').click();page.locator('#wage').fill('600')
    assert abs(amount(page.locator('#total').inner_text())-(23730.46875*1.2+3528))<.01
    page.locator('#wage').fill('500');page.locator('#time-import summary').click()
    csv='oppgavenokkel;enhet;timer_per_enhet;tidsfaktor;kilde\nroof.underlay.underlay;m2;0,1;1,15;Egen tidsnorm\nroof.underlay.battens;m2;0,2;;Egen tidsnorm\nroof.underlay.laths;m2;0,3;;Egen tidsnorm'
    page.locator('#time-file').set_input_files({'name':'normer.csv','mimeType':'text/csv','buffer':csv.encode()})
    page.wait_for_function('document.getElementById("time-status").textContent.includes("3 oppgaver")')
    page.locator('#detailed').click();assert row.nth(0).locator('[data-field=factor]').input_value()=='1.15'
    assert 'Egen tidsnorm' in row.nth(0).inner_text();assert abs(amount(page.locator('#total').inner_text())-(22.2*1265.625+3528))<.01
    row.nth(0).locator('[data-field=hours]').fill('0.4');row.nth(0).locator('[data-field=factor]').fill('1.8')
    page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt').click()
    assert row.nth(0).locator('[data-field=hours]').input_value()=='0.4';assert row.nth(0).locator('[data-field=factor]').input_value()=='1.8'
    assert row.nth(1).locator('[data-field=material]').input_value()=='13.2'
    page.locator('#project-back').click();page.locator('#start-detailed').click();page.locator('#project-name').fill('Standard');page.locator('#project-submit').click();page.locator('#rates-tab').click();assert page.locator('#wage').input_value()=='500'
    page.locator('#wage').fill('700');page.locator('#project-back').click();page.locator('#project-search').fill('AI priser');page.get_by_role('button',name='Åpne prosjekt').click();page.locator('#rates-tab').click();assert page.locator('#wage').input_value()=='500'
    page.locator('#detailed').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.task-table').evaluate('(element)=>{element.scrollLeft=element.scrollWidth}')
    assert row.nth(0).locator('td').nth(1).evaluate('(element)=>element.getBoundingClientRect().left>=0')
    page.locator('#library-browser').evaluate('(element)=>{element.open=false}')
    page.screenshot(path='/tmp/rigor-ai-costs-mobile.png',full_page=True)
    page.set_viewport_size({'width':1440,'height':1000});page.locator('.task-table').evaluate('(element)=>{element.scrollLeft=0}');page.locator('#details').screenshot(path='/tmp/rigor-ai-costs-desktop.png')
    assert page.locator('.task-table th').evaluate_all('(headers)=>headers.every(header=>header.scrollWidth<=header.clientWidth)')
    assert not errors,errors
    print('PASS: AI times, pitch, configured hourly price, partial totals, market products/units/stores, packaging, CSV norms, overrides, reload, defaults, project separation and mobile')
    browser.close()
