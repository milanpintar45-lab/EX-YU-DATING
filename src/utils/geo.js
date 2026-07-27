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
  beograd: 'Beograd',
  'novi sad': 'Južna Bačka',
  niš: 'Nišava',
  nis: 'Nišava',
  kragujevac: 'Šumadija',
  subotica: 'Severna Bačka',
  zrenjanin: 'Srednji Banat',
  pančevo: 'Južni Banat',
  pancevo: 'Južni Banat',
  čačak: 'Moravica',
  cacak: 'Moravica',
  'novi pazar': 'Raška',
  kraljevo: 'Raška',
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
