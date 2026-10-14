#!/usr/bin/env node
// Rebuild public/dashboards/smt/data.json (every hospital in one province, current + two previous fiscal years)
// from the SMT public report API. Node port of the dashboard's original in-browser fetch script; same output format.
//
//   node scripts/fetch-smt-data.mjs [out=public/dashboards/smt/data.json]
// Env: PROVINCE_ID (default 3100 = บุรีรัมย์)

import { readFile, writeFile } from 'node:fs/promises';
import { fetchTransfers, fiscalYear, smtPost } from './lib/smt.mjs';

const OUT = process.argv[2] || 'public/dashboards/smt/data.json';
const PROVINCE = process.env.PROVINCE_ID || '3100';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function main() {
  const now = new Date();
  const curFY = fiscalYear(now);
  const fys = [curFY - 2, curFY - 1, curFY];

  const vend = await smtPost('/option/vendor', {});
  const hosp = {};
  for (const x of vend || []) {
    const name = String(x.value || '').trim();
    if (x.extra && x.extra.provinceId === PROVINCE && /^โรงพยาบาล/.test(name) && !/ส่งเสริมสุขภาพตำบล/.test(name)) {
      hosp[String(x.key).replace(/^0+/, '')] = name;
    }
  }
  const codes = Object.keys(hosp).sort();
  if (codes.length < 20) throw new Error(`too few hospitals from SMT vendor list: ${codes.length}`);

  const dict = [], di = new Map();
  const D = (v) => { const k = (v ?? '').toString().trim(); if (!di.has(k)) { di.set(k, dict.length); dict.push(k); } return di.get(k); };
  const rows = [], counts = {};
  let i = 0;
  for (const code of codes) {
    for (const fy of fys) {
      const { vendorName, rows: ds } = await fetchTransfers(code, fy, now);
      if (vendorName) hosp[code] = vendorName;
      counts[`${code}/${fy}`] = ds.length;
      for (const x of ds) {
        rows.push([code, +x.postingDate, D(x.batchNo), D(x.refDocNo), D(x.mophId), D(x.fundDescr), D(x.efundDesc),
          r2(x.amount), r2(x.wait), r2((x.debt || 0) + (x.bond || 0) + (x.vat || 0)), r2(x.total), r2(x.odbt), D(x.budgetSource)]);
      }
      console.log(`${++i}/${codes.length * fys.length} ${code} FY${fy}: ${ds.length}`);
    }
  }
  if (!rows.length) throw new Error('SMT returned no rows');

  // never replace a fuller snapshot with a much smaller one (SMT hiccup)
  try {
    const old = JSON.parse(await readFile(OUT, 'utf8'));
    if (old.rows && rows.length < old.rows.length * 0.5) throw new Error(`refusing to shrink ${old.rows.length} -> ${rows.length} rows`);
  } catch (e) { if (String(e.message).startsWith('refusing')) throw e; }

  const data = { v: 1, source: 'smt.nhso.go.th budgetSummaryByVendorReport', fetched: now.toISOString(), fys: fys.map(String), hosp, counts, dict, rows };
  await writeFile(OUT, JSON.stringify(data));
  console.log(`ok rows=${rows.length} hosp=${codes.length} -> ${OUT}`);
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
