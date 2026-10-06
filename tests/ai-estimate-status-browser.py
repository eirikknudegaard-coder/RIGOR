from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];requests=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:requests.append(request.url))
    answer={'http':404,'body':{'code':'NOT_FOUND'}}
    def reply(route):
        headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}
        route.fulfill(status=204 if route.request.method=='OPTIONS' else answer['http'],content_type='application/json',headers=headers,body='' if route.request.method=='OPTIONS' else json.dumps(answer['body']))
    page.route('**/functions/v1/rigor-ai-estimate',reply)
    page.goto('http://127.0.0.1:8090/kalkyle.html')
    page.wait_for_function('document.getElementById("assistant-badge").textContent.includes("ikke publisert")')
    assert page.locator('#brief-generate').is_disabled()
    brief='Saltak med 30 grader og 100 m² takflate.'
    page.locator('#job-brief').fill(brief)
    page.locator('#brief-save').click()
    cases=[(200,{'ready':False},'ufullstendig'),(503,{},'kunne ikke bekreftes'),(401,{},'må konfigureres'),(200,{'ready':True},'AI-assistent klar')]
    for code,body,label in cases:
        answer.update({'http':code,'body':body})
        page.locator('#assistant-badge').click()
        page.wait_for_function('(text)=>document.getElementById("assistant-badge").textContent.includes(text)',arg=label)
        assert page.locator('#brief-generate').is_disabled()==(body.get('ready') is not True)
        assert page.locator('#job-brief').input_value()==brief
        assert page.evaluate('localStorage.getItem("rigor-job-brief-v1")')==brief
    answer.update({'http':404,'body':{'code':'NOT_FOUND'}})
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#assistant-badge').click()
    page.wait_for_function('document.getElementById("assistant-badge").textContent.includes("ikke publisert")')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/rigor-ai-status-mobile.png',full_page=True)
    assert not any('api.openai.com' in url for url in requests)
    assert not errors,errors
    print('PASS: missing deployment, incomplete setup, temporary failure, auth failure, recovery without lost draft, no paid AI requests and mobile')
    browser.close()
