export default {
 id:'roof',matches:/\b(tak|saltak|pulttak|valmtak|mansardtak|undertak|sutak|takstein)\b/i,
 sequence:['Riving hvis bestilt','Kontroll av eksisterende underlag','Undertak / taktro','Sløyfer og lekter til valgt tekking','Tekking','Møne, vindskier, beslag og gjennomføringer','Takrenner og nedløp','Stillas, sikring og avfall'],
 assumptions:['Ved manglende arealgrunnlag behandles oppgitt takareal foreløpig som målt takflate.','Normal tilkomst; beslag og lengdebaserte detaljer prises bare med oppgitt mengde eller dokumentert avsetning.'],
 cautions:['Takvinkel og produktets monteringsanvisning bestemmer egnet tekking.','Bærende endringer og uklare mansardflater krever egen avklaring; areal alene gir ingen lengder eller antall.'],
 guidance:'Sutak betyr undertak, sløfyer betyr sløyfer, vannrenner betyr takrenner. Behold takstoler hvis brukeren sier dette. Ikke utled mønelengde eller takrennelengde fra m².',sources:[]
};
