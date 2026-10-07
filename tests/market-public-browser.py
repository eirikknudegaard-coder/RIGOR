from portal_test_support import authorize_portal
import json
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
stamp=datetime.now(timezone.utc).isoformat()
offer={'id':'obs:fixture','chain':'obs','name':'Sløyfe 23x48 – testfixture','url':'https://www.obsbygg.no/testfixture','source_id':'fixture','kind':'battens','unit':'m','vat':'inkl','price_kind':'public','original_unit':'m','package_quantity':1,'original_ore':2500,'package_price_ex_vat_ore':2000,'normalized_ore':2000,'checked_at':stamp,'valid_until':None,'availability':'https://schema.org/InStock','evidence':'Testfixture'}
catalog={'version':1,'updated_at':stamp,'last_run':{'finished_at':stamp,'succeeded':1},'offers':[offer],'sources':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});authorize_portal(page);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));requests=[];page.on('request',lambda r:requests.append(r.url))
 page.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(catalog)))
 page.goto('http://127.0.0.1:8090/kalkyle.html');page.wait_for_function('document.getElementById("price-status").textContent.includes("1 ferske")')
 page.locator('#start-simple').click();page.locator('#project-name').fill('Markedsprisprosjekt');page.locator('#project-submit').click();page.locator('#pricing-tab').click()
 select=page.locator('[data-market-key="roof.underlay.sloyfer"]');select.select_option('obs:fixture')
 row=page.locator('tr[data-row-index]').filter(has=page.locator('td',has_text='Montere sløyfer'));assert row.locator('[data-field=material]').input_value()=='20'
 page.locator('#project-back').click();page.get_by_role('button',name='Åpne prosjekt').click();page.locator('#pricing-tab').click();assert select.input_value()=='obs:fixture'
 # A new project must not inherit another project's supplier/product choice.
 page.locator('#project-back').click();page.locator('#start-simple').click();page.locator('#project-name').fill('Nytt');page.locator('#project-submit').click();page.locator('#pricing-tab').click();assert select.input_value()==''
 page.locator('#project-back').click();page.locator('#project-search').fill('Markedsprisprosjekt');page.get_by_role('button',name='Åpne prosjekt').click();page.locator('#pricing-tab').click()
 # Refresh follows chosen product, then blocks source failures instead of retaining a usable stale price.
 catalog['offers'][0]['original_ore']=3000;catalog['offers'][0]['normalized_ore']=2400;catalog['offers'][0]['package_price_ex_vat_ore']=2400
 page.locator('#refresh-prices').click();page.wait_for_function('document.getElementById("refresh-prices").disabled===false');assert row.locator('[data-field=material]').input_value()=='24'
 catalog['offers'][0]['last_error']='HTTP 403';page.locator('#refresh-prices').click();page.wait_for_function('document.getElementById("refresh-prices").disabled===false');assert row.locator('[data-field=material]').input_value()=='';assert 'ikke tilgjengelig' in select.locator('option:checked').inner_text()
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;assert not any('api.openai.com' in u for u in requests)
 print('PASS: product choice, unit/VAT price, project isolation, automatic price refresh, source failure block, mobile and no AI')
 b.close()
