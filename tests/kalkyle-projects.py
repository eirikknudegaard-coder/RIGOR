from portal_test_support import authorize_portal
import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();authorize_portal(page); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080')+'/kalkyle.html')
 assert page.locator('#project-home').is_visible();assert not page.locator('#project-workspace').is_visible()
 page.locator('#start-detailed').click();page.locator('#project-name').fill('Takprosjekt');page.locator('#project-customer').fill('Kari');page.locator('#project-address').fill('Vestliveien 55');page.locator('#project-submit').click()
 assert page.locator('tr[data-row-index]').count()==0
 page.locator('#library-browser summary').click();page.locator('#library-dialog').wait_for(state='visible')
 page.locator('#library-search').fill('Riving av benkeplate');card=page.locator('.library-card').first;card.locator('summary').click();card.get_by_role('button',name='Legg til valgte oppgaver').click()
 assert page.locator('tr[data-row-index]').count()==1;page.locator('#library-close').click()
 page.locator('#project-back').click();assert 'Kari' in page.locator('#project-list').inner_text()
 page.locator('#start-simple').click();page.locator('#project-name').fill('Etterisolering');page.locator('#project-submit').click();assert page.locator('#wizard').is_visible();assert page.locator('tr[data-row-index]').count()>1
 page.locator('#project-back').click();page.reload();assert page.locator('.project-card').count()==2
 page.locator('#project-search').fill('Vestliveien');page.get_by_role('button',name='Åpne prosjekt').click();assert page.locator('tr[data-row-index]').count()==1;assert page.locator('#details').is_visible()
 page.locator('#project-edit').click();page.locator('#project-state').select_option('Under arbeid');page.locator('#project-submit').click();assert 'Under arbeid' in page.locator('#project-meta').inner_text()
 page.locator('#project-back').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('#start-detailed').click();assert page.locator('#project-dialog').is_visible();page.locator('#project-cancel').click();assert page.locator('#project-home').is_visible()
 # Cancelling deletion and a failed local-storage write must preserve both projects.
 before=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))')
 page.once('dialog',lambda dialog:dialog.dismiss());page.get_by_role('button',name='Slett prosjekt Takprosjekt',exact=True).click()
 assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))')==before
 page.evaluate('() => {window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value){if(key===window.testAccountKey())throw Error("Test storage failure"); return window.originalSetItem.call(this,key,value)}}')
 page.once('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Slett prosjekt Takprosjekt',exact=True).click()
 assert 'kunne ikke slettes' in page.locator('#project-message').inner_text()
 assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))')==before
 page.evaluate('() => {Storage.prototype.setItem=window.originalSetItem}')
 page.once('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Slett prosjekt Takprosjekt',exact=True).click()
 after=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))')
 assert after==[project for project in before if project['name']!='Takprosjekt']
 page.get_by_role('button',name='Angre sletting',exact=True).click()
 restored=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))')
 assert sorted(restored,key=lambda project:project['id'])==sorted(before,key=lambda project:project['id'])
 page.once('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Slett prosjekt Takprosjekt',exact=True).click()
 page.reload();page.locator('#project-search').fill('');assert page.locator('.project-card').count()==1
 assert 'Etterisolering' in page.locator('#project-list').inner_text()
 assert 'Takprosjekt' not in page.locator('#project-list').inner_text()
 page.once('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Slett prosjekt Etterisolering',exact=True).click()
 assert 'Ingen prosjekter ennå' in page.locator('#project-list').inner_text()
 assert page.evaluate('window.testReadStorage("rigor-projects-v1")')=='[]'
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: forside, prosjektopprettelse, separate kalkyler, søk, bekreftet sletting, avbryt, lagringsfeil, angre, reload, tom liste og mobil')
 b.close()
