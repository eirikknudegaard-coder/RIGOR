import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));requests=[];page.on('request',lambda r:requests.append(r.url))
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080')+'/kalkyle.html')
 assert page.locator('#home-brief-anchor #job-composer').is_visible();assert page.locator('#brief-generate').is_disabled()
 page.locator('[data-brief-example=roof]').click();roof=page.locator('#job-brief').input_value();assert 'sløyfer' in roof and 'sutak' in roof and '30 grader' in roof
 page.locator('#brief-save').click();page.reload();assert page.locator('#job-brief').input_value()==roof
 page.locator('#start-detailed').click();page.locator('#project-name').fill('Saltak');page.locator('#project-submit').click();assert page.locator('#workspace-brief-anchor #job-composer').is_visible();assert page.locator('#job-brief').input_value()==roof
 assert page.locator('tr[data-row-index]').count()==0
 page.locator('#pricing-tab').click();assert page.locator('#pricing-pane').is_visible();assert not page.locator('#details').is_visible();assert not page.locator('#wizard').is_visible()
 page.locator('#rates-tab').click();assert page.locator('#rates-pane').is_visible();page.locator('#materialMarkup').fill('25')
 page.locator('#job-brief').fill('Tak med ekstra gjennomføring.');page.locator('#project-edit').click();page.locator('#project-submit').click();assert page.locator('#job-brief').input_value()=='Tak med ekstra gjennomføring.'
 page.locator('#brief-save').click();page.locator('#nav-projects').click();page.reload();page.get_by_role('button',name='Åpne prosjekt').click();assert page.locator('#details').is_visible();assert page.locator('#job-brief').input_value()=='Tak med ekstra gjennomføring.'
 page.locator('#rates-tab').click();assert page.locator('#materialMarkup').input_value()=='25'
 page.locator('#project-back').click();page.locator('#job-brief').fill('Ny terrasse');page.locator('#start-simple').click();page.locator('#project-name').fill('Terrasse');page.locator('#project-submit').click();assert page.locator('#job-brief').input_value()=='Ny terrasse'
 page.locator('#project-back').click();page.locator('#project-search').fill('Saltak');page.get_by_role('button',name='Åpne prosjekt').click();assert page.locator('#job-brief').input_value()=='Tak med ekstra gjennomføring.'
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#pricing-tab').click();assert page.locator('#pricing-pane').is_visible()
 assert not any('/functions/' in url or 'api.openai.com' in url for url in requests),requests
 assert not errors,errors
 print('PASS: chatkladd, eksempler, prosjektseparasjon, lagring, fire faner, modusbevaring, mobil og ingen AI-kall')
 b.close()
