import json,subprocess
from pathlib import Path
from datetime import datetime,timezone

# Serve this repository on 127.0.0.1:8090 before running the browser test.
root=Path(__file__).resolve().parents[1]
from playwright.sync_api import sync_playwright
catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"""
import {readFileSync} from 'node:fs';
import {readByggmaxPage,readByggmaxPrices} from './market-byggmax-core.js';
import {retailerTaxEvidence,publicSources} from './market-public-core.js';
const f=JSON.parse(readFileSync('tests/fixtures/byggmax-public-evidence-20261006.json'));
const source=publicSources[1],now=new Date().toISOString(),tax=retailerTaxEvidence(f.tax,source.vat_policy_url,source,now),offers=[];
let stores=[];
for(const s of f.samples){const page=readByggmaxPage(s.html,s.url);stores=page.shops.filter(s=>['2327','2314'].includes(s.id));for(const c of s.csp.filter(c=>c.store_id!=='0'))offers.push(...readByggmaxPrices(page,c.data,c.store_id,tax,now));}
process.stdout.write(JSON.stringify({version:1,offers,stores,sources:[{chain:'byggmax',checked:4,succeeded:6}],updated_at:now,last_run:{finished_at:now}}));
"""],cwd=root))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1100})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/data/market-prices.json',lambda route:route.fulfill(json=catalog))
 page.goto('http://127.0.0.1:8090/kalkyle.html')
 page.locator('#start-simple').click()
 page.locator('#project-name').fill('Byggmax verifisering')
 page.locator('#project-submit').click()
 page.locator('#pricing-tab').click()
 page.locator('#price-mode').select_option('market')
 page.locator('#market-panel').evaluate("e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;}")
 page.locator('#byggmax-store option[value="2327"]').wait_for(state='attached')
 page.locator('#byggmax-store').select_option('2327')
 selects=page.locator('#market-products select')
 assert selects.count()>0
 selector=page.locator('#market-products select').filter(has=page.locator('option[value="byggmax:08123048:2327"]')).first
 key=selector.get_attribute('data-market-key')
 selector=page.locator('#market-products select[data-market-key="'+key+'"]')
 selector.select_option('byggmax:08123048:2327')
 assert 'Grimstad' in page.locator('#price-coverage').text_content()
 page.locator('#byggmax-store').select_option('2314')
 assert selector.input_value()=='byggmax:08123048:2314'
 assert 'Arendal' in page.locator('#price-coverage').text_content()
 page.locator('#save').click()
 saved=page.evaluate("JSON.parse(localStorage.getItem('rigor-calculation-v1'))")
 assert saved['marketStores']['byggmax']=='2314'
 assert any(v=='byggmax:08123048:2314' for v in saved['marketBindings'].values())
 page.locator('#byggmax-store').select_option('')
 assert 'Arendal' not in page.locator('#price-coverage').text_content()
 page.on('dialog',lambda d:d.accept())
 page.locator('#restore').click()
 assert page.locator('#byggmax-store').input_value()=='2314'
 assert 'Arendal' in page.locator('#price-coverage').text_content()
 # Recheck freshness at export, even if the page was left open overnight.
 page.locator('#detailed').click()
 for row in page.locator('tr[data-row-index]').all():
  if 'Montere sløyfer' not in row.locator('td').nth(1).inner_text():row.locator('input[type=checkbox]').uncheck()
 assert page.locator('#export').is_enabled()
 page.evaluate('Date.now = () => '+str(int(datetime.now(timezone.utc).timestamp()*1000)+25*3600000))
 downloads=[]
 page.on('download',lambda d:downloads.append(d))
 page.locator('#export').click()
 assert page.locator('#export').is_disabled()
 assert not downloads
 assert not errors,errors
 print('PASS: butikkvalg, eksakt SKU, omprising, lagring, sperring uten butikk, gjenåpning og utløpt pris ved eksport')
 browser.close()
