"""Actual UI/storage/CSV/PDF with dated Norwegian product evidence.

Auth and AI transport are mocked explicitly. No live register writes or billed
provider calls. Prices/consumption are live-captured, not synthetic offers.
"""
from portal_test_support import authorize_portal
from playwright.sync_api import sync_playwright
from pathlib import Path
from datetime import datetime, timedelta
import json, re, os, fitz, csv as csv_lib, io

root=Path(__file__).parent
catalog=json.loads((root/'fixtures/evidence/benchmark-catalog.json').read_text())
fixture=json.loads((root/'fixtures/evidence/benchmark-projects.json').read_text())
base=os.getenv('RIGOR_TEST_BASE_URL','http://127.0.0.1:8090')
output=Path(os.getenv('RIGOR_QA_OUTPUT','/tmp/rigor-kalkyle-qa'));output.mkdir(exist_ok=True)
reports=[]
live_register=os.getenv('RIGOR_TEST_LIVE_REGISTER')=='1'
views=[('desktop',1440,1000)] if os.getenv('RIGOR_QA_VIEWS')=='desktop' else [('desktop',1440,1000),('mobile',390,844)]
def amount(text):return float(re.sub(r'[^0-9,.-]','',text).replace(',','.'))
def money(value):return f'{value:,.2f}'.replace(',',' ').replace('.',',')+' kr'
def quantity(value):return f'{value:,.2f}'.rstrip('0').rstrip('.').replace(',',' ').replace('.',',')
def compact(text):return ' '.join(text.split())
def assert_clean(page):
    text=page.locator('body').inner_text()
    for forbidden in ['NaN','Infinity','undefined','null kr']:
        assert forbidden not in text,forbidden
    saved=page.evaluate('window.testReadStorage("rigor-projects-v1")')
    if saved:
        assert not re.search(r'NaN|Infinity|undefined',saved)
def saved(page):return page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0]')
def row_for(page,key):
    index=next(i for i,r in enumerate(saved(page)['snapshot']['rows'])if r.get('priceKey')==key)
    return page.locator('tr[data-row-index]').nth(index)
def choose(page,key,product,spacing=None):
    row=row_for(page,key)
    reference=row.get_by_role('button',name='Se prisgrunnlag',exact=True)
    if reference.count():
        reference.click();assert_clean(page)
        page.locator('#reference-dialog').get_by_role('button',name='Velg konkret produkt',exact=True).click()
    else:row.locator('.row-market-button').click()
    assert page.locator('#material-store').is_hidden()
    page.locator('#material-product').select_option(product)
    if spacing is not None:page.locator('#material-spacing').fill(str(spacing))
    assert page.locator('#material-submit').inner_text()=='Bruk valgt produkt'
    page.locator('#material-submit').scroll_into_view_if_needed();page.locator('#material-submit').click()
    assert page.locator('#material-dialog').is_hidden(),page.locator('#material-error').inner_text()
    assert_clean(page)
def read_pdf(page,project,view,kind):
    page.locator('#project-pdf').click()
    page.locator('#pdf-company').fill('Kontrollbygg Ås AS')
    page.locator('#pdf-type').select_option(kind)
    page.locator('#pdf-scope').fill(project['brief'])
    page.locator('#pdf-download').scroll_into_view_if_needed()
    assert page.locator('#pdf-download').is_enabled(),page.locator('#pdf-validation').inner_text()
    path=output/(project['id']+'-'+view+'-'+kind+'.pdf')
    with page.expect_download() as download:page.locator('#pdf-download').click()
    download.value.save_as(path);page.wait_for_function('!document.getElementById("pdf-download").disabled')
    doc=fitz.open(path);text='\n'.join(p.get_text()for p in doc)
    normalized=compact(text)
    included=[r for r in saved(page)['snapshot']['rows'] if r.get('enabled',True)]
    sales_codes=re.findall(r'Salgskode:\s*(RG-S-[0-9-]+)',text)
    assert len(sales_codes)==len(included),(sales_codes,len(included))
    assert len(set(sales_codes))==len(sales_codes),sales_codes
    for row,code in zip(included,sales_codes):
        assert compact(row['name']) in normalized,row['name']
        unit={'m2':'m²'}.get(row['unit'],row['unit'])
        work=quantity(row['quantity'])+' '+unit
        if kind=='offer':assert 'Salgskode: '+code+' '+work in normalized,(row['name'],work)
        else:
            material_unit={'m2':'m²'}.get(row['materialUnit'],row['materialUnit'])
            assert 'Arbeid: '+work+' ×' in normalized,work
            assert 'Materiell: '+quantity(row['materialQuantity'])+' '+material_unit+' ×' in normalized,row['name']
    material_section=compact(text.split('Materialliste',1)[1].split('Sammendrag',1)[0])
    for row in included:
        if row.get('priceKey') in project['choices']:
            assert compact(row['selectedProduct']['name']) in material_section,row['selectedProduct']['name']
            assert quantity(row['materialQuantity'])+' '+row['materialUnit'] in material_section,row['name']
            assert quantity(row.get('marketPurchasedQuantity',row['materialQuantity']))+' '+row['materialUnit'] in material_section,row['name']
    if kind=='offer':
        for value in ['Innkjøpskostnad','Innkjøpspris','Varenummer:','obs ·']:assert value not in material_section,value
    for forbidden in ['NaN','Infinity','undefined']:assert forbidden not in text
    for value in [project['name'],'Kunde Ødegård',money(amount(page.locator('#total').inner_text())),money(amount(page.locator('#vat').inner_text())),money(amount(page.locator('#gross').inner_text()))]:assert value in text,value
    if kind=='offer':
        for value in ['Grunnlønn','Timekostnad','Grunntid','Kalkulert fortjeneste','Priskilde','Arbeidskode:']:assert value not in text,value
    else:
        for value in ['Grunnlønn','Grunntid','Priskilde','Materialpåslag']:assert value in text,value
    for i,p in enumerate(doc):
        assert f'Side {i+1} av {len(doc)}'in p.get_text()
        for block in p.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    assert span['bbox'][0]>=32 and span['bbox'][2]<=p.rect.width-30,(path,span)
    page.locator('#pdf-cancel').click();assert_clean(page)
    return {'path':str(path),'pages':len(doc),'totalsMatch':True,'internalPrivacy':True}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for view,width,height in views:
      for project in fixture['cases']:
        page=browser.new_page(viewport={'width':width,'height':height},accept_downloads=True);authorize_portal(page);errors=[];calls=[]
        page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        if not live_register:page.clock.set_fixed_time(datetime.fromisoformat(catalog['updated_at'].replace('Z','+00:00')))
        served=json.loads(json.dumps(catalog))
        if not live_register:page.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(served)))
        proposal={'summary':project['name'],'questions':[],'items':[{'elementId':e,'taskIds':tasks,'reason':'Eksplisitt bestilt i brukerbeskrivelsen','scope':'requested'}for e,tasks in project['scope']]}
        def ai(route):
            if route.request.method=='GET':route.fulfill(content_type='application/json',body='{"ready":true}');return
            calls.append(route.request.post_data_json);route.fulfill(content_type='application/json',body=json.dumps(proposal))
        page.route('**/functions/v1/rigor-ai-estimate',ai)
        page.goto(base+'/kalkyle.html');page.locator('#start-simple').click();page.locator('#project-name').fill(project['name']);page.locator('#project-customer').fill('Kunde Ødegård');page.locator('#project-submit').click()
        for key,value in fixture['rates'].items():page.locator('#rates-tab').click();page.locator('#'+key).fill(str(value))
        page.locator('#simple').click();page.locator('#basis').select_option('surface')
        page.locator('#lathSpacing').locator('xpath=ancestor::details').locator('summary').click()
        for key,value in {'lathSpacing':375,'battenSpacing':600,'roofWaste':0}.items():page.locator('#'+key).fill(str(value));page.locator('#'+key).press('Tab')
        page.locator('#pricing-tab').click();assert page.locator('#byggmax-store').is_hidden()
        if project['id']=='terrace':
            csv='oppgavenokkel;enhet;timer_per_enhet;tidsfaktor;kilde\nterrace.new.deck.deck;m2;0,35;;Benchmarkforutsetning – ikke offentlig norm\n'
            page.locator('#time-file').set_input_files({'name':'benchmark-times.csv','mimeType':'text/csv','buffer':csv.encode()})
        page.locator('#simple').click();page.wait_for_function('!document.getElementById("brief-generate").disabled')
        page.locator('#job-brief').fill(project['brief']);page.locator('#brief-generate').click();page.locator('#ai-budget').wait_for(state='visible')
        assert page.locator('[data-clarification]').count()==0
        for element,kind,value,source in project['experience']:
            page.locator('#ai-experience-editor summary').click();page.locator('#ai-rate-element').select_option(element);page.locator('#ai-rate-type').select_option(kind)
            page.locator('#ai-rate-min').fill(str(value));page.locator('#ai-rate-max').fill(str(value));page.locator('#ai-rate-source').fill(source);page.locator('#ai-rate-date').fill(catalog['updated_at'][:10]);page.locator('#ai-rate-confidence').select_option('medium');page.get_by_role('button',name='Lagre erfaringstall',exact=True).click();assert_clean(page)
        assert page.locator('#ai-budget h3').inner_text()=='Foreløpig budsjettanslag'
        assert 'Foreløpig materialliste' in page.locator('#ai-budget').inner_text()
        simple_record=saved(page);simple_text=page.locator('#ai-budget').inner_text()
        simple_price=amount(page.locator('#ai-budget > p').nth(1).inner_text().split(' ekskl.')[0])
        page.locator('#ai-make-detailed').click();page.locator('#assistant-preview').wait_for(state='visible')
        assert page.locator('#assistant-items .assistant-material-name').count()>0
        assert len(calls)==1,'Conversion must preserve scope rather than request a different project'
        page.locator('#assistant-apply').click();page.locator('#save').click();assert_clean(page)
        rows=saved(page)['snapshot']['rows'];expected_tasks=sum(len(t)for e,t in project['scope']);assert len(rows)==expected_tasks,(len(rows),expected_tasks)
        assert all(r['quantity']==project['area']for r in rows)
        assert not any('joists'in r['taskKey']or 'railing'in r['taskKey']for r in rows)
        for key,value in project.get('manual',{}).items():row_for(page,key).locator('[data-field=material]').fill(str(value));page.locator('#save').click()
        for key,product in project['choices'].items():choose(page,key,product,375 if key=='roof.cover.tile'else None)
        page.locator('#save').click();after=saved(page)
        assert page.locator('#material-list-section').is_visible()
        for key,product in project['choices'].items():
            chosen=catalog['offers'][next(i for i,o in enumerate(catalog['offers'])if o['id']==product)]
            assert chosen['name'] in page.locator('#material-list').inner_text()
        assert amount(page.locator('#calc-area').inner_text())==project['area']
        assert after['snapshot']['settings']['area']==project['area']
        assert after['snapshot']['settings']['difficulty']==1
        assert after['snapshot']['rates']==fixture['rates']
        for key,value in project['expectedQuantity'].items():assert next(r for r in after['snapshot']['rows']if r.get('priceKey')==key)['materialQuantity']==value
        if project['id']=='wall':assert next(r for r in after['snapshot']['rows']if r.get('priceKey')=='insulation.isolasjon100')['marketPackages']==36
        total=amount(page.locator('#total').inner_text());delta=total-simple_price;percent=delta/simple_price*100
        (output/(project['id']+'-'+view+'-comparison.json')).write_text(json.dumps({'simple':{'ui':simple_text,'price':simple_price,'context':simple_record['aiContext']},'detailed':after,'total':total,'difference':delta,'percent':percent},ensure_ascii=False,indent=2))
        assert abs(percent)<=20,{'simple':simple_price,'detailed':total,'difference':delta,'percent':percent}
        assert abs(delta)<100000
        report={'project':project,'viewport':view,'liveRegister':live_register,'simple':{'ui':simple_text,'priceExVatDisplayed':simple_price,'context':simple_record['aiContext']},'detailed':{'snapshot':after['snapshot'],'priceExVat':total,'vat':amount(page.locator('#vat').inner_text()),'gross':amount(page.locator('#gross').inner_text()),'hours':amount(page.locator('#hours').inner_text())},'difference':{'absolute':delta,'percent':percent},'pdf':[]}
        with page.expect_download() as csv_download:page.locator('#export').click()
        csv_path=output/(project['id']+'-'+view+'.csv');csv_download.value.save_as(csv_path)
        csv_text=csv_path.read_text(encoding='utf-8-sig');assert not re.search(r'NaN|Infinity|undefined|null kr',csv_text)
        exported=list(csv_lib.reader(io.StringIO(csv_text),delimiter=';'))
        name_column=exported[1].index('Materiale / produkt')
        for key,product in project['choices'].items():
            chosen=next(o for o in catalog['offers'] if o['id']==product)
            assert any(len(line)>name_column and line[name_column]==chosen['name'] for line in exported),chosen['name']
        report['csv']={'path':str(csv_path),'finite':True}
        for kind in ['offer','calculation']:report['pdf'].append(read_pdf(page,project,view,kind))
        # Unconfirmed highlighting and closing cannot replace a saved SKU.
        key=next(iter(project['choices']));product=project['choices'][key];choose(page,key,product,375 if key=='roof.cover.tile'else None)
        row_for(page,key).locator('.row-market-button').click();original=page.locator('#material-product').input_value();page.locator('#material-product').select_option('');page.locator('#material-cancel').click();assert saved(page)['snapshot']['marketBindings'][key]==product
        page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();assert saved(page)['snapshot']['marketBindings'][key]==product
        for tab in ['simple','detailed','pricing-tab','detailed']:page.locator('#'+tab).click();assert_clean(page)
        row_for(page,key).locator('.row-market-button').click();assert page.locator('#material-product').input_value()==product;page.locator('#material-cancel').click()
        page.locator('#pricing-tab').click();page.locator('#refresh-prices').click();page.wait_for_function('!document.getElementById("refresh-prices").disabled');assert saved(page)['snapshot']['marketBindings'][key]==product
        page.locator('#detailed').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if project['id']=='terrace' and not live_register:
            # Fault injection into a captured register, not invented market evidence.
            row=row_for(page,key);previous=saved(page)['snapshot'];row.locator('[data-field=material]').fill('')
            assert page.locator('#save').is_disabled() and page.locator('#export').is_disabled()
            row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();assert_clean(page)
            assert 'Gjeldende pris: mangler' in page.locator('#reference-dialog').inner_text()
            page.locator('#reference-dialog').get_by_role('button',name='Lukk',exact=True).click()
            page.locator('#project-back').click();assert page.locator('#project-workspace').is_visible();assert saved(page)['snapshot']==previous
            row.locator('[data-field=material]').fill('10');page.locator('#save').click()
            page.locator('#pricing-tab').click()
            csv='prisnokkel;enhet;pris;kilde;dato;valuta;mva\n'+key+';m;5;Test av avtaleprioritet;'+catalog['updated_at'][:10]+';NOK;ekskl\n'
            page.locator('#price-file').set_input_files({'name':'agreement.csv','mimeType':'text/csv','buffer':csv.encode()})
            page.wait_for_function('document.getElementById("price-mode").value==="import"');page.locator('#detailed').click()
            assert row.locator('[data-field=material]').input_value()=='10'
            row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();page.locator('#reference-dialog').get_by_role('button',name='Bruk importert leverandørpris',exact=True).click()
            assert row.locator('[data-field=material]').input_value()=='5'
            row.get_by_role('button',name='Se prisgrunnlag',exact=True).click();page.locator('#reference-dialog').get_by_role('button',name='Bruk markedsreferanse',exact=True).click()
            assert row.locator('[data-field=material]').input_value()=='15.92'
            assert saved(page)['snapshot']['marketBindings'].get(key) is None
            choose(page,key,product)
            assert saved(page)['snapshot']['marketBindings'][key]==product
            page.locator('#pricing-tab').click();page.locator('#price-mode').select_option('market')
            served['offers']=[o for o in served['offers'] if o['id']!=product]
            page.locator('#pricing-tab').click();page.locator('#refresh-prices').click();page.wait_for_function('!document.getElementById("refresh-prices").disabled');page.locator('#detailed').click()
            assert row.locator('[data-field=material]').input_value()==''
            assert page.locator('#export').is_disabled()
            page.locator('#save').click();assert saved(page)['snapshot']['marketBindings'][key]==product
            assert saved(page)['snapshot']['rows'][next(i for i,r in enumerate(saved(page)['snapshot']['rows'])if r.get('priceKey')==key)]['priceBasis']=='product'
            assert_clean(page);report['priceStatePass']=True
        page.screenshot(path=str(output/(project['id']+'-'+view+'.png')),full_page=True)
        assert not errors,errors;report['persistencePass']=True;report['uiErrors']=errors;reports.append(report)
        (output/'projects.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
        print('PASS',view,project['id'],'simple',simple_price,'detailed',total,'difference',round(percent,3),'%',flush=True)
        page.close()
    browser.close()
