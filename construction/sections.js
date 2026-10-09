// Nominal inch descriptions must be confirmed as actual metric dimensions.
export const nominalSuggestions={'2x6':{widthMm:48,heightMm:148},'2x8':{widthMm:48,heightMm:198}};
export function rectangle(widthMm,heightMm){
 if(!Number.isFinite(widthMm)||!Number.isFinite(heightMm)||widthMm<10||widthMm>2000||heightMm<10||heightMm>3000)throw Error('Oppgi faktisk bredde og høyde i millimeter.');
 const b=widthMm/1000,h=heightMm/1000;
 return {type:'rectangle',widthMm,heightMm,areaM2:b*h,iM4:b*h**3/12,wM3:b*h*h/6,formulas:['A = b·h','I = b·h³/12','W = b·h²/6'],axis:'Høyden er den vertikale dimensjonen. Ingen samvirkning mellom flere deler er forutsatt.'};
}
