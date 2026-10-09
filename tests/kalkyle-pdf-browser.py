from portal_test_support import authorize_portal
import json, re, os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont
import fitz
from playwright.sync_api import sync_playwright

base=os.environ.get('RIGOR_TEST_BASE_URL','http://127.0.0.1:8090')
stamp=datetime.now(timezone.utc).isoformat()
valid_until=(datetime.now(timezone.utc)+timedelta(days=60)).date()
def offer(id,name,kind,unit,price,package=1):
    return dict(id=id,chain='obs',name=name,kind=kind,unit=unit,source_id=id,url='https://www.obsbygg.no/test/'+id,checked_at=stamp,availability='https://schema.org/InStock',normalized_ore=round(price*100),original_ore=round(price*package*125),package_price_ex_vat_ore=round(price*package*100),package_quantity=package,vat='inkl',quantity_basis='package' if package>1 else 'unit',original_unit='rull' if package>1 else unit,price_kind='public')
catalog=dict(version=1,updated_at=stamp,sources=[],stores=[],offers=[offer('undertak','Test Undertak 10 m²','membranes','m2',40,10),offer('sloyfer','23x48 Lekt','battens','m',13.2),offer('lekter','36x48 Lekt','battens','m',18)],last_run=dict(finished_at=stamp))
logo_path=Path('/tmp/rigor-test-company-logo.png')
image=Image.new('RGBA',(640,220),(255,255,255,0));draw=ImageDraw.Draw(image)
draw.rectangle((5,35,140,180),fill=(29,96,153,255));draw.text((170,62),'BYGG ÅS',font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',68),fill=(37,40,43,255));image.save(logo_path)
def amount(text):return float(re.sub(r'[^\d,.-]','',text).replace(',','.'))
def download(page,path):
    assert page.locator('#pdf-download').is_enabled(),page.locator('#pdf-validation').inner_text()+' / '+page.locator('#pdf-status').inner_text()
    with page.expect_download(timeout=45000) as item:page.locator('#pdf-download').click()
    item.value.save_as(path)
    page.wait_for_function('!document.getElementById("pdf-download").disabled')
    return fitz.open(path)
def check_pages(document):
    for index,page in enumerate(document):
        text=page.get_text()
        assert f'Side {index+1} av {len(document)}' in text
        images=page.get_image_info();assert images
        assert any(i['bbox'][0]>page.rect.width*.65 and i['bbox'][1]<100 and i['bbox'][3]<150 for i in images),images
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    x0,y0,x1,y1=span['bbox']
                    assert x0>=35 and x1<=page.rect.width-32 and y0>=20 and y1<=page.rect.height-18,(index,span)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page();authorize_portal(page);errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(catalog)))
    page.route('**/ai-estimate-client.js*',lambda r:r.fulfill(content_type='application/javascript',body='export async function assistantStatus(){return false;} export async function requestEstimate(){throw Error("No AI in PDF test");}'))
    page.on('dialog',lambda d:d.accept())
    page.goto(base+'/kalkyle.html');page.locator('#start-simple').click();page.locator('#project-name').fill('Takbytte Ås');page.locator('#project-customer').fill('Kunde Ødegård');page.locator('#project-address').fill('Ærligveien 1');page.locator('#project-submit').click()
    for option in ['removal','cover','rig','waste']:page.locator('#options input[value='+option+']').uncheck()
    page.locator('#basis').select_option('surface');page.locator('#area').fill('30');page.locator('#area').press('Tab')
    page.locator('#rates-tab').click();page.locator('#wage').fill('500');page.locator('#simple').click()
    # A finished offer cannot silently export incomplete prices.
    page.locator('#project-pdf').click();assert page.locator('#pdf-download').is_disabled()
    page.locator('#pdf-company').fill('Bygg Ås AS');page.locator('#pdf-email').fill('post@example.test');page.locator('#pdf-organization').fill('999 999 999')
    page.locator('#pdf-logo-file').set_input_files(str(logo_path));page.wait_for_function('document.getElementById("pdf-logo-preview").src.startsWith("data:image/png")')
    page.locator('#pdf-profile-save').click();assert 'lagret' in page.locator('#pdf-status').inner_text()
    assert page.locator('#pdf-download').is_disabled();page.locator('#pdf-cancel').click()
    tasks=page.locator('#simple-completion .completion-task')
    for name,product in [('Legge undertak','undertak'),('Montere sløyfer','sloyfer'),('Montere lekter','lekter')]:
        tasks.filter(has=page.get_by_role('heading',name=name,exact=True)).get_by_role('button',name='Velg markedsvare',exact=True).click();page.locator('#material-product').select_option(product);page.locator('#material-submit').click()
    # This PDF layout/logo test covers the original three main materials.
    # The separate accessory browser test prices and exports actual screw packs.
    exclude=page.get_by_role('button',name='Tilbehøret inngår ikke / finnes fra før',exact=True)
    while exclude.count():exclude.first.click()
    expected_ex=amount(page.locator('#total').inner_text());expected_gross=amount(page.locator('#gross').inner_text())
    before=page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.rows')
    page.locator('#export-pdf').click();assert page.locator('#pdf-download').is_enabled()
    page.locator('#pdf-scope').fill('Nytt undertak, sløyfer og lekter. Ås, ÆØÅ og m².')
    page.locator('#pdf-terms').fill('Kun de spesifiserte postene inngår. Beslag prises separat.')
    page.locator('#pdf-valid-until').fill(valid_until.isoformat())
    offer_doc=download(page,'/tmp/rigor-tilbud-preview.pdf');check_pages(offer_doc)
    text='\n'.join(p.get_text() for p in offer_doc)
    for value in ['Tilbud','Bygg Ås AS','Kunde Ødegård','Ærligveien 1',valid_until.strftime('%d.%m.%Y'),'Salgskode','Beslag prises separat','Legge undertak','Montere sløyfer','Montere lekter','Materialliste','Test Undertak 10 m²','23x48 Lekt','36x48 Lekt']:assert value in text,value
    for value in ['Kalkulert fortjeneste','Grunnlønn','Timekostnad','Kostnad før påslag','Arbeidskode:']:assert value not in text,value
    expected=lambda value:format(value,',.2f').replace(',',' ').replace('.',',')+' kr'
    assert expected(expected_ex) in text and expected(expected_gross) in text
    offer_doc[0].get_pixmap(dpi=110).save('/tmp/rigor-tilbud-preview.png')
    page.locator('#pdf-type').select_option('calculation');calc_doc=download(page,'/tmp/rigor-beregning-preview.pdf');check_pages(calc_doc)
    text='\n'.join(p.get_text() for p in calc_doc)
    for value in ['Beregning','Grunnlønn','Timekostnad','Beregnet arbeidstid','Materialpåslag','Priskilde','Grunntid','Kalkulert fortjeneste','Materialliste','Test Undertak 10 m²','Varenummer: undertak']:assert value in text,value
    assert expected(expected_ex) in text and expected(expected_gross) in text
    calc_doc[0].get_pixmap(dpi=110).save('/tmp/rigor-beregning-preview.png')
    assert page.evaluate('JSON.parse(window.testReadStorage("rigor-projects-v1"))[0].snapshot.rows')==before
    # Corrupt/spoofed image input must preserve the valid logo.
    saved_logo=page.locator('#pdf-logo-preview').get_attribute('src')
    page.locator('#pdf-logo-file').set_input_files({'name':'spoof.png','mimeType':'image/png','buffer':b'<svg onload="alert(1)"/>'})
    page.wait_for_function('document.getElementById("pdf-status").textContent.includes("bildefil")')
    assert page.locator('#pdf-logo-preview').get_attribute('src')==saved_logo
    # Local-storage quota must not prevent a valid PDF download or erase saved branding.
    stored_profile=page.evaluate('window.testReadStorage("rigor-document-profile-v1")')
    page.locator('#pdf-company').fill('Bygg med full lagringsplass')
    page.evaluate('()=>{window.testStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("quota");};}')
    quota_pdf=download(page,'/tmp/rigor-pdf-quota.pdf');assert 'Bygg med full lagringsplass' in quota_pdf[0].get_text()
    assert 'kunne ikke lagres' in page.locator('#pdf-status').inner_text()
    assert page.evaluate('window.testReadStorage("rigor-document-profile-v1")')==stored_profile
    page.evaluate('()=>{Storage.prototype.setItem=window.testStorageWrite;}')
    page.locator('#pdf-cancel').click();page.locator('#project-back').click();page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();page.locator('#project-pdf').click()
    assert page.locator('#pdf-company').input_value()=='Bygg Ås AS' and page.locator('#pdf-logo-preview').get_attribute('src')==saved_logo
    assert page.locator('#pdf-terms').input_value().endswith('separat.')
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#pdf-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    page.screenshot(path='/tmp/rigor-pdf-dialog-mobile.png',full_page=True);page.set_viewport_size({'width':1440,'height':1000});page.locator('#pdf-cancel').click();page.locator('#project-back').click()
    # Real multipage export: long names, final rows, disabled rows and all footers.
    page.evaluate('''()=>{const key=window.testAccountKey(),record=JSON.parse(localStorage.getItem(key)),projects=JSON.parse(record.entries['rigor-projects-v1']),base=projects[0].snapshot.rows.find(r=>r.enabled);projects[0].snapshot.rows=Array.from({length:45},(_,i)=>({...base,id:'long-'+i,taskKey:'test.task.'+i,priceKey:'test.material',manualPrice:true,manualPriceSource:'PDF layout test',elementId:'group-'+Math.floor(i/5),elementName:'Langt bygningselement for kontroll av sideskift og flere oppgaver '+Math.floor(i/5),name:'Post '+(i+1)+' - ÆØÅ med en lang beskrivelse for automatisk linjebryting i et ferdig kundetilbud',manualTime:true}));projects[0].snapshot.rows.push({...base,id:'excluded',enabled:false,name:'Skal ikke eksporteres'});record.entries['rigor-projects-v1']=JSON.stringify(projects);localStorage.setItem(key,JSON.stringify(record));}''')
    page.reload();page.get_by_role('button',name='Åpne prosjekt',exact=True).click();page.locator('#project-pdf').click();page.locator('#pdf-type').select_option('offer')
    multi=download(page,'/tmp/rigor-tilbud-multipage.pdf');assert len(multi)>=3;check_pages(multi)
    text='\n'.join(p.get_text() for p in multi);assert 'Post 45' in text and 'Skal ikke eksporteres' not in text
    page.locator('#pdf-type').select_option('calculation');internal=download(page,'/tmp/rigor-beregning-multipage.pdf');assert len(internal)>len(multi);check_pages(internal)
    assert 'Post 45' in '\n'.join(p.get_text() for p in internal)
    page.locator('#pdf-cancel').click()
    # Two verified accounts on the same browser get independent branding and project lists.
    other=context.new_page();authorize_portal(other,user_id='other-account');other.route('**/data/market-prices.json*',lambda r:r.fulfill(content_type='application/json',body=json.dumps(catalog)))
    other.goto(base+'/kalkyle.html');assert other.get_by_role('button',name='Åpne prosjekt',exact=True).count()==0
    other.locator('#start-detailed').click();other.locator('#project-name').fill('Annen bruker');other.locator('#project-submit').click();other.locator('#project-pdf').click()
    assert other.locator('#pdf-company').input_value()=='' and other.locator('#pdf-logo-preview').is_hidden()
    assert not errors,errors
    assert not any('api.openai.com' in r or 'cdn.' in r for r in requests)
    print('PASS: actual PDF download, private sender/logo persistence, correct prices and VAT, offer privacy, calculation hours/costs/codes, incomplete-data block, invalid logo preservation, mobile, multipage content/logo/footer and account isolation')
    browser.close()
