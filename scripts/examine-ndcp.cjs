const XLSX = require('xlsx');
const wb = XLSX.readFile('/storage/plainchildcare/raw/NDCP2022.xlsx', { dense: true });
console.log('Sheet names:', wb.SheetNames);
console.log('Sheets keys:', Object.keys(wb.Sheets));
// Try each sheet
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  console.log('Sheet "' + name + '":', ws ? 'exists' : 'undefined');
  if (ws) {
    console.log('  ref:', ws['!ref']);
  }
}
