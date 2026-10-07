from portal_test_support import authorize_portal
"""Actual recorded roll evidence, legacy register units, mixed AI controls and home guide."""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
catalog = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', """
import {readFileSync} from 'node:fs';
import {readPublicProducts,retailerTaxEvidence,publicSources} from './market-public-core.js';
import {readByggmaxPage,readByggmaxPrices} from './market-byggmax-core.js';
const f=JSON.parse(readFileSync('tests/fixtures/obs-undertak-evidence-20261007.json'));
const bm=JSON.parse(readFileSync('tests/fixtures/byggmax-public-evidence-20261006.json'));
const tax=retailerTaxEvidence('Alle priser er inkludert merverdiavgift.',publicSources[0].vat_policy_url,publicSources[0],f.checked_at);
const offers=f.samples.map(s=>{
 const html='<script type="application/ld+json">'+JSON.stringify(s.product)+'</script><div data-test-id="product-price-section"><div aria-description="'+s.price_aria+'"></div></div>';
 const o=readPublicProducts(html,s.url,{...publicSources[0],tax_evidence:tax},s.checked_at)[0];
 // Reproduce the previously published unit metadata, without falsifying its source check.
 return {...o,unit:'stk',original_unit:'stk',package_quantity:1,quantity_basis:'unit',normalized_ore:o.package_price_ex_vat_ore,package_area_basis:undefined,source_price_unit:undefined};
});
const page=readByggmaxPage(bm.samples[0].html,bm.samples[0].url);
const bmTax=retailerTaxEvidence(bm.tax,publicSources[1].vat_policy_url,publicSources[1],bm.checked_at);
for(const c of bm.samples[0].csp.filter(c=>c.store_id!=='0'))offers.push(...readByggmaxPrices(page,c.data,c.store_id,bmTax,bm.checked_at));
console.log(JSON.stringify({version:1,updated_at:f.checked_at,sources:[],stores:page.shops.filter(s=>['2327','2314'].includes(s.id)),offers,last_run:{finished_at:f.checked_at}}));
"""], cwd=root))
basic = 'obs:ObsBygg-7057755641982'
questions = ['Er bygget et saltak, pulttak eller valmtak?', 'Skal kledningen monteres vertikalt eller horisontalt?', 'Hva er mønelengden?', 'Hvilken profil og dimensjon ønsker du på kledningen?', 'Beskriv eventuelle skader i eksisterende tak.']
proposal = {'summary': 'Kontroller omfanget', 'items': [{'elementId':'roof.underlay','taskIds':['underlay','battens','laths'],'scope':'requested','reason':'Oppgitt undertak'}], 'questions':questions}
module = 'export async function assistantStatus(){return true;} export async function requestEstimate(brief){window.testBriefs=window.testBriefs||[];window.testBriefs.push(brief);const p='+json.dumps(proposal)+';if(window.testBriefs.length>1)p.questions=[];return p;}'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});authorize_portal(page)
    errors=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.add_init_script('Date.now=()=>Date.parse("2026-10-07T05:40:00Z")')
    requests=[]
    def register(route):
        requests.append(route.request.url)
        route.fulfill(json=catalog)
    page.route('**/data/market-prices.json*', register)
    page.route('**/ai-estimate-client.js*', lambda route:route.fulfill(content_type='application/javascript',body=module))
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    guide=page.locator('#calculation-guide')
    assert guide.is_visible() and guide.locator('.guide-cards article').count()==3
    assert all(word in guide.inner_text() for word in ['Forenklet','Detaljert','Med AI','Kjent delsum','timepris','innlogging'])
    guide.screenshot(path='/tmp/rigor-home-guide.png')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    guide.screenshot(path='/tmp/rigor-home-guide-mobile.png')
    page.set_viewport_size({'width':1440,'height':1000})
    page.locator('#start-simple').click();page.locator('#project-name').fill('Undertak og avklaringer');page.locator('#project-submit').click()
    for option in ['removal','cover','rig','waste']:
        page.locator('#options input[value='+option+']').uncheck()
    page.locator('#basis').select_option('footprint');page.locator('#area').fill('100');page.locator('#area').press('Tab')
    task=page.locator('#simple-completion [data-completion-id="roof.underlay.underlay"]')
    task.get_by_role('button',name='Velg markedsvare',exact=True).click()
    page.locator('#material-store').select_option('2327')
    assert page.locator('#material-product option').count()==3
    page.locator('#material-product').select_option(basic)
    detail=page.locator('#material-product-detail').inner_text()
    assert all(word in detail for word in ['70,45','75 m² brutto','hele ruller','overlapp og svinn'])
    page.locator('#material-dialog').screenshot(path='/tmp/rigor-undertak-dialog.png')
    page.locator('#material-submit').click()
    snapshot=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot')
    row=next(r for r in snapshot['rows'] if r['name']=='Legge undertak')
    assert row['marketPackages']==2 and row['marketPurchasedQuantity']==150 and row['marketMaterialCost']==10568
    assert row['priceDate']==catalog['offers'][1]['checked_at'][:10]
    assert snapshot['marketStores']['byggmax']=='2327'
    # Refresh does fetch new data; a staged store change is not committed by cancellation.
    task.get_by_role('button',name='Bytt markedsvare',exact=True).click()
    page.locator('#material-store').select_option('2314')
    prior=len(requests)
    catalog['offers'][1]['last_error']='HTTP 403'
    page.locator('#material-refresh').click()
    page.wait_for_function('!document.getElementById("material-refresh").disabled')
    assert len(requests)>prior and all('?price_check=' in u for u in requests)
    assert page.locator('#material-store').input_value()=='2314'
    assert page.locator('#material-product option[value="'+basic+'"]').count()==0
    page.locator('#material-cancel').click()
    assert page.locator('#byggmax-store').input_value()=='2327'
    # If there is no documented product, open this task's supplier-price form directly.
    catalog['offers'][0]['last_error']='HTTP 403'
    task.get_by_role('button',name='Velg markedsvare',exact=True).click()
    page.locator('#material-refresh').click();page.wait_for_function('!document.getElementById("material-refresh").disabled')
    assert page.locator('#material-product').is_disabled()
    assert 'Obs BYGG-priser vises også' in page.locator('#material-dialog-note').inner_text()
    page.locator('#material-manual').click()
    form=task.locator('.completion-manual form')
    assert form.is_visible() and form.locator('[name=price]').evaluate('e=>e===document.activeElement')
    form.locator('[name=price]').fill('88');form.locator('[name=source]').fill('Kontrollert leverandørtilbud')
    form.get_by_role('button',name='Bruk innkjøpspris').click()
    assert 'Kontrollert leverandørtilbud' in task.inner_text()
    # A returned AI question list renders as selects, number and text, with no implicit row changes.
    page.locator('#job-brief').fill('Saltak, 30 grader og 100 m² målt takflate med takstein, nytt undertak, sløyfer og lekter.')
    before=page.locator('tr[data-row-index]').count()
    page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
    fields=page.locator('.assistant-answer-form [data-clarification]')
    assert fields.count()==5
    assert fields.nth(0).evaluate('e=>e.tagName')=='SELECT'
    assert fields.nth(1).evaluate('e=>e.tagName')=='SELECT'
    assert [fields.nth(i).get_attribute('type') for i in [2,3,4]]==['number','text','text']
    fields.nth(0).select_option('Saltak');fields.nth(1).select_option('Stående (vertikal)');fields.nth(2).fill('6')
    fields.nth(3).fill('Dobbelfals 19 × 148 mm');fields.nth(4).fill('Råte må vurderes ved åpning.')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('.assistant-answer-form').screenshot(path='/tmp/rigor-ai-mixed-fields-mobile.png')
    page.locator('.assistant-answer-form button').click();page.wait_for_function('window.testBriefs.length===2')
    brief=page.evaluate('window.testBriefs[1]')
    assert all(answer in brief for answer in ['Taktype: Saltak','Kledningsretning: Stående (vertikal)','Mønelengde: 6 m','Dobbelfals 19 × 148 mm','Råte må vurderes'])
    assert page.locator('tr[data-row-index]').count()==before
    assert not errors,errors
    print('PASS: real roll metadata correction, whole-roll procurement, store isolation, refresh/failure exclusion, supplier fallback, typed AI questions, preserved answers and home guide/mobile')
    browser.close()
