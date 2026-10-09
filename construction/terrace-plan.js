import {bounded} from './design-basis.js';
// A geometry/load distribution plan from independently checked span limits.
// It does not calculate the allowable span or assume double members act compositely.
export function planTerrace(p){
 for(const [key,min,max]of [['lengthM',.5,50],['depthM',.5,30],['heightM',0,10],['joistSpanM',.2,10],['beamSpanM',.2,10],['spacingMm',100,1200],['deadKnM2',0,20],['liveKnM2',0,20]])bounded(p[key],key,min,max);
 if(!['documented','free_standing'].includes(p.wallSupport)||typeof p.spanSource!=='string'||p.spanSource.trim().length<10||p.spanSource.length>500)throw Error('Oppgi dokumentasjon for bæring mot huset og de tillatte spennene.');
 const beamBays=Math.ceil(p.depthM/p.joistSpanM),columnBays=Math.ceil(p.lengthM/p.beamSpanM),dy=p.depthM/beamBays,dx=p.lengthM/columnBays;
 if((beamBays+1)*(columnBays+1)>400)throw Error('Planen blir for stor. Del terrassen i mindre felt.');
 const rows=Array.from({length:beamBays+1},(_,i)=>({yM:i*dy,type:i===0&&p.wallSupport==='documented'?'wall':'beam',tributaryM:i===0||i===beamBays?dy/2:dy}));
 const supports=rows.flatMap(row=>row.type==='wall'?[]:Array.from({length:columnBays+1},(_,j)=>{const width=j===0||j===columnBays?dx/2:dx,area=row.tributaryM*width;return {xM:j*dx,yM:row.yM,tributaryAreaM2:area,gkKn:area*p.deadKnM2,qkKn:area*p.liveKnM2};}));
 return {version:1,kind:'terrace_geometry_plan',input:structuredClone(p),rows,supports,beamBayM:dy,columnBayM:dx,beamRowCount:rows.filter(r=>r.type==='beam').length,supportCount:supports.length,joistCount:Math.ceil(p.lengthM/(p.spacingMm/1000))+1,
  status:'layout_only',assumptions:['Rektangulær terrasse uten utkraging. Bjelker på tvers av huset; dragere langs huset.','Hvert felt er enkelt opplagt. Kontinuerlig bjelke får andre oppleggsreaksjoner.','Stolpereaksjoner gjelder jevnt fordelt Gk/Qk, uten medlemsegenvekt, punktlaster, rekkverk, vind eller snø.','Dobbel drager regnes ikke som ett massivt tverrsnitt. Lastfordeling og forbindelser må dokumenteres.'],
  required:['Kontroller bjelkelaget med faktiske dimensjoner, c/c og last per bjelke.','Kontroller hver drager, hver planke og dokumentert lastdeling.','Kontroller stolper med Gk/Qk-reaksjoner, høyde, avstivning og knekkelengder.','Kontroller innfesting, fundament, terrengforhold, vind og eventuell snølast.'],source:p.spanSource};
}
