const NS='http://www.w3.org/2000/svg';
function el(tag,attributes={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attributes))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
function root(label,width,height){const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':label});svg.append(el('title',{},label));return svg;}
function line(svg,x1,y1,x2,y2,extra={}){svg.append(el('line',{x1,y1,x2,y2,stroke:'currentColor','stroke-width':1.5,...extra}));}
const text=(svg,x,y,value,extra={})=>svg.append(el('text',{x,y,'font-size':13,'text-anchor':'middle',fill:'currentColor',...extra},value));
const fmt=n=>new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(n);
export function renderLoadPath(container,path){
 const h=path.nodes.length*72+15,svg=root('Oppgitt og mulig lastvei fra last til fundament',360,h);
 path.nodes.forEach((name,i)=>{const y=12+i*72;svg.append(el('rect',{x:24,y,width:312,height:48,rx:9,fill:i===2?'#f0e2d3':'#fffdf9',stroke:'#cfc0b0'}));text(svg,180,y+29,name);if(i<path.nodes.length-1){line(svg,180,y+48,180,y+68,{'stroke-dasharray':path.edges[i]?.status==='KNOWN'?'':'4 3'});svg.append(el('path',{d:`M 175 ${y+61} L 180 ${y+68} L 185 ${y+61}`,fill:'none',stroke:'currentColor'}));}});
 container.replaceChildren(svg);
}
export function renderBeam(container,beam){
 const svg=root('Bjelke med beregnede laster og oppleggsreaksjoner',720,230),left=70,right=650,L=beam.spanM,y=128,x=m=>left+(right-left)*m/L;
 line(svg,left,y,right,y,{'stroke-width':7});
 if(beam.loads.qNPerM>0){for(let i=0;i<11;i++){const a=left+i*(right-left)/10;line(svg,a,55,a,y-12);svg.append(el('path',{d:`M ${a-4} ${y-20} L ${a} ${y-12} L ${a+4} ${y-20}`,fill:'none',stroke:'currentColor'}));}text(svg,360,36,fmt(beam.loads.qNPerM/1000)+' kN/m');}
 for(const p of beam.loads.points){line(svg,x(p.xM),55,x(p.xM),y-12,{'stroke-width':3});text(svg,x(p.xM),beam.loads.qNPerM>0?16:35,fmt(p.forceN/1000)+' kN');}
 if(beam.system==='simple'){
  for(const a of [left,right])svg.append(el('path',{d:`M ${a} ${y+4} L ${a-12} ${y+26} L ${a+12} ${y+26} Z`,fill:'#f0e2d3',stroke:'currentColor'}));
  text(svg,left,y+53,fmt(beam.reactions.leftN/1000)+' kN ↑');text(svg,right,y+53,fmt(beam.reactions.rightN/1000)+' kN ↑');
 }else {line(svg,left,y-25,left,y+26,{'stroke-width':5});for(let i=-20;i<25;i+=9)line(svg,left-12,y+i+7,left,y+i);text(svg,left+12,y+53,fmt(beam.reactions.leftN/1000)+' kN ↑',{'text-anchor':'start'});text(svg,left+12,y+73,fmt(beam.reactions.fixedMomentNm/1000)+' kNm ↶',{'text-anchor':'start'});}
 text(svg,360,216,'Spenn '+fmt(L)+' m');container.replaceChildren(svg);
}
function plot(beam,key,scale,label,unit){
 const svg=root(label,720,210),left=65,right=670,top=24,bottom=154,values=beam.samples.map(s=>s[key]*scale),min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;
 const downward=key==='deflectionM',x=m=>left+(right-left)*m/beam.spanM,y=v=>downward?top+(v-min)/range*(bottom-top):bottom-(v-min)/range*(bottom-top),zero=y(0);
 line(svg,left,zero,right,zero,{stroke:'#bab2a9'});line(svg,left,top,left,bottom,{stroke:'#bab2a9'});
 const d=beam.samples.map((s,i)=>(i?'L':'M')+' '+x(s.xM).toFixed(4)+' '+y(s[key]*scale).toFixed(4)).join(' ');
 svg.append(el('path',{d,fill:'none',stroke:'#866046','stroke-width':2.5}));
 text(svg,52,top+4,fmt(downward?min:max),{'text-anchor':'end','font-size':11});text(svg,52,bottom+4,fmt(downward?max:min),{'text-anchor':'end','font-size':11});text(svg,42,190,unit,{'text-anchor':'end','font-size':11});
 text(svg,left,180,'0 m');text(svg,right,180,fmt(beam.spanM)+' m');text(svg,360,205,label,{'font-size':12});return svg;
}
export function renderDiagrams(container,beam){
 const diagrams=[plot(beam,'shearN',.001,'Skjærkraft – positiv oppover på venstre snittside','kN'),plot(beam,'momentNm',.001,'Moment – positiv verdi gir strekk på undersiden','kNm')];
 if(beam.maxDeflection)diagrams.push(plot(beam,'deflectionM',1000,'Nedbøyning – positiv verdi nedover','mm'));
 container.replaceChildren(...diagrams);
}
