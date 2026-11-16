// Noms français des sélections nationales → nom utilisé par ESPN (anglais).
// Sert à chercher « Maroc » alors qu'ESPN ne connaît que « Morocco ».
export const COUNTRIES = {
  // Europe
  'Albanie': 'Albania', 'Allemagne': 'Germany', 'Andorre': 'Andorra', 'Angleterre': 'England', 'Arménie': 'Armenia',
  'Autriche': 'Austria', 'Azerbaïdjan': 'Azerbaijan', 'Belgique': 'Belgium', 'Biélorussie': 'Belarus',
  'Bosnie-Herzégovine': 'Bosnia-Herzegovina', 'Bulgarie': 'Bulgaria', 'Chypre': 'Cyprus', 'Croatie': 'Croatia',
  'Danemark': 'Denmark', 'Écosse': 'Scotland', 'Espagne': 'Spain', 'Estonie': 'Estonia', 'Finlande': 'Finland',
  'France': 'France', 'Géorgie': 'Georgia', 'Gibraltar': 'Gibraltar', 'Grèce': 'Greece', 'Hongrie': 'Hungary',
  'Îles Féroé': 'Faroe Islands', 'Irlande': 'Republic of Ireland', 'Irlande du Nord': 'Northern Ireland',
  'Islande': 'Iceland', 'Israël': 'Israel', 'Italie': 'Italy', 'Kazakhstan': 'Kazakhstan', 'Kosovo': 'Kosovo',
  'Lettonie': 'Latvia', 'Liechtenstein': 'Liechtenstein', 'Lituanie': 'Lithuania', 'Luxembourg': 'Luxembourg',
  'Macédoine du Nord': 'North Macedonia', 'Malte': 'Malta', 'Moldavie': 'Moldova', 'Monténégro': 'Montenegro',
  'Norvège': 'Norway', 'Pays de Galles': 'Wales', 'Pays-Bas': 'Netherlands', 'Hollande': 'Netherlands',
  'Pologne': 'Poland', 'Portugal': 'Portugal', 'Tchéquie': 'Czechia', 'République tchèque': 'Czechia',
  'Roumanie': 'Romania', 'Russie': 'Russia', 'Saint-Marin': 'San Marino', 'Serbie': 'Serbia', 'Slovaquie': 'Slovakia',
  'Slovénie': 'Slovenia', 'Suède': 'Sweden', 'Suisse': 'Switzerland', 'Turquie': 'Türkiye', 'Ukraine': 'Ukraine',
  // Afrique
  'Afrique du Sud': 'South Africa', 'Algérie': 'Algeria', 'Angola': 'Angola', 'Bénin': 'Benin', 'Botswana': 'Botswana',
  'Burkina Faso': 'Burkina Faso', 'Burundi': 'Burundi', 'Cameroun': 'Cameroon', 'Cap-Vert': 'Cape Verde',
  'Centrafrique': 'Central African Republic', 'Comores': 'Comoros', 'Congo': 'Congo', 'RD Congo': 'Congo DR',
  'Côte d’Ivoire': 'Ivory Coast', "Côte d'Ivoire": 'Ivory Coast', 'Djibouti': 'Djibouti', 'Égypte': 'Egypt',
  'Érythrée': 'Eritrea', 'Eswatini': 'Eswatini', 'Éthiopie': 'Ethiopia', 'Gabon': 'Gabon', 'Gambie': 'Gambia',
  'Ghana': 'Ghana', 'Guinée': 'Guinea', 'Guinée-Bissau': 'Guinea-Bissau', 'Guinée équatoriale': 'Equatorial Guinea',
  'Kenya': 'Kenya', 'Lesotho': 'Lesotho', 'Liberia': 'Liberia', 'Libye': 'Libya', 'Madagascar': 'Madagascar',
  'Malawi': 'Malawi', 'Mali': 'Mali', 'Maroc': 'Morocco', 'Maurice': 'Mauritius', 'Mauritanie': 'Mauritania',
  'Mozambique': 'Mozambique', 'Namibie': 'Namibia', 'Niger': 'Niger', 'Nigeria': 'Nigeria', 'Ouganda': 'Uganda',
  'Rwanda': 'Rwanda', 'Sao Tomé-et-Principe': 'Sao Tome and Principe', 'Sénégal': 'Senegal', 'Seychelles': 'Seychelles',
  'Sierra Leone': 'Sierra Leone', 'Somalie': 'Somalia', 'Soudan': 'Sudan', 'Soudan du Sud': 'South Sudan',
  'Tanzanie': 'Tanzania', 'Tchad': 'Chad', 'Togo': 'Togo', 'Tunisie': 'Tunisia', 'Zambie': 'Zambia', 'Zimbabwe': 'Zimbabwe',
  // Amériques
  'Argentine': 'Argentina', 'Bolivie': 'Bolivia', 'Brésil': 'Brazil', 'Canada': 'Canada', 'Chili': 'Chile',
  'Colombie': 'Colombia', 'Costa Rica': 'Costa Rica', 'Cuba': 'Cuba', 'Curaçao': 'Curaçao', 'Équateur': 'Ecuador',
  'États-Unis': 'United States', 'Guatemala': 'Guatemala', 'Haïti': 'Haiti', 'Honduras': 'Honduras',
  'Jamaïque': 'Jamaica', 'Mexique': 'Mexico', 'Nicaragua': 'Nicaragua', 'Panama': 'Panama', 'Paraguay': 'Paraguay',
  'Pérou': 'Peru', 'Salvador': 'El Salvador', 'Suriname': 'Suriname', 'Trinité-et-Tobago': 'Trinidad and Tobago',
  'Uruguay': 'Uruguay', 'Venezuela': 'Venezuela', 'Guadeloupe': 'Guadeloupe', 'Martinique': 'Martinique', 'Guyane': 'French Guiana',
  // Asie / Océanie
  'Arabie saoudite': 'Saudi Arabia', 'Australie': 'Australia', 'Bahreïn': 'Bahrain', 'Chine': 'China',
  'Corée du Sud': 'South Korea', 'Corée du Nord': 'North Korea', 'Émirats arabes unis': 'United Arab Emirates',
  'Inde': 'India', 'Indonésie': 'Indonesia', 'Irak': 'Iraq', 'Iran': 'Iran', 'Japon': 'Japan', 'Jordanie': 'Jordan',
  'Koweït': 'Kuwait', 'Kirghizistan': 'Kyrgyz Republic', 'Liban': 'Lebanon', 'Malaisie': 'Malaysia',
  'Nouvelle-Calédonie': 'New Caledonia', 'Nouvelle-Zélande': 'New Zealand', 'Oman': 'Oman', 'Ouzbékistan': 'Uzbekistan',
  'Palestine': 'Palestine', 'Philippines': 'Philippines', 'Qatar': 'Qatar', 'Syrie': 'Syria', 'Tadjikistan': 'Tajikistan',
  'Tahiti': 'Tahiti', 'Thaïlande': 'Thailand', 'Viêt Nam': 'Vietnam', 'Vietnam': 'Vietnam', 'Yémen': 'Yemen',
};

export const norm = x => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').toLowerCase().trim();
const FR = Object.entries(COUNTRIES).map(([fr, en]) => [norm(fr), en]);
const EN_FR = new Map();
for (const [fr, en] of Object.entries(COUNTRIES)) if (!EN_FR.has(en)) EN_FR.set(en, fr); // garde le 1er nom (Pays-Bas, pas Hollande)

// Noms anglais correspondant à ce que l'utilisateur tape (« maroc », « cote d'iv »…). Le nom exact passe en premier.
export function toEnglish(q, max = 2) {
  const n = norm(q); if (n.length < 3) return [];
  const exact = FR.filter(([fr]) => fr === n).map(([, en]) => en);
  const start = FR.filter(([fr]) => fr !== n && fr.startsWith(n)).map(([, en]) => en);
  return [...new Set([...exact, ...start])].slice(0, max);
}
// Nom français d'une sélection (« Morocco » → « Maroc »), ou undefined.
export const toFrench = en => EN_FR.get(en);
