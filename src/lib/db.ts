// PlainChildcare D1 query library
// All functions accept D1Database as first param — NEVER at module scope

// --- Interfaces ---

export interface County {
  fips: string;
  name: string;
  state: string;
  slug: string;
  center_infant: number | null;
  center_toddler: number | null;
  center_preschool: number | null;
  center_school_age: number | null;
  family_infant: number | null;
  family_toddler: number | null;
  family_preschool: number | null;
  family_school_age: number | null;
  median_income: number | null;
  poverty_rate: number | null;
  population: number | null;
  latest_year: number;
}

export interface CountyHistory {
  fips: string;
  year: number;
  center_infant: number | null;
  center_toddler: number | null;
  center_preschool: number | null;
  center_school_age: number | null;
  family_infant: number | null;
  family_toddler: number | null;
}

export interface StateInfo {
  abbr: string;
  name: string;
  slug: string;
  county_count: number;
  avg_center_infant: number | null;
  avg_center_toddler: number | null;
  avg_center_preschool: number | null;
  min_center_infant: number | null;
  max_center_infant: number | null;
  median_income: number | null;
}

// --- State Lookup ---

const STATE_NAMES: Record<string, string> = {
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
  DC: 'District of Columbia',
};

export function getStateName(abbr: string): string {
  return STATE_NAMES[abbr.toUpperCase()] || abbr;
}

// --- Helpers ---

export function formatCost(amount: number | null): string {
  if (amount === null || amount === undefined) return 'N/A';
  return '$' + Math.round(amount).toLocaleString();
}

export function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString();
}

export function affordabilityRatio(cost: number | null, income: number | null): string {
  if (!cost || !income || income === 0) return 'N/A';
  return ((cost / income) * 100).toFixed(1) + '%';
}

// --- Counties ---

export async function getCountyBySlug(db: D1Database, slug: string): Promise<County | null> {
  return db.prepare('SELECT * FROM counties WHERE slug = ?').bind(slug).first<County>();
}

export async function getCountiesByState(db: D1Database, state: string, limit = 200): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE state = ? ORDER BY name COLLATE NOCASE LIMIT ?'
  ).bind(state, limit).all<County>();
  return results;
}

export async function getCountyHistory(db: D1Database, fips: string): Promise<CountyHistory[]> {
  const { results } = await db.prepare(
    'SELECT * FROM county_history WHERE fips = ? ORDER BY year'
  ).bind(fips).all<CountyHistory>();
  return results;
}

// --- States ---

export async function getAllStates(db: D1Database): Promise<StateInfo[]> {
  const { results } = await db.prepare('SELECT * FROM states ORDER BY name COLLATE NOCASE').all<StateInfo>();
  return results;
}

export async function getStateBySlug(db: D1Database, slug: string): Promise<StateInfo | null> {
  return db.prepare('SELECT * FROM states WHERE slug = ?').bind(slug).first<StateInfo>();
}

// --- Rankings ---

export async function getMostExpensiveCounties(db: D1Database, limit = 25): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE center_infant IS NOT NULL ORDER BY center_infant DESC LIMIT ?'
  ).bind(limit).all<County>();
  return results;
}

export async function getLeastExpensiveCounties(db: D1Database, limit = 25): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE center_infant IS NOT NULL AND center_infant > 0 ORDER BY center_infant ASC LIMIT ?'
  ).bind(limit).all<County>();
  return results;
}

export async function getLeastAffordableCounties(db: D1Database, limit = 25): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE center_infant IS NOT NULL AND median_income IS NOT NULL AND median_income > 0 ORDER BY (CAST(center_infant AS REAL) / median_income) DESC LIMIT ?'
  ).bind(limit).all<County>();
  return results;
}

export async function getMostAffordableCounties(db: D1Database, limit = 25): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE center_infant IS NOT NULL AND center_infant > 0 AND median_income IS NOT NULL AND median_income > 0 ORDER BY (CAST(center_infant AS REAL) / median_income) ASC LIMIT ?'
  ).bind(limit).all<County>();
  return results;
}

// --- State-Scoped Rankings ---

export async function getCheapestCountiesByState(db: D1Database, stateAbbr: string, limit = 50): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE state = ? AND center_infant IS NOT NULL AND center_infant > 0 ORDER BY center_infant ASC LIMIT ?'
  ).bind(stateAbbr, limit).all<County>();
  return results;
}

export async function getMostExpensiveCountiesByState(db: D1Database, stateAbbr: string, limit = 50): Promise<County[]> {
  const { results } = await db.prepare(
    'SELECT * FROM counties WHERE state = ? AND center_infant IS NOT NULL ORDER BY center_infant DESC LIMIT ?'
  ).bind(stateAbbr, limit).all<County>();
  return results;
}

// --- Search ---

export async function searchCounties(db: D1Database, query: string, limit = 20): Promise<County[]> {
  const like = '%' + query.trim() + '%';
  const { results } = await db.prepare(`
    SELECT * FROM counties
    WHERE name LIKE ? OR state LIKE ? OR fips = ?
    ORDER BY population DESC
    LIMIT ?
  `).bind(like, like, query.trim(), limit).all<County>();
  return results;
}

// --- Calculator Data ---

export async function getCountyDataForCalculator(db: D1Database, fips: string): Promise<County | null> {
  return db.prepare('SELECT * FROM counties WHERE fips = ?').bind(fips).first<County>();
}

export async function searchCountiesForCalculator(db: D1Database, query: string, limit = 10): Promise<Array<{ fips: string; name: string; state: string; slug: string }>> {
  const like = '%' + query.trim() + '%';
  const { results } = await db.prepare(`
    SELECT fips, name, state, slug FROM counties
    WHERE name LIKE ? OR state LIKE ?
    ORDER BY population DESC
    LIMIT ?
  `).bind(like, like, limit).all<{ fips: string; name: string; state: string; slug: string }>();
  return results;
}

// --- Affordability Desert ---

export interface DesertCounty extends County {
  cost_burden_pct: number;
}

export async function getAffordabilityDeserts(db: D1Database, limit = 100): Promise<DesertCounty[]> {
  const { results } = await db.prepare(`
    SELECT *, ROUND(CAST(center_infant AS REAL) / median_income * 100, 1) as cost_burden_pct
    FROM counties
    WHERE center_infant IS NOT NULL AND median_income IS NOT NULL AND median_income > 0
      AND (CAST(center_infant AS REAL) / median_income * 100) > 20
    ORDER BY (CAST(center_infant AS REAL) / median_income) DESC
    LIMIT ?
  `).bind(limit).all<DesertCounty>();
  return results;
}

export async function getAffordabilityDesertsByState(db: D1Database, stateAbbr: string, limit = 100): Promise<DesertCounty[]> {
  const { results } = await db.prepare(`
    SELECT *, ROUND(CAST(center_infant AS REAL) / median_income * 100, 1) as cost_burden_pct
    FROM counties
    WHERE state = ? AND center_infant IS NOT NULL AND median_income IS NOT NULL AND median_income > 0
    ORDER BY (CAST(center_infant AS REAL) / median_income) DESC
    LIMIT ?
  `).bind(stateAbbr, limit).all<DesertCounty>();
  return results;
}

export interface DesertStateSummary {
  abbr: string;
  name: string;
  slug: string;
  county_count: number;
  desert_count: number;
  desert_pct: number;
  avg_cost_burden: number;
  worst_burden: number;
}

export async function getDesertSummaryByState(db: D1Database): Promise<DesertStateSummary[]> {
  const { results } = await db.prepare(`
    SELECT
      s.abbr, s.name, s.slug, s.county_count,
      COUNT(CASE WHEN (CAST(c.center_infant AS REAL) / c.median_income * 100) > 20 THEN 1 END) as desert_count,
      ROUND(COUNT(CASE WHEN (CAST(c.center_infant AS REAL) / c.median_income * 100) > 20 THEN 1 END) * 100.0 / COUNT(*), 1) as desert_pct,
      ROUND(AVG(CAST(c.center_infant AS REAL) / c.median_income * 100), 1) as avg_cost_burden,
      ROUND(MAX(CAST(c.center_infant AS REAL) / c.median_income * 100), 1) as worst_burden
    FROM states s
    JOIN counties c ON c.state = s.abbr
    WHERE c.center_infant IS NOT NULL AND c.median_income IS NOT NULL AND c.median_income > 0
    GROUP BY s.abbr
    ORDER BY avg_cost_burden DESC
  `).all<DesertStateSummary>();
  return results;
}

export async function getNationalDesertStats(db: D1Database) {
  return db.prepare(`
    SELECT
      COUNT(*) as total_counties,
      COUNT(CASE WHEN (CAST(center_infant AS REAL) / median_income * 100) > 20 THEN 1 END) as desert_count,
      ROUND(AVG(CAST(center_infant AS REAL) / median_income * 100), 1) as avg_cost_burden,
      ROUND(MAX(CAST(center_infant AS REAL) / median_income * 100), 1) as worst_burden
    FROM counties
    WHERE center_infant IS NOT NULL AND median_income IS NOT NULL AND median_income > 0
  `).first<{
    total_counties: number;
    desert_count: number;
    avg_cost_burden: number;
    worst_burden: number;
  }>();
}

// --- Stats ---

export async function getNationalStats(db: D1Database) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM counties) as county_count,
      (SELECT COUNT(*) FROM states) as state_count,
      (SELECT AVG(center_infant) FROM counties WHERE center_infant IS NOT NULL) as avg_center_infant,
      (SELECT AVG(center_preschool) FROM counties WHERE center_preschool IS NOT NULL) as avg_center_preschool,
      (SELECT MAX(center_infant) FROM counties) as max_center_infant,
      (SELECT MIN(center_infant) FROM counties WHERE center_infant > 0) as min_center_infant
  `).first<{
    county_count: number;
    state_count: number;
    avg_center_infant: number | null;
    avg_center_preschool: number | null;
    max_center_infant: number | null;
    min_center_infant: number | null;
  }>();
}
