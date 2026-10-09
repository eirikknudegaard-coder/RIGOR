// Reviewed register v1, 2026-10-08. Mean E is for instantaneous deformation,
// not a design strength. No k_mod, gamma_M or steel thickness factors assumed.
const timberSource='https://www.swedishwood.com/siteassets/5-publikationer/pdfer/sw-design-of-timber-structures-vol2-2022.pdf';
export const materials=Object.freeze({
 C24:Object.freeze({id:'C24',name:'Konstruksjonsvirke C24',ePa:11e9,densityKgM3:420,source:timberSource,reference:'Svenskt Trä, Design of timber structures vol. 2 (2022), tabell 3.3, s. 10; EN 338:2016. E₀,mean = 11 000 MPa, ρmean = 420 kg/m³.'}),
 GL30c:Object.freeze({id:'GL30c',name:'Limtre GL30c',ePa:13e9,densityKgM3:430,source:timberSource,reference:'Svenskt Trä, Design of timber structures vol. 2 (2022), tabell 3.4, s. 12; EN 14080:2013. E₀,mean = 13 000 MPa, ρmean = 430 kg/m³.'}),
 S355:Object.freeze({id:'S355',name:'Stål S355, massivt rektangel',ePa:210e9,densityKgM3:7850,source:'https://www.steelconstruction.info/Steel_material_properties',densitySource:'https://www.engineeringtoolbox.com/metal-alloys-densities-d_50.html',reference:'SteelConstruction.info, Steel material properties, Other mechanical properties: E = 210 000 MPa. Engineering ToolBox, Metals and Alloys - Densities: Steel = 7 850 kg/m³. Ingen flytegrense eller profilkapasitet brukes.'})
});
export function materialFor(id){return materials[id]||null;}
