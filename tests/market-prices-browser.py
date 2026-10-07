from portal_test_support import authorize_portal
import sys,json
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
stamp=datetime.now(timezone.utc).isoformat()
product={'id':'p','group_id':'g','chain':'obs','source_id':'fixture','name':'Fixture isolasjon','url':'https://www.obsbygg.no/testfixture','specs':{'thickness':100},'vat':'inkl','package_quantity':6,'original_unit':'pakke','enabled':True,'approved':True,'price_kind':'ordinary'}
fixture={'prices':[],'groups':[{'id':'g','name':'Fixture 100 mm','price_key':'insulation.test'}],'offers':[{'product':product,'original_ore':60000,'normalized_ore':8000,'unit':'m2','checked_at':stamp,'fresh':True,'availability':'https://schema.org/InStock','conversion':'Fixture 600 / 6'}]}
admin={'groups':fixture['groups'],'products':[product],'sources':[{'chain':'obs','permission_note':'','enabled':False,'permitted':False,'interval_hours':6}],'jobs':[],'observations':[]}
module='export async function priceApi(action,values={}){window.priceCalls=(window.priceCalls||[]).concat([{action,values}]);if(action==="catalog")return '+json.dumps(fixture)+';if(action==="admin")return '+json.dumps(admin)+';return {status:"completed",succeeded:1,failed:0};}'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();authorize_portal(page);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/market-price-client.js*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=module))
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080')+'/priser.html')
 page.locator('#price-admin').wait_for(state='visible');page.locator('#purchase-quantity').fill('100');assert '17 pakke = 102' in page.locator('#offers').inner_text();assert 'Frakt er ikke kjent' in page.locator('#offers').inner_text()
 page.get_by_role('button',name='Rediger produkt').click();assert page.locator('#product-form input[name=source_id]').input_value()=='fixture'
 page.locator('#sync').click();page.wait_for_function('document.querySelector("#sync").disabled===false');assert any(c['action']=='sync' for c in page.evaluate('window.priceCalls'))
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 print('PASS: prisvisning med fixtures, pakningskostnad, frakt, produktredigering, kontrollstatus og mobil')
 b.close()
