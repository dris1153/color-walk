import facets from '../../src/lib/facets.json' with { type: 'json' };

/**
 * Three facets every source is mapped onto: a year, a kind of object and a
 * region. Each museum names these its own way (the Met alone has 143
 * classifications), so the build reduces them to the short lists in
 * src/lib/facets.json, which the client filters by.
 */
export const KIND_IDS = new Set(facets.kinds.map((k) => k.id));
export const REGION_IDS = new Set(facets.regions.map((r) => r.id));

const MIN_YEAR = -10000;
const MAX_YEAR = 2100;
const usableYear = (n) => Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR;

/** The middle of a dated span. 32% of Met works span more than a century, so
 *  the midpoint is the one year that is fair to both ends. (0, 0) is how the
 *  Met says "undated". */
export function yearFrom(begin, end) {
  // Number(null) is 0, which would read a missing end as the year 0.
  const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));
  const b = num(begin);
  const e = num(end);
  if (b === 0 && e === 0) return null;
  if (usableYear(b) && usableYear(e)) return Math.round((b + e) / 2);
  if (usableYear(b)) return b;
  if (usableYear(e)) return e;
  return null;
}

/** A year, its decade or century suffix, and an era marker after it. */
const DATE_TOKEN = /\b(\d{1,4})(s)?\b(?:\s*(b\.?\s?c\.?(?:\s?e\.?)?|a\.?\s?d\.?|c\.\s?e\.)(?![a-z]))?/gi;

/**
 * The span in a free-text date: "c. 1670 - c. 1700", "1800s", "early 1600s",
 * "664-332 BC", "300 BC - AD 100". A bare number takes the era of the next one
 * that states it, so "664-332 BC" is BCE at both ends. Numbers under 100 count
 * only when an era is stated, so "No. 5" is not a year.
 */
export function yearFromText(text) {
  const tokens = [...String(text ?? '').matchAll(DATE_TOKEN)].map((m) => ({
    n: Number(m[1]),
    plural: Boolean(m[2]),
    era: m[3] ? (/^b/i.test(m[3]) ? 'bc' : 'ad') : null,
  }));
  let carry = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].era) carry = tokens[i].era;
    else tokens[i].era = carry === 'bc' ? 'bc' : null;
  }
  const years = tokens
    .filter((t) => t.n >= 100 || t.era)
    .map((t) => {
      // "1800s" is a century, "1670s" a decade: take the middle of either.
      const y = t.plural ? t.n + (t.n % 100 === 0 ? 50 : 5) : t.n;
      return t.era === 'bc' ? -y : y;
    });
  if (years.length === 0) return null;
  return yearFrom(Math.min(...years), Math.max(...years));
}

/** First match wins, so the narrow patterns sit above the broad ones. */
const MEDIUM_KIND = [
  // Above ceramic, or "oil and glazes on canvas" would be a pot.
  [/\b(oil on|tempera|on canvas|on panel|watercolou?r|gouache)/i, 'painting'],
  [/faience|porcelain|stoneware|earthenware|ceramic|pottery|terracotta|terra cotta|glaze/i, 'ceramic'],
  [/glass/i, 'glass'],
  // Whole words, or "silkscreen" would be a textile.
  [/\b(silk|linen|cotton|wool|velvet|lace|embroidery|embroidered|tapestry|textile)\b/i, 'textile'],
  [/\b(gold|silver|bronze|copper|brass|iron|steel|pewter|electrum|lead)\b/i, 'metal'],
  [/\b(stone|marble|limestone|sandstone|granite|alabaster|ivory|bone|jade|steatite|basalt|diorite|schist|wood)\b/i, 'sculpture'],
];

export const kindFromMedium = (medium) => MEDIUM_KIND.find(([re]) => re.test(String(medium ?? '')))?.[1] ?? null;

const MET_KIND = [
  [/^(paintings|painted canvases|miniatures|screens)/i, 'painting'],
  [/^(drawings|pastels|works on paper)/i, 'drawing'],
  [/^(prints|woodblocks|stencils|rubbing)/i, 'print'],
  [/^(codices|illustrated books|calligraphy|manuscripts)/i, 'book'],
  [/^photograph/i, 'photo'],
  [/^(ceramics|tomb pottery|faience)/i, 'ceramic'],
  [/^glass/i, 'glass'],
  [/^(accessory-jewel|jewelry|beads|ojime)/i, 'jewellery'],
  [/^(textiles|costumes|main dress|accessory|outerwear|underwear|night and dressing|fans)/i, 'textile'],
  [/^(metalwork|metal|coins|medals|mirrors|cloisonn|enamels|arms and armor|horology)/i, 'metal'],
  [/^(sculpture|stucco|netsuke|jade|hardstone|stone|ivor|bone|wood$|plaster|soapstone|amber|horn|shell|masks|seals)/i, 'sculpture'],
];

/** The Met's classification, then, where a department leaves it blank (the
 *  Egyptian and Costume departments often do), the medium. */
export function metKind(o) {
  const cls = String(o?.classification ?? '').trim();
  if (cls) return MET_KIND.find(([re]) => re.test(cls))?.[1] ?? 'other';
  return kindFromMedium(o?.medium) ?? 'other';
}

const CMA_KIND = {
  Painting: 'painting', 'Portrait Miniature': 'painting',
  Drawing: 'drawing',
  Print: 'print', Portfolio: 'print',
  'Bound Volume': 'book', Manuscript: 'book', Calligraphy: 'book',
  Photograph: 'photo',
  Ceramic: 'ceramic',
  Glass: 'glass',
  Woodblock: 'print',
  Textile: 'textile', Lace: 'textile', Embroidery: 'textile', Velvet: 'textile', Garment: 'textile', Tapestry: 'textile', Sampler: 'textile', Carpet: 'textile', Knitting: 'textile',
  Sculpture: 'sculpture', Jade: 'sculpture', Ivory: 'sculpture', Stone: 'sculpture', Wood: 'sculpture', Mask: 'sculpture', Amulets: 'sculpture', Netsuke: 'sculpture', Scarabs: 'sculpture', Glyptic: 'sculpture', Seals: 'sculpture',
  Metalwork: 'metal', 'Arms and Armor': 'metal', Coins: 'metal', Silver: 'metal', Enamel: 'metal',
  Jewelry: 'jewellery',
};

export const cmaKind = (o) => CMA_KIND[o?.type] ?? kindFromMedium(o?.technique) ?? 'other';

/** Matched by position in the text; "American Indian" meets the Americas first. */
const REGION_WORDS = [
  [/\b(etruscan|assyria|babylon|sumer|mesopotamia|hittite|phoenicia|achaemenid|pharaonic|ptolemaic)/i, 'ancient'],
  [/\b(americ|united states|canad|mexic|peru|maya|aztec|inca|olmec|colombia|costa rica|panama|ecuador|bolivia|guatemala|brazil|chile|argentin|caribbean)/i, 'americas'],
  [/\b(china|chinese|japan|japanese|korea|korean|tibet|mongol|taiwan|ryukyu|manchu)/i, 'east-asia'],
  [/\b(india|pakistan|nepal|newar|sri lanka|bangladesh|kashmir|bengal|bhutan|mughal|deccan|rajasthan|gujarat)/i, 'south-asia'],
  [/\b(indonesia|java|bali|sumatra|thai|siam|vietnam|cambodia|khmer|burm|myanmar|laos|philippin|malay|borneo)/i, 'se-asia'],
  [/\b(iran|persia|iraq|syria|turk|ottoman|anatolia|afghan|uzbek|central asia|arab|yemen|egypt|mamluk|safavid|timurid|seljuq|caucas|armenia|azerbai|kazakh|xinjiang)/i, 'west-asia'],
  [/\b(africa|nigeria|congo|ghana|mali\b|benin|yoruba|ethiopia|cameroon|gabon|angola|kenya|tanzania|zimbabwe|senegal|sierra leone|liberia|ivory coast|burkina|sudan)/i, 'africa'],
  [/\b(oceania|papua|new guinea|polynesia|melanesia|micronesia|maori|new zealand|hawai|fiji|samoa|tonga|australia|solomon|vanuatu|marquesas|tahiti)/i, 'oceania'],
  [/\b(europe|france|french|ital|netherland|dutch|flemish|flanders|german|spain|spanish|england|english|british|scot|irish|ireland|austria|swiss|switzerland|belgi|danish|denmark|swed|norw|finland|russia|poland|polish|hungar|bohemia|czech|portug|venice|venetian|florence|byzantine|greek|delft)/i, 'europe'],
];

/** The region named first in the text wins, so "Chinese, for American market"
 *  is Chinese. On a tie of position the list order decides. */
export function regionFromText(text) {
  const s = String(text ?? '');
  let best = null;
  let at = Infinity;
  for (const [re, region] of REGION_WORDS) {
    const index = s.search(re);
    if (index >= 0 && index < at) {
      best = region;
      at = index;
    }
  }
  return best;
}

/** Departments whose region is the department itself, whatever the words say:
 *  "Egypt" means Islamic Cairo in one department and Thebes in another. */
const FIRM = {
  'Egyptian Art': 'ancient',
  'Greek and Roman Art': 'ancient',
  'Ancient Near Eastern Art': 'ancient',
  'Ancient West Asian Art': 'ancient',
  'Egyptian and Ancient Near Eastern Art': 'ancient',
  'The American Wing': 'americas',
  'American Decorative Arts': 'americas',
  'American Painting and Sculpture': 'americas',
  'Art of the Americas': 'americas',
  'Chinese Art': 'east-asia',
  'Japanese Art': 'east-asia',
  'Korean Art': 'east-asia',
  'African Art': 'africa',
};

/** Where the words say nothing, the department's own centre of gravity. */
const FALLBACK = {
  'Asian Art': 'east-asia',
  'Islamic Art': 'west-asia',
  'Indian and Southeast Asian Art': 'south-asia',
  'Arms and Armor': 'europe',
  'European Paintings': 'europe',
  'European Sculpture and Decorative Arts': 'europe',
  'European Painting and Sculpture': 'europe',
  'Modern European Painting and Sculpture': 'europe',
  'Medieval Art': 'europe',
  'The Cloisters': 'europe',
  'The Robert Lehman Collection': 'europe',
  'Musical Instruments': 'europe',
};

/** Department first where it is decisive, then the work's own words, then the
 *  department's default. Null where nothing says. */
export function regionOf(department, text) {
  return FIRM[department] ?? regionFromText(text) ?? FALLBACK[department] ?? null;
}
