"""Real captured board/screw prices, UI, save/reload, CSV and actual PDFs.

Auth and AI transport are mocked; no billed provider request. The provider
deliberately omits screws, so this exercises deterministic dependencies.
"""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re,os,csv,io,fitz

root=Path(__file__).parent
catalog=json.loads((root/'fixtures/evidence/benchmark-catalog.json').read_text())
screw=json.loads((root/'fixtures/evidence/deck-screws-2026-10-09.json').read_text())['observation']
catalog['offers'].append(screw)
fixture=json.loads((root/'fixtures/evidence/benchmark-projects.json').read_text())
project=fixture['cases'][0]
base=os.getenv('RIGOR_TEST_BASE_URL','http://127.0.0.1:8090')
output=Path(os.getenv('RIGOR_QA_OUTPUT','/tmp/rigor-accessories-browser'));output.mkdir(exist_ok=True)
live=os.getenv('RIGOR_TEST_LIVE_REGISTER')=='1'
def amount(text):return float(re.sub(r'[^0-9,.-]','',text).replace(',','.'))
def saved(page):return page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0]')
def row(page,key):
    index=next(i for i,r in enumerate(saved(page)['snapshot']['rows'])if r.get('priceKey')==key)
    return page.locator('tr[data-row-index]').nth(index)
def choose(page,key,product):
    target=row(page,key)
    reference=target.get_by_role('button',name='Se prisgrunnlag',exact=True)
    if reference.count():
        reference.click();page.locator('#reference-dialog').get_by_role('button',name='Velg konkret produkt',exact=True).click()
    else:target.locator('.row-market-button').click()
    page.locator('#material-product').select_option(product)
    page.locator('#material-submit').click();assert page.locator('#material-dialog').is_hidden()
proposal={'summary':'Bytte terrassebord','questions':[],'items':[{'elementId':e,'taskIds':tasks,'scope':'requested','reason':'Oppgitt omfang'}for e,tasks in project['scope']]}
module='export async function assistantStatus(){return true;} export async function requestEstimate(){return '+json.dumps(proposal)+';}'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for name,width,height in [('desktop',1440,1000),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height},accept_downloads=True);authorize_portal(page)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/ai-estimate-client.js*',lambda r:r.fulfill(content_type='application/javascript',body=module))
        if not live:page.route('**/data/market-prices.json*',lambda r:r.fulfill(json=catalog))
        page.goto(base+'/kalkyle.html');page.locator('#start-detailed').click();page.locator('#project-name').fill('Terrasse med festemidler');page.locator('#project-customer').fill('Kunde');page.locator('#project-submit').click()
        page.locator('#rates-tab').click()
        for k,v in fixture['rates'].items():page.locator('#'+k).fill(str(v))
        page.locator('#pricing-tab').click()
        times='oppgavenokkel;enhet;timer_per_enhet;tidsfaktor;kilde\nterrace.new.deck.deck;m2;0,35;1;Oppgitt planleggingstid for testen\nroof.waste.waste;m2;0,05;1;Oppgitt tidsfaktor for terrasseavfall\n'
        page.locator('#time-file').set_input_files({'name':'times.csv','mimeType':'text/csv','buffer':times.encode()})
        page.locator('#job-brief').fill(project['brief']);page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
        assert 'Tilbehør som avklares i kalkylen: Terrasseskruer' in page.locator('#assistant-items').inner_text()
        page.locator('#assistant-apply').click();page.locator('#save').click()
        rows=saved(page)['snapshot']['rows'];accessories=[r for r in rows if r.get('materialOnly')]
        assert len(accessories)==1 and len(rows)==5
        key=accessories[0]['priceKey'];parent='terrace.new.deck'
        assert amount(page.locator('#hours').inner_text())==32.5
        assert 'Terrasseskruer' in page.locator('#material-list').inner_text()
        assert page.locator('#export').is_disabled()
        choose(page,parent,project['choices'][parent])
        row(page,'roof.waste').locator('[data-field=material]').fill('25');page.locator('#save').click()
        choose(page,key,screw['id'])
        assert page.locator('#export').is_disabled(),'A product choice cannot invent its required quantity'
        page.locator('#simple').click()
        page.get_by_label('Mengdegrunnlag Terrasseskruer',exact=True).select_option('deck_28x120_cc600')
        snap=saved(page)['snapshot'];fast=next(r for r in snap['rows']if r.get('materialOnly'))
        assert fast['materialQuantity']==1350 and fast['marketPackages']==2
        assert fast['marketPurchasedQuantity']==2000 and fast['marketMaterialCost']==478.4
        assert fast['hours']==0 and not fast['requiresMaterialQuantity']
        assert amount(page.locator('#hours').inner_text())==32.5
        expected=50575.78125+478.4*1.2
        assert abs(amount(page.locator('#total').inner_text())-expected)<.01
        assert screw['name'] in page.locator('#material-list').inner_text()
        assert '1 350 stk' in ' '.join(page.locator('#material-list').inner_text().split())
        assert '2 pakke' in page.locator('#material-list').inner_text()
        for kind in ['offer','calculation']:
            page.locator('#project-pdf').click();page.locator('#pdf-company').fill('Kontrollbygg AS');page.locator('#pdf-type').select_option(kind)
            page.locator('#pdf-download').scroll_into_view_if_needed();assert page.locator('#pdf-download').is_enabled(),page.locator('#pdf-validation').inner_text()
            path=output/(name+'-'+kind+'.pdf')
            with page.expect_download() as download:page.locator('#pdf-download').click()
            download.value.save_as(path);page.wait_for_function('!document.getElementById("pdf-download").disabled')
            text=' '.join(' '.join(p.get_text()for p in fitz.open(path)).split())
            assert screw['name'] in text and '1 350 stk' in text and '2 000 stk' in text
            assert '51 149,86' in text
            if kind=='calculation':assert '32,5' in text
            if kind=='offer':assert '239,20' not in text and 'Innkjøpskost' not in text
            page.locator('#pdf-cancel').click()
        page.screenshot(path=str(output/(name+'-with-screws.png')),full_page=True)
        page.locator('#detailed').click();page.locator('.export-basis summary').click()
        with page.expect_download() as download:page.locator('#export-purchase').click()
        path=output/(name+'-purchase.csv');download.value.save_as(path)
        data=list(csv.reader(io.StringIO(path.read_text(encoding='utf-8-sig')),delimiter=';'))
        line=next(r for r in data if screw['name'] in r)
        assert line[6]==screw['source_id'] and line[9]=='1350' and line[11]=='2000' and line[12]=='2' and float(line[15])==478.4
        page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();page.locator('#simple').click()
        assert page.get_by_label('Mengdegrunnlag Terrasseskruer',exact=True).input_value()=='deck_28x120_cc600'
        assert saved(page)['snapshot']['marketBindings'][key]==screw['id']
        page.locator('.completion-group').filter(has=page.get_by_label('Avklar tilbehørsmengde Terrasseskruer',exact=True)).locator('summary').first.click()
        page.get_by_label('Avklar tilbehørsmengde Terrasseskruer',exact=True).fill('2001');page.get_by_label('Avklar tilbehørsmengde Terrasseskruer',exact=True).press('Tab')
        fast=next(r for r in saved(page)['snapshot']['rows']if r.get('materialOnly'))
        assert fast['marketPackages']==3 and fast['marketMaterialCost']==717.6
        page.locator('#detailed').click();row(page,parent).locator('input[type=checkbox]').uncheck();page.locator('#save').click()
        assert not next(r for r in saved(page)['snapshot']['rows']if r.get('materialOnly'))['enabled']
        row(page,parent).locator('input[type=checkbox]').check();page.locator('#save').click()
        assert next(r for r in saved(page)['snapshot']['rows']if r.get('materialOnly'))['enabled']
        page.locator('#simple').click();page.locator('.completion-group').filter(has=page.get_by_label('Avklar tilbehørsmengde Terrasseskruer',exact=True)).locator('summary').first.click();page.get_by_role('button',name='Tilbehøret inngår ikke / finnes fra før',exact=True).click()
        assert 'Terrasseskruer' not in page.locator('#material-list').inner_text()
        assert abs(amount(page.locator('#total').inner_text())-50575.78125)<.01
        page.screenshot(path=str(output/(name+'.png')),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        results.append({'view':name,'register': 'published'if live else 'captured','screwsNeeded':1350,'boxes':2,'purchaseCostExVat':478.4,'priceExVat':round(expected,2),'hours':32.5,'pdf':[name+'-offer.pdf',name+'-calculation.pdf'],'passed':True})
        print('PASS',name,'1350 screws / 2 boxes / 478.40 kr / 32.5 hours / PDF and CSV',flush=True)
        page.close()
    browser.close()
(output/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
