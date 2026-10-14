#!/usr/bin/env node
// Rebuild public/dashboards/mis/mis.json from NHSO-MIS for Hospital (mishos.nhso.go.th).
// Uses the same report endpoints the MIS web app calls (no login): simplestudio/ss_statement.php
// get_tabledata by report id, the m040x high-cost endpoints, and l_hospital.php for the unit list.
//
//   node scripts/fetch-mis-data.mjs [out=public/dashboards/mis/mis.json]
// Env: PROVINCE_ID (default 3100 = บุรีรัมย์), HCODE (any unit in the province, default 10909)

import { readFile, writeFile } from 'node:fs/promises';

const OUT = process.argv[2] || 'public/dashboards/mis/mis.json';
const API = process.env.MIS_API_URL || 'https://mishos.nhso.go.th/mis_hos_apixam/';
const PROVINCE = process.env.PROVINCE_ID || '3100';
const HCODE = process.env.HCODE || '10909';

// report ids (ssid) in the MIS "simplestudio" report builder
const R = {
  ofcMonthly: '1529', // 9.1 กรมบัญชีกลาง รายเดือน: MONTH_SEND, NUMPT_OP, ACT_AMT_OP, NUMPT_IP, ACT_AMT_IP
  lgoMonthly: '1532', // 9.2 อปท. รายเดือน (same columns)
  opaeProv: '1883', // 1.1 OPAE รายหน่วยบริการในจังหวัด: HMAIN, HNAME, NUM_VISIT, ACT_AMT_ALL
  walkinProv: '1863', // 1.4 Walk-in รายหน่วยบริการในจังหวัด: HMAIN, HNAME, NUM_VISIT, NUM_VISIT_ONE, ACT_AMT_ALL
  budget: '1826', // 0.1 รายรับแยกกองทุนย่อย: M_FUND_CD, M_FUND_DESC, S_FUND_CD, S_FUND_DESC, BUDGET
  stmt: '1824', // 0.2 Statement UC: FUND_AF, SUB_FUND, DESCRIPTION, NUM_VISIT, ACT_AMT, ACT_AMT_STM
  instMonthly: '1107', // 4.4 อุปกรณ์ รายเดือน: MONTH_SEND, NUMPT_OP, ACT_AMT_OP, NUMPT_IP, ACT_AMT_IP
  instItems: '1108', // 4.4 รายการอุปกรณ์: CODE, ..., SUM_QTY, SUM_AMT
  moph: '2205', // 8.2 MOPH-Claim: SUB_FUND, DETAIL, VISIT, ACT_AMT
  ktp: '2263', // 8.3 KTP: SUB_FUND, DETAIL, VISIT, ACT_AMT
};
// 4.1–4.5 high-cost services: endpoint, then the count/amount column pairs to add up
const HC = {
  stemi: ['m0401_stemi_year.php', ['NUMPT_STROKE', 'NUMPT_STEMI'], ['ACTAMT_STROKE', 'ACTAMT_STEMI']],
  cancer: ['m0402_cancer_year.php', ['NUMPT_OP', 'NUMPT_IP'], ['ACT_AMT_OP', 'ACT_AMT_IP']],
  cataract: ['m0403_cataract_year.php', ['NUMPT_OUT', 'NUMPT_IN'], ['ACTAMT_OUT', 'ACTAMT_IN']],
  stone: ['m0405_stone_year.php', ['NUMPT_OP', 'NUMPT_IP'], ['ACT_AMT_OP', 'ACT_AMT_IP']],
};

const n = (v) => Math.round((Number(v) || 0) * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fiscalYearBE = (d = new Date()) => d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0);
const ce = (be) => String(be - 543); // MIS takes the fiscal year in CE: ปีงบ 2569 -> "2026"
const isHosp = (name) => (/^รพ\./.test(name) && !/^รพ\.สต\./.test(name)) || /^โรงพยาบาล/.test(name);

let calls = 0;
async function post(path, body, { tries = 3 } = {}) {
  let last;
  for (let t = 0; t < tries; t++) {
    try {
      calls++;
      const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json, text/plain, */*', Origin: 'https://mishos.nhso.go.th', Referer: 'https://mishos.nhso.go.th/mis_hos/' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`MIS ${path} HTTP ${res.status}`);
      const text = (await res.text()).replace(/^﻿/, '').trim();
      if (!text) return [];
      if (!text.startsWith('[') && !text.startsWith('{')) throw new Error(`MIS ${path} non-JSON reply: ${text.slice(0, 80)}`);
      const j = JSON.parse(text);
      return Array.isArray(j) ? j : [];
    } catch (e) {
      last = e.cause ? new Error(`${e.message} (${e.cause.code || e.cause.message}) — ${API}${path}`) : e;
      await sleep(1500 * (t + 1));
    }
  }
  throw last;
}

const table = (ssid, hcode, yearBE) =>
  post('simplestudio/ss_statement.php', { ssid, api_type: 'get_tabledata', hcode, province: PROVINCE, year: ce(yearBE), province_name: '' });

/** run fn over items with a small concurrency limit, politely */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
      await sleep(80);
    }
  }));
  return out;
}

const monthRows = (rows) => rows.map((r) => [String(r.MONTH_SEND), n(r.NUMPT_OP), n(r.ACT_AMT_OP), n(r.NUMPT_IP), n(r.ACT_AMT_IP)]);

/** every service unit in the province: MIS hospital list, plus any unit seen in reports or the previous file */
async function provinceUnits(yearBE, old) {
  const units = new Map();
  try {
    const list = await post('l_hospital.php', { prov: PROVINCE, year: ce(yearBE) });
    for (const h of list) {
      const code = String(h.HMAIN ?? h.HCODE ?? h.HOSPCODE ?? h.hcode ?? '').trim();
      const name = String(h.HNAME ?? h.HOSPNAME ?? h.hname ?? h.NAME ?? '').trim();
      if (/^\d{5}$/.test(code)) units.set(code, name || units.get(code) || code);
    }
    console.log(`l_hospital.php: ${units.size} units`);
  } catch (e) {
    console.warn(`l_hospital.php failed (${e.message}); using units from reports and the previous file`);
  }
  for (const y of Object.values(old?.years || {})) {
    for (const rows of Object.values(y)) for (const r of rows) if (!units.has(r[0])) units.set(r[0], r[1]);
  }
  return units;
}

async function main() {
  const fy = fiscalYearBE();
  const yearsBE = [fy - 2, fy - 1, fy];
  const detailYears = [fy - 1, fy]; // monthly + per-hospital fund detail
  let old = null;
  try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first build */ }

  const names = new Map();
  const years = {}, monthly = {}, funds = {};

  for (const y of yearsBE) {
    const [opae, walkin] = await Promise.all([table(R.opaeProv, HCODE, y), table(R.walkinProv, HCODE, y)]);
    for (const r of [...opae, ...walkin]) names.set(String(r.HMAIN), String(r.HNAME).trim());
    years[y] = {
      opae: opae.map((r) => [String(r.HMAIN), String(r.HNAME).trim(), n(r.NUM_VISIT), n(r.ACT_AMT_ALL)]).sort((a, b) => b[3] - a[3]),
      walkin: walkin.map((r) => [String(r.HMAIN), String(r.HNAME).trim(), n(r.NUM_VISIT) + n(r.NUM_VISIT_ONE), n(r.ACT_AMT_ALL)]).sort((a, b) => b[3] - a[3]),
    };
    console.log(`FY${y}: opae ${years[y].opae.length}, walkin ${years[y].walkin.length}`);
  }

  const units = await provinceUnits(fy, old);
  for (const [c, nm] of names) if (!units.has(c)) units.set(c, nm);
  for (const [c, nm] of units) if (!names.has(c) && nm) names.set(c, nm);
  const codes = [...units.keys()].sort();
  const hospitals = codes.filter((c) => isHosp(names.get(c) || ''));
  console.log(`${codes.length} units, ${hospitals.length} hospitals`);

  // ข้าราชการ / อปท.: the per-unit yearly totals are the sum of the monthly report
  for (const y of yearsBE) {
    years[y].ofc = []; years[y].lgo = [];
    const res = await pool(codes, 4, async (c) => [c, monthRows(await table(R.ofcMonthly, c, y)), monthRows(await table(R.lgoMonthly, c, y))]);
    for (const [c, ofc, lgo] of res) {
      for (const [key, rows] of [['ofc', ofc], ['lgo', lgo]]) {
        if (!rows.length) continue;
        const s = [1, 2, 3, 4].map((i) => n(rows.reduce((a, r) => a + r[i], 0)));
        if (s.some((v) => v)) years[y][key].push([c, names.get(c) || c, ...s]);
        if (detailYears.includes(y) && hospitals.includes(c)) {
          ((monthly[y] ??= {})[c] ??= {})[key] = rows;
        }
      }
    }
    console.log(`FY${y}: ofc ${years[y].ofc.length}, lgo ${years[y].lgo.length}`);
  }

  // per-hospital fund detail
  for (const y of detailYears) {
    funds[y] = {};
    await pool(hospitals, 3, async (c) => {
      const [budget, stmt, instm, inst, moph, ktp] = await Promise.all([
        table(R.budget, c, y), table(R.stmt, c, y), table(R.instMonthly, c, y),
        table(R.instItems, c, y), table(R.moph, c, y), table(R.ktp, c, y),
      ]);
      const hc = {};
      for (const [k, [ep, cnt, amt]] of Object.entries(HC)) {
        const row = (await post(ep, { data1: c, year: ce(fy) })).find((r) => String(r.YEAR) === String(y)) || {};
        hc[k] = [n(cnt.reduce((a, f) => a + n(row[f]), 0)), n(amt.reduce((a, f) => a + n(row[f]), 0))];
      }
      funds[y][c] = {
        budget: budget.map((r) => [String(r.M_FUND_DESC ?? '').trim(), String(r.S_FUND_DESC ?? '').trim(), n(r.BUDGET)]),
        stmt: stmt.map((r) => [String(r.FUND_AF ?? ''), String(r.SUB_FUND ?? ''), String(r.DESCRIPTION ?? r.SUB_FUND ?? '').trim(), n(r.NUM_VISIT), n(r.ACT_AMT), n(r.ACT_AMT_STM)]),
        instm: monthRows(instm),
        inst: inst.map((r) => [String(r.CODE ?? '').trim(), n(r.SUM_QTY), n(r.SUM_AMT)]),
        moph: moph.map((r) => [String(r.DETAIL ?? r.SUB_FUND ?? '').trim(), n(r.VISIT), n(r.ACT_AMT)]),
        ktp: ktp.map((r) => [String(r.DETAIL ?? r.SUB_FUND ?? '').trim(), n(r.VISIT), n(r.ACT_AMT)]),
        hc,
      };
    });
    console.log(`FY${y}: fund detail for ${Object.keys(funds[y]).length} hospitals`);
  }

  // never replace a full snapshot with a broken one
  const prevFy = years[fy - 1];
  if (!prevFy || prevFy.ofc.length < 10 || prevFy.lgo.length < 10) throw new Error(`too little data for FY${fy - 1}: ofc ${prevFy?.ofc.length} lgo ${prevFy?.lgo.length}`);

  const data = {
    v: 1,
    source: 'mishos.nhso.go.th (NHSO-MIS for Hospital) รายงานระดับจังหวัดบุรีรัมย์',
    fetched: new Date().toISOString(),
    years, monthly, funds,
  };
  await writeFile(OUT, JSON.stringify(data));
  console.log(`ok ${calls} requests -> ${OUT}`);
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
