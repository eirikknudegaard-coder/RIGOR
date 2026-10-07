from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse, parse_qs
import json

base='http://127.0.0.1:8090'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    errors=[]
    def new_page(mode,delay=0):
        page=browser.new_page(viewport={'width':1440,'height':1000})
        page.on('pageerror',lambda e:errors.append(str(e)))
        authorize_portal(page,mode=mode,delay=delay,wait=False)
        # Keep business data and AI readiness deterministic, without paid calls.
        page.route('**/data/market-prices.json*',lambda r:r.fulfill(json={'version':1,'sources':[],'offers':[]}))
        page.route('**/ai-estimate-client.js*',lambda r:r.fulfill(content_type='application/javascript',body='export async function assistantStatus(){return false;} export async function requestEstimate(){throw Error("No paid test requests");}'))
        return page
    for file in ['kalkyle.html','priser.html']:
        page=new_page('anonymous');requests=[]
        page.on('request',lambda r:requests.append(r.url))
        page.goto(base+'/'+file)
        page.wait_for_url('**/portal.html?returnTo=*')
        assert parse_qs(urlparse(page.url).query)['returnTo']==[file]
        page.locator('#login-panel').wait_for(state='visible')
        assert not any('/kalkyle.js?' in u or '/priser.js?' in u or '/market-prices.json' in u for u in requests),requests
        # Explicit login returns to the requested tool, never a third-party URL.
        page.locator('#login-email').fill('admin@example.test');page.locator('#login-password').fill('test-password-only')
        page.locator('#login-form button[type=submit]').click()
        page.wait_for_url('**/'+file);page.locator('#protected-app').wait_for(state='visible')
        if file=='kalkyle.html':
            page.locator('#start-detailed').click();page.locator('#project-name').fill('Behold ved utlogging');page.locator('#project-submit').click()
            stored=page.evaluate('window.testReadStorage("rigor-projects-v1")')
            page.locator('#library-browser summary').click();page.locator('#library-dialog').wait_for(state='visible')
            checks=page.evaluate('window.testPortalCalls.filter(c=>c==="getUser").length')
            page.evaluate('window.testAuthEmit("TOKEN_REFRESHED")')
            page.wait_for_function('(checks)=>window.testPortalCalls.filter(c=>c==="getUser").length>checks',arg=checks)
            assert page.locator('#library-dialog').is_visible()
        else:
            stored=page.evaluate('window.testReadStorage("rigor-projects-v1")')
        page.evaluate('window.testAuthEmit("SIGNED_OUT","anonymous")')
        page.wait_for_url('**/portal.html?returnTo=*')
        assert page.evaluate('window.testReadStorage("rigor-projects-v1")')==stored
        page.close()
    for mode in ['inactive','no-tool','disabled','expired']:
        page=new_page(mode);requests=[];page.on('request',lambda r:requests.append(r.url))
        page.goto(base+'/kalkyle.html')
        page.wait_for_url('**/portal.html?returnTo=*')
        assert not any('/kalkyle.js?' in u or '/market-prices.json' in u for u in requests),requests
        if mode!='expired':page.locator('#denied-panel').wait_for(state='visible')
        else:page.locator('#login-panel').wait_for(state='visible')
        page.close()
    page=new_page('member',delay=800)
    page.goto(base+'/kalkyle.html',wait_until='domcontentloaded')
    assert page.locator('#protected-app').is_hidden()
    assert page.locator('#portal-access-shell').is_visible()
    assert page.locator('#project-list').locator('.project-card').count()==0
    page.locator('#protected-app').wait_for(state='visible')
    assert page.evaluate('window.testPortalCalls.some(c=>c.table==="portal_tool_access"&&c.filters.user_id==="verified-test-user")')
    # Revocation is rechecked when a restored/background tab becomes active.
    page.evaluate('localStorage.setItem("rigor-test-auth",JSON.stringify({mode:"no-tool"}));window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
    page.wait_for_url('**/portal.html?returnTo=*');page.close()
    page=new_page('offline');requests=[];page.on('request',lambda r:requests.append(r.url))
    page.goto(base+'/kalkyle.html')
    page.locator('#portal-access-retry').wait_for(state='visible')
    assert page.locator('#protected-app').is_hidden()
    assert not any('/kalkyle.js?' in u for u in requests)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/rigor-login-check-mobile.png',full_page=True)
    page.evaluate('localStorage.setItem("rigor-test-auth",JSON.stringify({mode:"admin"}))')
    page.locator('#portal-access-retry').click();page.locator('#protected-app').wait_for(state='visible');page.close()
    page=new_page('admin')
    page.goto(base+'/portal.html?returnTo=https%3A%2F%2Fevil.test%2Fkalkyle.html')
    page.locator('#dashboard-panel').wait_for(state='visible');assert urlparse(page.url).path=='/portal.html'
    page.close()
    assert not errors,errors
    print('PASS: anonymous URLs, no app/price initialization before access, login return, active/granted membership, disabled/missing/expired access, logout with saved projects, restored-tab revocation, offline retry/mobile and unsafe return rejection')
    browser.close()
