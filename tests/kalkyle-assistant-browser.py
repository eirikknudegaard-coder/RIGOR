from playwright.sync_api import sync_playwright
import json
proposal={'summary':'Saltak med undertak','items':[{'elementId':'roof.underlay','taskIds':['underlay','battens','laths'],'scope':'requested','reason':'Undertak, sløyfer og lekter'},{'elementId':'roof.ridge','taskIds':['ridge'],'scope':'related','reason':'Møne må måles'}],'questions':['Hva er mønelengden?']}
# Read the actual ridge task ID rather than assume fixture names.
import subprocess
ridge=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {library} from './kalkyle-library.js';console.log(JSON.stringify(library.find(e=>e.id==='roof.ridge').tasks.map(t=>t.id)))"]))
proposal['items'][1]['taskIds']=ridge
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 module='export async function assistantStatus(){return true;} export async function requestEstimate(brief){window.sentBrief=brief; if(window.aiFailure)throw Error("Test API-feil"); return '+json.dumps(proposal)+';}'
 page.route('**/ai-estimate-client.js',lambda r:r.fulfill(content_type='application/javascript',body=module))
 page.goto('http://127.0.0.1:8090/kalkyle.html');page.locator('#brief-generate').wait_for(state='visible');page.wait_for_function('!document.getElementById("brief-generate").disabled')
 page.locator('#job-brief').fill('Saltak, 30 grader og 100 m² takflate med takstein, undertak, sløyfer og lekter.');page.locator('#start-detailed').click();page.locator('#project-name').fill('AI test');page.locator('#project-submit').click();page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible')
 assert page.locator('tr[data-row-index]').count()==0
 assert page.locator('[data-assistant-quantity]').nth(0).input_value()=='100'
 assert page.locator('[data-assistant-quantity]').nth(1).input_value()==''
 page.locator('[data-assistant-task="laths"]').uncheck();page.locator('#assistant-apply').click();assert page.locator('tr[data-row-index]').count()==2+len(ridge)
 assert not page.locator('#assistant-preview').is_visible()
 page.locator('#brief-generate').click();page.locator('#assistant-preview').wait_for(state='visible');assert page.locator('[data-assistant-element]:checked').count()==0
 page.locator('#job-brief').fill('En endret beskrivelse av takjobben');assert not page.locator('#assistant-preview').is_visible()
 page.evaluate('window.aiFailure=true');page.locator('#brief-generate').click();page.wait_for_function('document.getElementById("brief-status").textContent.includes("Test API-feil")');assert page.locator('tr[data-row-index]').count()==2+len(ridge)
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 print('PASS: AI-preview, explicit area, unknown lengths, task selection, existing rows, invalidation, API failure and mobile')
 b.close()
