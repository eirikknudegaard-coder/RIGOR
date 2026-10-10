"""Reported wall brief, dynamic questions and bad provider facts; no paid AI."""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
import os

base=os.environ.get('RIGOR_TEST_BASE','http://127.0.0.1:8090')
brief='trenger jeg en drager her? Bindingsverk cc 600, 2x6" vertikalesøyler, med dobbel hver 1.2m. Saltak med 25 graders vinkel. Jeg vil fjerne 2 meter av veggen'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for ai in [False,True]:
        page=browser.new_page(viewport={'width':1440,'height':1000})
        authorize_portal(page,tool_key='konstruksjon')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        # Simulate a stale server returning bad proposals: the client must also
        # validate quoted dimensions and keep the independently evidenced facts.
        def endpoint(route):
            if route.request.method=='GET':
                route.fulfill(json={'ready':ai})
            elif 'vertikalesøyler' in route.request.post_data_json['brief']:
                route.fulfill(json={'facts':[
                    {'field':'nominalSection','value':'2x8','evidence':'2x6"'},
                    {'field':'memberRole','value':'beam','evidence':'trenger jeg en drager her?'},
                    {'field':'sectionConstruction','value':'multiple_members','evidence':'dobbel hver 1.2m'},
                    {'field':'openingM','value':2,'evidence':'fjerne 2 meter'}
                ]})
            else:
                route.fulfill(json={'facts':[]})
        page.route('**/functions/v1/rigor-ai-construction',endpoint)
        page.goto(base+'/konstruksjon.html')
        page.wait_for_function('document.getElementById("construction-ai-status").textContent==='+('"AI klar"' if ai else '"Faglig spørreflyt"'))
        def start(text):
            page.locator('#construction-brief').fill(text)
            page.locator('#construction-submit').click()
            page.wait_for_function('document.getElementById("construction-workspace").hidden===false && !document.getElementById("construction-submit").disabled')
        start(brief)
        assert 'Går taksperrene på tvers' in page.locator('#construction-question-title').inner_text()
        assert page.locator('#construction-current-answer').evaluate('e=>e.tagName')=='SELECT'
        assert page.locator('#construction-ai-review').is_hidden()
        assert page.locator('#construction-calculate').is_disabled()
        page.locator('#construction-basis>summary').click()
        facts=page.locator('#construction-facts').inner_text()
        assert '2x6' in facts and '2x8' not in facts
        assert 'Søyle / stolpe' in facts
        assert page.locator('#construction-facts tr').filter(has_text='Bredde (mm)').count()==0
        assert page.locator('#construction-facts tr').filter(has_text='Dragerens oppbygging').count()==0
        # Editing a known role also uses the current nominal dimension.
        page.locator('#construction-facts tr').filter(has_text='Del av konstruksjonen').get_by_role('button',name='Endre').click()
        assert '2x6' in page.locator('#construction-question-title').inner_text()
        assert page.locator('#construction-current-answer').input_value()=='column'
        if ai:
            assert 'Noen detaljer kunne ikke bekreftes' in page.locator('#construction-message').inner_text()
        for size in ['2x2','3x4','2x6','2x8','2x10','2x12']:
            start('Jeg vil fjerne 2 meter av veggen. Bindingsverk cc600, '+size+'".')
            title=page.locator('#construction-question-title').inner_text()
            assert size in title and ('2x8' if size=='2x6' else '2x6') not in title
            options=page.locator('#construction-current-answer option').all_text_contents()
            assert 'Søylene / stenderne' in options
        # Explicit units are retained, missing units use a dropdown, and changes
        # recalculate the dimensions rather than retaining old input values.
        start('Jeg vil undersøke en drager. Bjelke 48x198.')
        assert 'Hvilken enhet' in page.locator('#construction-question-title').inner_text()
        assert page.locator('#construction-current-answer').evaluate('e=>e.tagName')=='SELECT'
        page.locator('#construction-current-answer').select_option('mm')
        page.locator('#construction-answer button[type=submit]').click()
        page.locator('#construction-basis>summary').click()
        assert '48x198 mm' in page.locator('#construction-facts').inner_text()
        row=page.locator('#construction-facts tr').filter(has_text='Oppgitt tverrsnitt').first
        row.get_by_role('button',name='Endre').click()
        page.locator('#construction-current-answer').fill('73×223 mm')
        page.locator('#construction-answer button[type=submit]').click()
        assert '73x223 mm' in page.locator('#construction-facts').inner_text()
        assert '223' in page.locator('#construction-facts tr').filter(has_text='Høyde (mm)').first.inner_text()
        start('Jeg vil undersøke en drager. Bjelke 1½×3½″.')
        page.locator('#construction-basis>summary').click()
        assert '1.5x3.5' in page.locator('#construction-facts').inner_text()
        start('Jeg vil undersøke en drager. Bjelke RHS 100x50x4.')
        page.locator('#construction-basis>summary').click()
        assert 'RHS 100x50x4' in page.locator('#construction-facts').inner_text()
        page.locator('#construction-mode-manual').click()
        assert page.locator('#rib-context-notice').is_visible()
        assert page.locator('#rib-widthMm').input_value()==''
        assert page.locator('#rib-heightMm').input_value()==''
        page.locator('#construction-mode-ai').click()
        start('Jeg vil undersøke en drager. Bjelke 90x225 mm i GL28h.')
        page.locator('#construction-basis>summary').click()
        assert 'GL28h' in page.locator('#construction-facts').inner_text()
        page.locator('#construction-mode-manual').click()
        assert 'GL28h' in page.locator('#rib-context-notice').inner_text()
        assert page.locator('#rib-grade').input_value()==''
        page.locator('#construction-mode-ai').click()
        start(brief)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        page.close()
    browser.close()
print('Section interpretation passed: general nominal/metric/profile/grade notation, dropdown units, edits, manual scope, AI/offline and mobile.')
