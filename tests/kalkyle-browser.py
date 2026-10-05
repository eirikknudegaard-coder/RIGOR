import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080')+'/kalkyle.html');page.locator('#start-simple').click();page.locator('#project-name').fill('Regresjon');page.locator('#project-submit').click();page.locator('#price-mode').select_option('example');page.locator('#detailed').click();page.locator('#library-browser summary').first.click()
 assert page.locator('.library-card').count()>=140
 assert page.locator('.library-category-group[open]').count()==0
 page.locator('#library-search').fill('benkeplate');assert page.locator('.library-category-group[open]').count()>0
 kitchen=page.locator('.library-card').filter(has=page.locator('summary',has_text='Riving av benkeplate')).first
 kitchen.locator('summary').click();assert 'frakoblet' in kitchen.locator('.library-scope').inner_text()
 page.locator('#library-search').fill('PVC takmembran');card=page.locator('.library-card').filter(has=page.locator('summary',has_text='PVC takmembran')).first
 assert page.locator('.library-category-group[open]').count()==1
 card.locator('summary').click();assert 'på ferdig og egnet underlag' in card.locator('.library-scope').inner_text();assert 'Faktisk takflate' in card.locator('.library-scope').inner_text();assert 'beslag' in card.locator('.library-scope').inner_text()
 card.get_by_role('button',name='Legg til valgte oppgaver').click();assert page.locator('#total').inner_text()=='—';assert 'mangler grunntid' in page.locator('#status').inner_text()
 added=page.locator('tr[data-row-index]').all()[-2:]
 for row in added:
  assert row.locator('[data-field=hours]').input_value()==''
  row.locator('[data-field=hours]').fill('0.2');row.locator('[data-field=material]').fill('100')
 assert page.locator('#total').inner_text()!='—'
 page.locator('#save').click();page.reload();page.get_by_role('button',name='Åpne prosjekt').click();assert page.locator('#total').inner_text()!='—'
 page.set_viewport_size({'width':390,'height':844});page.locator('#detailed').click();page.locator('#library-browser summary').first.click();page.locator('#library-search').fill('Takrenner')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: Utvidede alternativer, beskrivelser, manglende priser/tider, eksplisitt prising, lagring og mobil')
 b.close()
