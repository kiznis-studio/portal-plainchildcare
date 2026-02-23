import Database from 'better-sqlite3';
import { readFileSync, existsSync, unlinkSync } from 'fs';

const CSV_PATH = '/storage/plainchildcare/raw/ndcp_filtered.csv';
const DB_PATH = '/storage/plainchildcare/plainchildcare.db';

if (!existsSync(CSV_PATH)) {
  console.error('CSV not found:', CSV_PATH);
  process.exit(1);
}

if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log('Removed existing database');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// State abbreviation to name lookup
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico',
};

const STATE_SLUGS = {};
for (const [abbr, name] of Object.entries(STATE_NAMES)) {
  STATE_SLUGS[abbr] = name.toLowerCase().replace(/\s+/g, '-');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Weekly to annual conversion (* 52)
function weeklyToAnnual(val) {
  if (val === null || val === undefined || val === '' || isNaN(val)) return null;
  const n = parseFloat(val);
  if (n <= 0) return null;
  return Math.round(n * 52);
}

function parseNum(val) {
  if (val === null || val === undefined || val === '' || isNaN(val)) return null;
  return parseFloat(val);
}

// Create tables
db.exec(`
  CREATE TABLE counties (
    fips TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    slug TEXT UNIQUE,
    center_infant INTEGER,
    center_toddler INTEGER,
    center_preschool INTEGER,
    center_school_age INTEGER,
    family_infant INTEGER,
    family_toddler INTEGER,
    family_preschool INTEGER,
    family_school_age INTEGER,
    median_income INTEGER,
    poverty_rate REAL,
    population INTEGER,
    latest_year INTEGER
  );

  CREATE TABLE county_history (
    fips TEXT NOT NULL,
    year INTEGER NOT NULL,
    center_infant INTEGER,
    center_toddler INTEGER,
    center_preschool INTEGER,
    center_school_age INTEGER,
    family_infant INTEGER,
    family_toddler INTEGER,
    PRIMARY KEY (fips, year)
  );

  CREATE TABLE states (
    abbr TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    county_count INTEGER DEFAULT 0,
    avg_center_infant INTEGER,
    avg_center_toddler INTEGER,
    avg_center_preschool INTEGER,
    min_center_infant INTEGER,
    max_center_infant INTEGER,
    median_income INTEGER
  );

  CREATE INDEX idx_counties_state ON counties(state);
  CREATE INDEX idx_counties_slug ON counties(slug);
  CREATE INDEX idx_counties_center_infant ON counties(center_infant DESC);
  CREATE INDEX idx_county_history_fips ON county_history(fips);
`);

console.log('Tables created');

// Parse CSV
const csvData = readFileSync(CSV_PATH, 'utf-8');
const lines = csvData.split('\n');
const headers = lines[0].split(',');

// Group data by FIPS, keeping latest year for counties table and all years for history
const countyMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const vals = line.split(',');
  const row = {};
  headers.forEach((h, idx) => { row[h] = vals[idx]; });

  const fips = String(row.COUNTY_FIPS_CODE).padStart(5, '0');
  const year = parseInt(row.STUDYYEAR);
  const stateAbbr = row.STATE_ABBREVIATION;
  const countyName = row.COUNTY_NAME;

  const histEntry = {
    year,
    center_infant: weeklyToAnnual(row.MCINFANT),
    center_toddler: weeklyToAnnual(row.MCTODDLER),
    center_preschool: weeklyToAnnual(row.MCPRESCHOOL),
    center_school_age: weeklyToAnnual(row.MCSA),
    family_infant: weeklyToAnnual(row.MFCCINFANT),
    family_toddler: weeklyToAnnual(row.MFCCTODDLER),
  };

  if (!countyMap.has(fips)) {
    countyMap.set(fips, {
      fips,
      name: countyName,
      state: stateAbbr,
      latestYear: year,
      latestData: null,
      history: [],
      mhi: null,
      povertyRate: null,
    });
  }

  const entry = countyMap.get(fips);
  entry.history.push(histEntry);

  if (year >= entry.latestYear) {
    entry.latestYear = year;
    entry.latestData = {
      center_infant: weeklyToAnnual(row.MCINFANT),
      center_toddler: weeklyToAnnual(row.MCTODDLER),
      center_preschool: weeklyToAnnual(row.MCPRESCHOOL),
      center_school_age: weeklyToAnnual(row.MCSA),
      family_infant: weeklyToAnnual(row.MFCCINFANT),
      family_toddler: weeklyToAnnual(row.MFCCTODDLER),
      family_preschool: weeklyToAnnual(row.MFCCPRESCHOOL),
      family_school_age: weeklyToAnnual(row.MFCCSA),
    };
    entry.mhi = parseNum(row.MHI) ? Math.round(parseNum(row.MHI)) : null;
    entry.povertyRate = parseNum(row.PR_F);
  }
}

console.log('Parsed ' + countyMap.size + ' counties');

// Insert counties
const insertCounty = db.prepare(`
  INSERT INTO counties (fips, name, state, slug, center_infant, center_toddler, center_preschool, center_school_age, family_infant, family_toddler, family_preschool, family_school_age, median_income, poverty_rate, population, latest_year)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT OR IGNORE INTO county_history (fips, year, center_infant, center_toddler, center_preschool, center_school_age, family_infant, family_toddler)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const slugs = new Set();
const insertAll = db.transaction(() => {
  for (const [fips, c] of countyMap) {
    const d = c.latestData;
    if (!d) continue;

    let slug = slugify(c.name + '-' + c.state);
    if (slugs.has(slug)) slug = slugify(c.name + '-' + c.state + '-' + fips);
    slugs.add(slug);

    insertCounty.run(
      fips, c.name, c.state, slug,
      d.center_infant, d.center_toddler, d.center_preschool, d.center_school_age,
      d.family_infant, d.family_toddler, d.family_preschool, d.family_school_age,
      c.mhi, c.povertyRate, null, c.latestYear
    );

    for (const h of c.history) {
      insertHistory.run(fips, h.year, h.center_infant, h.center_toddler, h.center_preschool, h.center_school_age, h.family_infant, h.family_toddler);
    }
  }
});
insertAll();

console.log('Inserted ' + countyMap.size + ' counties and history');

// Build states table from county aggregations
const stateStats = db.prepare(`
  SELECT
    state as abbr,
    COUNT(*) as county_count,
    CAST(AVG(center_infant) AS INTEGER) as avg_center_infant,
    CAST(AVG(center_toddler) AS INTEGER) as avg_center_toddler,
    CAST(AVG(center_preschool) AS INTEGER) as avg_center_preschool,
    MIN(center_infant) as min_center_infant,
    MAX(center_infant) as max_center_infant,
    CAST(AVG(median_income) AS INTEGER) as median_income
  FROM counties
  WHERE center_infant IS NOT NULL
  GROUP BY state
`).all();

const insertState = db.prepare(`
  INSERT INTO states (abbr, name, slug, county_count, avg_center_infant, avg_center_toddler, avg_center_preschool, min_center_infant, max_center_infant, median_income)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const s of stateStats) {
  const name = STATE_NAMES[s.abbr] || s.abbr;
  const slug = STATE_SLUGS[s.abbr] || slugify(s.abbr);
  insertState.run(s.abbr, name, slug, s.county_count, s.avg_center_infant, s.avg_center_toddler, s.avg_center_preschool, s.min_center_infant, s.max_center_infant, s.median_income);
}

console.log('Inserted ' + stateStats.length + ' states');

// Print summary
const totalCounties = db.prepare('SELECT COUNT(*) as c FROM counties').get().c;
const totalHistory = db.prepare('SELECT COUNT(*) as c FROM county_history').get().c;
const totalStates = db.prepare('SELECT COUNT(*) as c FROM states').get().c;
const avgInfant = db.prepare('SELECT AVG(center_infant) as v FROM counties WHERE center_infant IS NOT NULL').get().v;

console.log('\n=== Build Complete ===');
console.log('Counties: ' + totalCounties);
console.log('History rows: ' + totalHistory);
console.log('States: ' + totalStates);
console.log('Avg annual center infant cost: $' + Math.round(avgInfant).toLocaleString());
console.log('Database: ' + DB_PATH);

db.close();
