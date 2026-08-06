// Mapiranje grad → županija/kanton/okrug (samo za prikaz, ne mijenja spremljeni "city").
// HR: stvarne županije. BA: stvarni kantoni Federacije BiH. RS: stvarni okruzi.
// Gradovi bez jasnog mapiranja (npr. RS entitet u BiH nema kantone) padaju na sam grad
// kao fallback - vidljivo označeno ispod.
const CITY_TO_COUNTY_HR = {
  zagreb: 'Grad Zagreb',
  split: 'Splitsko-dalmatinska',
  rijeka: 'Primorsko-goranska',
  osijek: 'Osječko-baranjska',
  zadar: 'Zadarska',
  pula: 'Istarska',
  dubrovnik: 'Dubrovačko-neretvanska',
  šibenik: 'Šibensko-kninska',
  sibenik: 'Šibensko-kninska',
  varaždin: 'Varaždinska',
  varazdin: 'Varaždinska',
  karlovac: 'Karlovačka',
};
// BA: kantoni postoje samo u Federaciji BiH. Banja Luka/Bijeljina/Prijedor/Doboj su u
// entitetu Republika Srpska, koji nema kantone - stranica bosna.html trenutno nema tu
// opciju u popisu regija, pa ti gradovi padaju na fallback (ime grada).
const CITY_TO_COUNTY_BA = {
  sarajevo: 'Sarajevo',
  mostar: 'Hercegovačko-neretvanski',
  zenica: 'Zeničko-dobojski',
  bihać: 'Unsko-sanski',
  bihac: 'Unsko-sanski',
  travnik: 'Srednjobosanski',
};
// RS: okruzi Srbije
const CITY_TO_COUNTY_RS = {
  beograd: 'Beograd', zemun: 'Beograd', 'novi beograd': 'Beograd',
  bor: 'Bor', negotin: 'Bor', majdanpek: 'Bor', kladovo: 'Bor',
  požarevac: 'Braničevo', pozarevac: 'Braničevo', 'veliko gradište': 'Braničevo', 'veliko gradiste': 'Braničevo', golubac: 'Braničevo', žagubica: 'Braničevo', zagubica: 'Braničevo',
  zaječar: 'Zaječar', zajecar: 'Zaječar', knjaževac: 'Zaječar', knjazevac: 'Zaječar', boljevac: 'Zaječar', sokobanja: 'Zaječar',
  sombor: 'Zapadna Bačka', apatin: 'Zapadna Bačka', kula: 'Zapadna Bačka', odžaci: 'Zapadna Bačka', odzaci: 'Zapadna Bačka',
  'novi sad': 'Južna Bačka', 'bačka palanka': 'Južna Bačka', 'backa palanka': 'Južna Bačka', vrbas: 'Južna Bačka', žabalj: 'Južna Bačka', zabalj: 'Južna Bačka', srbobran: 'Južna Bačka', temerin: 'Južna Bačka', beočin: 'Južna Bačka', beocin: 'Južna Bačka',
  pančevo: 'Južni Banat', pancevo: 'Južni Banat', vršac: 'Južni Banat', vrsac: 'Južni Banat', kovin: 'Južni Banat', kovačica: 'Južni Banat', kovacica: 'Južni Banat', alibunar: 'Južni Banat', 'bela crkva': 'Južni Banat', opovo: 'Južni Banat', plandište: 'Južni Banat', plandiste: 'Južni Banat',
  užice: 'Zlatibor', uzice: 'Zlatibor', zlatibor: 'Zlatibor', čajetina: 'Zlatibor', cajetina: 'Zlatibor', priboj: 'Zlatibor', prijepolje: 'Zlatibor', 'nova varoš': 'Zlatibor', 'nova varos': 'Zlatibor', sjenica: 'Zlatibor', arilje: 'Zlatibor', kosjerić: 'Zlatibor', kosjeric: 'Zlatibor',
  valjevo: 'Kolubara', ub: 'Kolubara', lajkovac: 'Kolubara', ljig: 'Kolubara', mionica: 'Kolubara', osečina: 'Kolubara', osecina: 'Kolubara',
  šabac: 'Mačva', sabac: 'Mačva', loznica: 'Mačva', bogatić: 'Mačva', bogatic: 'Mačva', vladimirci: 'Mačva', koceljeva: 'Mačva', 'mali zvornik': 'Mačva',
  čačak: 'Moravica', cacak: 'Moravica', ivanjica: 'Moravica', 'gornji milanovac': 'Moravica', lučani: 'Moravica', lucani: 'Moravica',
  niš: 'Nišava', nis: 'Nišava', aleksinac: 'Nišava', doljevac: 'Nišava', 'gadžin han': 'Nišava', 'gadzin han': 'Nišava', merošina: 'Nišava', merosina: 'Nišava', ražanj: 'Nišava', razanj: 'Nišava', svrljig: 'Nišava',
  vranje: 'Pčinja', bujanovac: 'Pčinja', 'vladičin han': 'Pčinja', 'vladicin han': 'Pčinja', preševo: 'Pčinja', presevo: 'Pčinja', surdulica: 'Pčinja', trgovište: 'Pčinja', trgoviste: 'Pčinja',
  pirot: 'Pirot', babušnica: 'Pirot', babusnica: 'Pirot', 'bela palanka': 'Pirot', dimitrovgrad: 'Pirot',
  smederevo: 'Podunavlje', 'smederevska palanka': 'Podunavlje', 'velika plana': 'Podunavlje',
  jagodina: 'Pomoravlje', ćuprija: 'Pomoravlje', cuprija: 'Pomoravlje', paraćin: 'Pomoravlje', paracin: 'Pomoravlje', rekovac: 'Pomoravlje', svilajnac: 'Pomoravlje', despotovac: 'Pomoravlje',
  'novi pazar': 'Raška', kraljevo: 'Raška', tutin: 'Raška', raška: 'Raška', raska: 'Raška',
  kruševac: 'Rasina', krusevac: 'Rasina', brus: 'Rasina', aleksandrovac: 'Rasina', varvarin: 'Rasina', ćićevac: 'Rasina', cicevac: 'Rasina', trstenik: 'Rasina', 'vrnjačka banja': 'Rasina', 'vrnjacka banja': 'Rasina',
  subotica: 'Severna Bačka', 'bačka topola': 'Severna Bačka', 'backa topola': 'Severna Bačka', 'mali iđoš': 'Severna Bačka', 'mali idjos': 'Severna Bačka',
  kikinda: 'Severni Banat', ada: 'Severni Banat', 'novi kneževac': 'Severni Banat', 'novi knezevac': 'Severni Banat', čoka: 'Severni Banat', coka: 'Severni Banat', senta: 'Severni Banat',
  zrenjanin: 'Srednji Banat', žitište: 'Srednji Banat', zitiste: 'Srednji Banat', 'nova crnja': 'Srednji Banat', 'novi bečej': 'Srednji Banat', 'novi becej': 'Srednji Banat', sečanj: 'Srednji Banat', secanj: 'Srednji Banat',
  'sremska mitrovica': 'Srem', ruma: 'Srem', inđija: 'Srem', indjija: 'Srem', 'stara pazova': 'Srem', pećinci: 'Srem', pecinci: 'Srem', šid: 'Srem', sid: 'Srem', irig: 'Srem',
  kragujevac: 'Šumadija', aranđelovac: 'Šumadija', arandjelovac: 'Šumadija', batočina: 'Šumadija', batocina: 'Šumadija', knić: 'Šumadija', knic: 'Šumadija', lapovo: 'Šumadija', rača: 'Šumadija', raca: 'Šumadija', topola: 'Šumadija',
  prokuplje: 'Toplica', kuršumlija: 'Toplica', kursumlija: 'Toplica', blace: 'Toplica', žitorađa: 'Toplica', zitoradja: 'Toplica',
  leskovac: 'Jablanica', vlasotince: 'Jablanica', lebane: 'Jablanica', bojnik: 'Jablanica', medveđa: 'Jablanica', medvedja: 'Jablanica', 'crna trava': 'Jablanica',
};
const MAPS = { hr: CITY_TO_COUNTY_HR, ba: CITY_TO_COUNTY_BA, rs: CITY_TO_COUNTY_RS };
function getRegion(country, city) {
  if (!city) return null;
  const key = String(city).trim().toLowerCase();
  const map = MAPS[country];
  if (map && map[key]) return map[key];
  return capitalize(city); // fallback - grad bez poznatog mapiranja na regiju
}
function capitalize(s) {
  const str = String(s);
  return str.charAt(0).toUpperCase() + str.slice(1);
}
module.exports = { getRegion, CITY_TO_COUNTY_HR, CITY_TO_COUNTY_BA, CITY_TO_COUNTY_RS };