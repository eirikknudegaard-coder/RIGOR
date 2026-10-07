"""Two account IDs in one browser, with real auth gate and storage adapter."""
import json
from playwright.sync_api import sync_playwright
from portal_test_support import authorize_portal

base='http://127.0.0.1:8090'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page();authorize_portal(page,mode='member',user_id='account-a')
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/data/market-prices.json*',lambda route:route.fulfill(json={'version':1,'sources':[],'offers':[]}))
    page.route('**/ai-estimate-client.js*',lambda route:route.fulfill(content_type='application/javascript',body='export async function assistantStatus(){return false;} export async function requestEstimate(){throw Error("No paid requests");}'))
    def create(name):
        page.locator('#start-detailed').click();page.locator('#project-name').fill(name);page.locator('#project-submit').click()
    def change_account(user_id,mode='member'):
        # Same browser context and origin; change authenticated identity without
        # clearing or replacing any application storage.
        page.evaluate('(args)=>window.testAuthEmit("SIGNED_IN",args.mode,args.userId)',{'mode':mode,'userId':user_id})
        page.wait_for_url('**/portal.html?returnTo=*')
        page.wait_for_url('**/kalkyle.html')
        page.locator('#protected-app').wait_for(state='visible')
    page.goto(base+'/kalkyle.html')
    page.locator('#job-brief').fill('Privat utkast for A');page.locator('#brief-save').click()
    create('Prosjekt A')
    page.locator('#rates-tab').click();page.locator('#wage').fill('431');page.locator('#save-rate-defaults').click();page.locator('#detailed').click()
    page.locator('#library-browser summary').click();page.locator('#library-search').fill('Riving av benkeplate')
    card=page.locator('.library-card').first;card.locator('summary').click();card.get_by_role('button',name='Legg til valgte oppgaver').click();page.locator('#library-close').click()
    page.once('dialog',lambda dialog:dialog.accept('Min private mal A'))
    page.locator('#save-library').click();page.locator('#save').click();page.locator('#project-back').click()
    a_data=page.evaluate('localStorage.getItem(window.testAccountKey())')
    assert all(key in json.loads(a_data)['entries'] for key in ['rigor-projects-v1','rigor-calculation-v1','rigor-library-v1','rigor-job-brief-v1','rigor-rate-defaults-v1']),json.loads(a_data)['entries'].keys()
    change_account('account-b')
    assert page.locator('.project-card').count()==0
    assert page.locator('#job-brief').input_value()==''
    assert page.locator('#legacy-projects').is_hidden()
    create('Prosjekt B');page.locator('#rates-tab').click();assert page.locator('#wage').input_value()!='431'
    page.locator('#detailed').click();page.locator('#restore').click()
    assert 'Ingen lokal kalkyle' in page.locator('#status').inner_text()
    page.locator('#library-browser summary').click();page.locator('#library-source').select_option('local');assert page.locator('.library-card').count()==0;page.locator('#library-close').click()
    page.locator('#project-back').click();page.locator('#job-brief').fill('Privat utkast for B');page.locator('#brief-save').click()
    b_data=page.evaluate('localStorage.getItem(window.testAccountKey())')
    assert page.evaluate('localStorage.getItem(window.testAccountKey("account-a"))')==a_data
    change_account('account-a')
    assert page.locator('.project-card').count()==1;assert page.locator('.project-card h3').inner_text()=='Prosjekt A'
    assert page.locator('#job-brief').input_value()=='Privat utkast for A'
    page.get_by_role('button',name='Åpne prosjekt').click();page.locator('#rates-tab').click();assert page.locator('#wage').input_value()=='431'
    page.locator('#detailed').click();assert page.locator('tr[data-row-index]').count()==1
    page.locator('#library-browser summary').click();page.locator('#library-source').select_option('local');assert page.locator('.library-card').count()==1;page.locator('#library-close').click();page.locator('#project-back').click()
    assert page.evaluate('localStorage.getItem(window.testAccountKey("account-b"))')==b_data
    # Legacy values remain unowned until an administrator explicitly transfers
    # them. A member must not see the old projects, draft or import action.
    page.evaluate('''() => {
      for(const key of ['rigor-projects-v1','rigor-calculation-v1','rigor-library-v1','rigor-job-brief-v1','rigor-rate-defaults-v1'])localStorage.setItem(key,window.testReadStorage(key));
    }''')
    change_account('account-c')
    assert page.locator('.project-card').count()==0;assert page.locator('#job-brief').input_value()=='';assert page.locator('#legacy-projects').is_hidden()
    change_account('admin','admin')
    assert page.locator('.project-card').count()==0;assert page.locator('#legacy-projects').is_visible();assert page.locator('#job-brief').input_value()==''
    create('Administrators nye prosjekt');page.locator('#project-back').click()
    legacy=page.evaluate('localStorage.getItem("rigor-projects-v1")')
    current=page.evaluate('localStorage.getItem(window.testAccountKey())')
    # Quota errors leave all original and current account data untouched.
    page.evaluate('''() => {window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===window.testAccountKey())throw Error('quota');return window.originalSetItem.call(this,key,value);};}''')
    page.locator('#legacy-import').click();assert 'kunne ikke lagres' in page.locator('#legacy-import-status').inner_text()
    assert page.evaluate('localStorage.getItem("rigor-projects-v1")')==legacy
    assert page.evaluate('localStorage.getItem(window.testAccountKey())')==current
    page.evaluate('() => {Storage.prototype.setItem=window.originalSetItem;}')
    page.locator('#legacy-import').click();page.locator('#protected-app').wait_for(state='visible')
    page.wait_for_function('document.querySelectorAll(".project-card").length===2')
    assert page.locator('#legacy-projects').is_hidden();assert page.locator('#job-brief').input_value()=='Privat utkast for A'
    assert page.evaluate('localStorage.getItem("rigor-projects-v1")')==legacy
    page.reload();assert page.locator('.project-card').count()==2
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/rigor-account-projects-mobile.png',full_page=True)
    assert not errors,errors
    print('PASS: same-browser account isolation for projects, calculations, templates, drafts and rates; identity-change locks, preserved A/B data, explicit admin-only legacy migration, quota rollback, reload and mobile')
    browser.close()
