import {readFileSync} from 'node:fs';
export const evidence=name=>JSON.parse(readFileSync(new URL('./fixtures/evidence/'+name+'-2026-10-09.json',import.meta.url),'utf8'));
export function evidenceHtml(fixture){
 const raw=fixture.raw;
 return raw.jsonLd.map(value=>'<script type="application/ld+json">'+JSON.stringify(value)+'</script>').join('\n')+'\n<script>window.CURRENT_PAGE = '+JSON.stringify(raw.currentPage)+';</script>\n'+raw.priceSection+'<section>'+String(raw.currentPage.productControlText||'').replaceAll('&','&amp;').replaceAll('<','&lt;')+'</section>';
}
