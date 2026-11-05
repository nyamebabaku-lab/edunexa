// Writes the Excel import template next to the web app (dist/) and into docs/, so it can be downloaded directly.
import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { buildTemplate } from '../src/lib/importer.js';

const buf = XLSX.write(buildTemplate(XLSX), { type: 'buffer', bookType: 'xlsx' });
for (const dir of ['dist', 'docs']) {
  if (dir === 'dist' && !existsSync('dist')) continue;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/EduNexa-Import-Template.xlsx`, buf);
}
console.log('Template written', buf.length, 'bytes');
