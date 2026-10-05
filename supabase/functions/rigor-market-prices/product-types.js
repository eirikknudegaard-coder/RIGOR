// Required comparison attributes, never inferred from a product's name.
export const productTypes={
 timber:{name:'Konstruksjonsvirke',unit:'m',fields:['width','height','strength','material','treatment','profile']},
 battens:{name:'Sløyfer og lekter',unit:'m',fields:['width','height','material','treatment','strength']},
 decking:{name:'Terrassebord',unit:'m',fields:['width','height','material','treatment','profile']},
 cladding:{name:'Ytterkledning',unit:'m',fields:['width','height','material','treatment','profile','coverage_width']},
 gypsum:{name:'Gipsplater',unit:'m2',fields:['thickness','width','length','board_type','edge']},
 boards:{name:'OSB, spon og vindsperreplater',unit:'m2',fields:['thickness','width','length','material','board_type','application','edge']},
 insulation:{name:'Isolasjon',unit:'m2',fields:['thickness','lambda','application','material']},
 membranes:{name:'Undertak, vindsperre og dampsperre',unit:'m2',fields:['product_type','application','material','sd_value','system']},
 roofing:{name:'Taktekking',unit:'m2',fields:['material','profile','thickness','coverage_width','system','finish']},
 tape:{name:'Tape og tetting',unit:'m',fields:['width','product_type','application','system']},
 fasteners:{name:'Skruer og spiker',unit:'stk',fields:['product_type','diameter','length','material','coating','application']},
 hardware:{name:'Beslag og innfesting',unit:'stk',fields:['product_type','dimensions','material','coating','load_class']},
 trim:{name:'Listverk og utforinger',unit:'m',fields:['width','height','material','profile','finish']},
 flooring:{name:'Gulv',unit:'m2',fields:['product_type','thickness','material','wear_class','finish','installation']},
 windows:{name:'Vinduer',unit:'stk',fields:['width','height','material','u_value','opening','glazing']},
 doors:{name:'Dører',unit:'stk',fields:['width','height','material','application','fire_class','sound_class','finish']}
};
export function specificationIssues(kind,specs){const type=productTypes[kind];if(!type)return ['Ukjent produkttype'];return type.fields.filter(k=>specs?.[k]===undefined||specs[k]===null||String(specs[k]).trim()===''||/^(ukjent|unknown|\?)$/i.test(String(specs[k]).trim())).map(k=>'Mangler '+k);}
