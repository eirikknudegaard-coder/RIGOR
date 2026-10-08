"""Real app flows with explicitly synthetic supplier observations, no live price writes."""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from datetime import datetime, timezone, timedelta
import json, csv, io, re

stamp=(datetime.now(timezone.utc)-timedelta(minutes=2)).isoformat()
def offer(id,price,chain='obs',name='28x120 Impregnert terrassebord'):
 return dict(id=chain+':'+id,source_id=id,chain=chain,name=name,kind='decking',unit='m',url=('https://www.obsbygg.no/' if chain=='obs' else 'https://www.byggmax.no/')+id,checked_at=stamp,availability='https://schema.org/InStock',vat='inkl',original_ore=round(price*125),normalized_ore=round(price*100),package_price_ex_vat_ore=round(price*100),package_quantity=1,quantity_basis='unit',original_unit='m',price_kind='public',evidence='Synthetic test fixture, not a market observation')
catalog=dict(version=1,updated_at=stamp,last_run=dict(finished_at=stamp),sources=[],stores=[],offers=[offer('a',28.4),offer('b',31.8),offer('c',35.9),offer('d',32,'byggmax'),offer('e',30,'byggmax'),offer('wrong',1,name='34x145 impregnert terrassebord')])
template=dict(id='local.reference',name='Terrassebord 28x120',category='45 · Terrasser',trade='Tømrer',type='Alle',unit='m²',tasks=[dict(id='deck',name='Montere 28x120 impregnert terrassebord',hours=.5,materialRatio=8.4,materialUnit='m',priceKey='test.deck',exampleMaterial=0)])
def read_rows(page): return page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.rows')
def amount(value): return float(re.sub(r'[^0-9,.-]','',value).replace(',','.'))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1100});authorize_portal(page)
 page.add_init_script('if(!localStorage.getItem("rigor-user:verified-test-user:storage-v1"))localStorage.setItem("rigor-user:verified-test-user:storage-v1",'+json.dumps(json.dumps(dict(version=1,entries={'rigor-library-v1':json.dumps([template])})))+');')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(catalog)))
 page.route('**/functions/v1/rigor-ai-estimate',lambda r:r.fulfill(content_type='application/json',body='{"ready":false}'))
 page.goto('http://127.0.0.1:8090/kalkyle.html');page.wait_for_function('document.getElementById("price-status").textContent.includes("ferske")')
 page.locator('#start-detailed').click();page.locator('#project-name').fill('Detaljert markedsreferanse');page.locator('#project-submit').click()
 page.locator('#library-browser summary').click();page.locator('#library-source').select_option('local');page.locator('#library-search').fill('28x120');card=page.locator('.library-card');card.locator('summary').click();card.locator('input[type=number]').fill('10');card.get_by_role('button',name='Legg til valgte oppgaver',exact=True).click();page.locator('#library-close').click()
 row=page.locator('tr[data-row-index]').first
 # Automatic reference: no store or concrete product was selected.
 assert row.locator('[data-field=material]').input_value()=='31.8'
 assert '5 produkter / 2 leverandører' in row.inner_text() and 'Høy' in row.inner_text()
 assert '28,4' in row.inner_text() and '35,9' in row.inner_text()
 assert page.locator('#byggmax-store').input_value()==''
 page.locator('#save').click();saved=read_rows(page)[0];assert saved['priceBasis']=='market_reference';assert saved['priceSnapshot']['price']==31.8
 assert abs(amount(page.locator('#material-total').inner_text())-84*31.8*1.2)<.01
 # Existing export shapes use the ordinary material value, with no invented SKU.
 page.locator('#export-purchase').locator('xpath=..').locator('summary').click()
 with page.expect_download() as d: page.locator('#export-purchase').click()
 data=list(csv.reader(io.StringIO(open(d.value.path(),encoding='utf-8-sig').read()),delimiter=';'))
 assert data[1][6]=='' and float(data[1][14])==31.8
 first_total=page.locator('#total').inner_text()
 # Register changes and refresh do not change a saved calculation.
 newer=(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat();catalog['updated_at']=newer
 for o in catalog['offers']:o['checked_at']=newer;o['original_ore']*=2;o['normalized_ore']*=2;o['package_price_ex_vat_ore']*=2
 page.locator('#pricing-tab').click();page.locator('#refresh-prices').click();page.wait_for_function('!document.getElementById("refresh-prices").disabled');page.locator('#detailed').click()
 assert row.locator('[data-field=material]').input_value()=='31.8' and page.locator('#total').inner_text()==first_total
 assert 'Nyere markedspriser' in row.inner_text()
 page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();assert row.locator('[data-field=material]').input_value()=='31.8'
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog=page.locator('#reference-dialog');assert 'Lagret prisøyeblikk' in dialog.inner_text() and 'Dagens prisgrunnlag' in dialog.inner_text()
 assert dialog.locator('.reference-sources').count()==2
 dialog.screenshot(path='/tmp/rigor-market-reference-desktop.png')
 dialog.get_by_role('button',name='Oppdater prisgrunnlag',exact=True).click();assert row.locator('[data-field=material]').input_value()=='63.6';assert read_rows(page)[0]['priceSnapshot']['price']==63.6
 # Manual overrides survive an import, source refresh and reopening.
 row.locator('[data-field=material]').fill('47');page.locator('#save').click()
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog.get_by_role('button',name='Oppdater prisgrunnlag',exact=True).click();assert row.locator('[data-field=material]').input_value()=='47'
 page.locator('#pricing-tab').click()
 csv_text='prisnokkel;enhet;pris;kilde;dato;valuta;mva\ntest.deck;m;25;Avtale test;'+datetime.now(timezone.utc).date().isoformat()+';NOK;ekskl\n'
 page.locator('#price-file').set_input_files({'name':'prices.csv','mimeType':'text/csv','buffer':csv_text.encode()});page.locator('#detailed').click();assert row.locator('[data-field=material]').input_value()=='47';assert 'Manuell prosjektpris' in row.inner_text()
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog.get_by_role('button',name='Bruk importert leverandørpris',exact=True).click();assert row.locator('[data-field=material]').input_value()=='25';assert 'Importert avtalepris' in row.inner_text()
 # Concrete choice remains available and uses its own price despite imported mode.
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog.get_by_role('button',name='Velg konkret produkt',exact=True).click();page.locator('#material-product').select_option('obs:a');page.locator('#material-submit').click();assert row.locator('[data-field=material]').input_value()=='56.8'
 # Explicit return to a reference removes the SKU binding; normal auto-import
 # priority is bypassed only by this deliberate per-row choice.
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog.get_by_role('button',name='Bruk markedsreferanse',exact=True).click();assert row.locator('[data-field=material]').input_value()=='63.6'
 assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.marketBindings')=={}
 page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();assert row.locator('[data-field=material]').input_value()=='63.6'
 page.set_viewport_size({'width':390,'height':844});row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth');dialog.screenshot(path='/tmp/rigor-market-reference-mobile.png');dialog.get_by_role('button',name='Lukk',exact=True).click()
 # A changed unit requires an explicit physical quantity, not implicit area-to-length.
 row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();dialog.locator('.reference-spec-editor summary').click();dialog.locator('#reference-unit').select_option('m2');assert dialog.locator('#reference-quantity').input_value()=='';assert dialog.get_by_role('button',name='Bruk markedsreferanse',exact=True).is_disabled();dialog.get_by_role('button',name='Lukk',exact=True).click()
 assert not errors,errors
 print('PASS: automatic detailed median, supplier confidence, unit price, export reconciliation, immutable snapshot, explicit update, manual/import/SKU priority, reload, quantity guard and mobile')
 browser.close()
