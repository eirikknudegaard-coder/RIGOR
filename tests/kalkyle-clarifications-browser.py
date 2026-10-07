from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import json

roof = {'summary': 'Tak med undertak', 'items': [{'elementId': 'roof.underlay', 'taskIds': ['underlay', 'battens', 'laths'], 'scope': 'requested', 'reason': 'Oppgitte oppgaver'}], 'questions': ['Hva er mønelengden?']}
wall = {'summary': 'Stående kledning', 'items': [{'elementId': 'wall.cladding.vertical', 'taskIds': ['barrier', 'ventilation', 'cladding'], 'scope': 'requested', 'reason': 'Stående utførelse'}], 'questions': []}
module = 'export async function assistantStatus(){return true;} export async function requestEstimate(brief){window.sentBriefs=window.sentBriefs||[]; window.sentBriefs.push(brief); return brief.includes("Kledningsretning")?'+json.dumps(wall)+' : '+json.dumps(roof)+';}'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000});authorize_portal(page)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/ai-estimate-client.js*', lambda route: route.fulfill(content_type='application/javascript', body=module))
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.wait_for_function('!document.getElementById("brief-generate").disabled')
    page.locator('#job-brief').fill('Skal bytte tak. Det er saltak, ca 20m2. Hele taket utenom takstoler skal byttes. Ta med nytt undertak, sutak, sløyfer, takstein og vindskier.')
    page.locator('#start-detailed').click()
    page.locator('#project-name').fill('Avklaringer')
    page.locator('#project-submit').click()
    page.locator('#brief-generate').click()
    assert page.locator('#assistant-clarification').is_visible()
    assert page.locator('#assistant-clarification-fields [data-clarification]').count() == 2
    assert page.evaluate('!(window.sentBriefs||[]).length')
    page.locator('[data-clarification="roof-angle"]').fill('30')
    page.locator('[data-clarification="roof-basis"]').select_option('Målt takflate')
    page.locator('#assistant-continue').click()
    page.locator('#assistant-preview').wait_for(state='visible')
    assert page.evaluate('window.sentBriefs[0].includes("Takvinkel: 30 grader")')
    assert page.locator('[data-assistant-quantity]').input_value() == '20'
    assert page.locator('tr[data-row-index]').count() == 0
    assert page.locator('.assistant-answer-form input').get_attribute('type') == 'number'
    page.locator('.assistant-answer-form input').fill('6')
    page.locator('.assistant-answer-form button').click()
    page.wait_for_function('window.sentBriefs.length===2')
    page.locator('#assistant-preview').wait_for(state='visible')
    assert page.evaluate('window.sentBriefs[1].includes("Mønelengde: 6 m")')
    assert page.locator('tr[data-row-index]').count() == 0
    page.locator('#assistant-apply').click()
    assert page.locator('tr[data-row-index]').count() == 3

    page.locator('#job-brief').fill('Skal bytte kledning på huset.')
    page.locator('#brief-generate').click()
    assert page.locator('#assistant-clarification-fields [data-clarification]').count() == 5
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/rigor-clarifications-mobile.png', full_page=True)
    page.locator('[data-clarification="cladding-material"]').select_option('Trekledning')
    page.locator('[data-clarification="cladding-direction"]').select_option('Stående (vertikal)')
    page.locator('[data-clarification="cladding-profile"]').fill('Dobbelfals 19 × 148 mm')
    page.locator('[data-clarification="cladding-area"]').fill('40')
    page.locator('[data-clarification="cladding-insulation"]').select_option('Nei, eksisterende isolasjon beholdes')
    page.locator('#assistant-continue').click()
    page.wait_for_function('window.sentBriefs.length===3')
    page.locator('#assistant-preview').wait_for(state='visible')
    assert page.evaluate('window.sentBriefs[2].includes("Kledningsretning: Stående (vertikal)")')
    assert page.locator('#assistant-summary').inner_text() == 'Stående kledning'
    assert page.locator('tr[data-row-index]').count() == 3
    stored = page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].brief')
    assert 'Kledningsprofil: Dobbelfals' in stored
    page.locator('#job-brief').fill('Jeg skal bytte tak på huset.')
    page.locator('#brief-generate').click()
    assert page.locator('[data-clarification="roof-type"]').is_visible()
    page.locator('#assistant-preliminary').click()
    page.wait_for_function('window.sentBriefs.length===4')
    page.locator('#assistant-preview').wait_for(state='visible')
    assert page.locator('[data-assistant-quantity]').input_value() == ''
    assert page.locator('tr[data-row-index]').count() == 3
    assert not errors, errors
    print('PASS: questions before API, preserved answers, refinement, explicit roof area, cladding specifications, preliminary proposal and mobile')
    browser.close()
