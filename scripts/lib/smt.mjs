// Shared helpers for reading the NHSO Smart Money Transfer (SMT) public report API.
// Same endpoint and request body the dashboard's original fetch script used inside smt.nhso.go.th/smtf/.

export const SMT_API = process.env.SMT_API_URL || 'https://smt.nhso.go.th/smtf/api';

const pad = (n) => String(n).padStart(2, '0');

/** dd/mm/yyyy in Buddhist Era, the format SMT expects. */
export const beDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543}`;

/** Thai fiscal year (BE) for a date: Oct–Sep, so Oct 2026 is FY 2570. */
export const fiscalYear = (d = new Date()) => d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0);

export async function smtPost(path, body, { tries = 3 } = {}) {
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(SMT_API + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: 'https://smt.nhso.go.th',
          Referer: 'https://smt.nhso.go.th/smtf/',
        },
        body: JSON.stringify(body || {}),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`SMT ${path} HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
    }
  }
  throw lastErr;
}

/** All transfer lines for one hospital (5-digit code) in one fiscal year, up to `now`. */
export async function fetchTransfers(code, fy, now = new Date()) {
  const end = new Date(Math.min(now.getTime(), new Date(fy - 543, 8, 30).getTime()));
  const body = {
    vendorSearchConditionCode: '2', zoneId: '', provinceId: '', vendorId: '', vendorId5Digit: code,
    budgetSource: '', budgetYear: String(fy), transferStartDate: `01/10/${fy - 1}`, transferEndDate: beDate(end),
    hospType: '', isTest: '',
  };
  const j = await smtPost('/budgetreport/budgetSummaryByVendorReport/search', body);
  return { vendorName: (j && j.vendorName ? String(j.vendorName).trim() : ''), rows: (j && j.datas) || [] };
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const s = (v) => (v ?? '').toString().trim();

/** Normalise one SMT row into the fields the notifier and dashboard use. */
export function normalize(x) {
  return {
    date: Number(x.postingDate) || 0, // BE yyyymmdd, e.g. 25691012
    batch: s(x.batchNo),
    ref: s(x.refDocNo),
    account: s(x.mophId),
    fund: s(x.fundDescr),
    sub: s(x.efundDesc),
    source: s(x.budgetSource),
    amount: r2(x.amount),
    wait: r2(x.wait),
    deduct: r2((Number(x.debt) || 0) + (Number(x.bond) || 0) + (Number(x.vat) || 0)),
    net: r2(x.total),
    offset: r2(x.odbt),
  };
}
