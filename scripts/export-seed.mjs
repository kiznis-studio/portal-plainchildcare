import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const DB_PATH = '/storage/plainchildcare/plainchildcare.db';
const SEED_DIR = '/storage/plainchildcare/seed';
const CHUNK_SIZE = 500;

if (!existsSync(DB_PATH)) {
  console.error('Database not found: ' + DB_PATH);
  process.exit(1);
}

if (existsSync(SEED_DIR)) {
  console.log('Removing existing seed directory...');
  rmSync(SEED_DIR, { recursive: true });
}
mkdirSync(SEED_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function exportTable(tableName, columns) {
  console.log('Exporting ' + tableName + '...');
  const rows = db.prepare('SELECT * FROM ' + tableName).all();
  let fileIndex = 0;
  let fileCount = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const values = chunk.map(row => {
      const vals = columns.map(col => escapeSql(row[col]));
      return '(' + vals.join(',') + ')';
    });

    const sql = 'INSERT OR IGNORE INTO ' + tableName + ' (' + columns.join(',') + ') VALUES\n' + values.join(',\n') + ';\n';
    const fileName = tableName + '_' + String(fileIndex).padStart(5, '0') + '.sql';
    writeFileSync(join(SEED_DIR, fileName), sql);
    fileIndex++;
    fileCount += chunk.length;
  }

  console.log('  ' + fileCount.toLocaleString() + ' rows -> ' + fileIndex + ' files');
  return fileIndex;
}

// Export schema first
const schema = `
CREATE TABLE IF NOT EXISTS counties (
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

CREATE TABLE IF NOT EXISTS county_history (
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

CREATE TABLE IF NOT EXISTS states (
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

CREATE INDEX IF NOT EXISTS idx_counties_state ON counties(state);
CREATE INDEX IF NOT EXISTS idx_counties_slug ON counties(slug);
CREATE INDEX IF NOT EXISTS idx_counties_center_infant ON counties(center_infant DESC);
CREATE INDEX IF NOT EXISTS idx_county_history_fips ON county_history(fips);
`;

writeFileSync(join(SEED_DIR, '00_schema.sql'), schema);
console.log('Schema exported');

let totalFiles = 1; // schema

totalFiles += exportTable('states', ['abbr', 'name', 'slug', 'county_count', 'avg_center_infant', 'avg_center_toddler', 'avg_center_preschool', 'min_center_infant', 'max_center_infant', 'median_income']);
totalFiles += exportTable('counties', ['fips', 'name', 'state', 'slug', 'center_infant', 'center_toddler', 'center_preschool', 'center_school_age', 'family_infant', 'family_toddler', 'family_preschool', 'family_school_age', 'median_income', 'poverty_rate', 'population', 'latest_year']);
totalFiles += exportTable('county_history', ['fips', 'year', 'center_infant', 'center_toddler', 'center_preschool', 'center_school_age', 'family_infant', 'family_toddler']);

console.log('\n=== Export Complete ===');
console.log('Total files: ' + totalFiles);
console.log('Seed directory: ' + SEED_DIR);

db.close();
