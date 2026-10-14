#!/usr/bin/env node
// Watch SMT (smt.nhso.go.th) for new fund transfers to one hospital and push them to a LINE group via MOPH Notify.
//
//   node scripts/smt-notify.mjs              check once, notify new transfers, save state
//   node scripts/smt-notify.mjs --dry-run    check and print the messages; send nothing, save nothing
//   node scripts/smt-notify.mjs --seed       mark everything currently in SMT as already notified
//   node scripts/smt-notify.mjs --test       send one test message to the LINE group
//
// Env: MOPH_NOTIFY_CLIENT_KEY, MOPH_NOTIFY_SECRET_KEY (from the MOPH Notify CMS, step 4),
//      HCODE (default 10909), DASHBOARD_URL (optional link button), STATE_FILE (default public/notify/state.json)

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchTransfers, fiscalYear, normalize } from './lib/smt.mjs';
import { baht, rightOf, sendNotify, thDate, transferBubble } from './lib/moph-notify.mjs';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const SEED = args.has('--seed');
const TEST = args.has('--test');

const HCODE = (process.env.HCODE || '10909').replace(/^0+/, '');
const GROUP = process.env.LINE_GROUP_NAME || `Planfin HC${HCODE}`;
const STATE_FILE = process.env.STATE_FILE || 'public/notify/state.json';
const DASHBOARD_URL = process.env.DASHBOARD_URL || '';
const keys = { clientKey: process.env.MOPH_NOTIFY_CLIENT_KEY || '', secretKey: process.env.MOPH_NOTIFY_SECRET_KEY || '' };
const MAX_RECENT = 40;
const BATCH = 5; // LINE accepts at most 5 message objects per send
const FLOOD = 150; // more new lines than this in one run means lost state, not real transfers: re-seed instead

const log = (...a) => console.log(new Date().toISOString(), ...a);

function requireKeys() {
  if (!keys.clientKey || !keys.secretKey) {
    console.error('ยังไม่ได้ตั้งค่า MOPH_NOTIFY_CLIENT_KEY / MOPH_NOTIFY_SECRET_KEY (ดูขั้นตอนที่ 4 ในหน้าแจ้งเตือน)');
    process.exit(2);
  }
}

const rowKey = (r) => createHash('sha1')
  .update([r.date, r.batch, r.ref, r.account, r.fund, r.sub, r.source, r.amount, r.net].join('|'))
  .digest('hex').slice(0, 16);

async function loadState() {
  try {
    const s = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    if (s && s.hcode === HCODE && s.seen) return s;
  } catch { /* first run */ }
  return null;
}

async function saveState(state) {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 1) + '\n');
}

async function main() {
  if (TEST) {
    requireKeys();
    const now = new Date();
    const text = `✅ ทดสอบการเชื่อมต่อ MOPH Notify\nกลุ่ม: ${GROUP}\nรพ. รหัส ${HCODE}\nเวลา ${now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}\n\nเมื่อมีเงินโอนจาก สปสช. เข้า รพ. ระบบจะแจ้งในกลุ่มนี้อัตโนมัติ`;
    await sendNotify([{ type: 'text', text }], keys);
    log('sent test message');
    return;
  }

  const now = new Date();
  const fy = fiscalYear(now);
  let hospital = '';
  const rows = [];
  for (const y of [fy - 1, fy]) {
    const r = await fetchTransfers(HCODE, y, now);
    if (r.vendorName) hospital = r.vendorName;
    for (const x of r.rows) rows.push(normalize(x));
    log(`SMT FY${y}: ${r.rows.length} lines`);
  }
  hospital = hospital || `รพ. รหัส ${HCODE}`;

  const prev = await loadState();
  const state = prev || { v: 1, hcode: HCODE, group: GROUP, hospital, seen: {}, recent: [] };
  state.hospital = hospital;
  state.group = GROUP;

  const fresh = [];
  const inRun = new Set();
  for (const r of rows) {
    const k = rowKey(r);
    if (state.seen[k] || inRun.has(k)) continue;
    inRun.add(k);
    fresh.push({ ...r, key: k });
  }
  log(`${rows.length} lines total, ${fresh.length} not yet notified`);

  // First run, or asked to seed: remember what is already there without flooding the group.
  if (prev && !SEED && fresh.length > FLOOD) log(`${fresh.length} new lines looks like lost state; re-seeding instead of sending`);
  if (!prev || SEED || fresh.length > FLOOD) {
    for (const r of fresh) state.seen[r.key] = r.date;
    state.seededAt = now.toISOString();
    state.updated = now.toISOString();
    if (DRY) { log(`dry-run: would seed ${fresh.length} lines`); return; }
    if (!prev && keys.clientKey && keys.secretKey) {
      const last = rows.reduce((a, r) => (r.date > a ? r.date : a), 0);
      const fyStart = (fy - 1) * 10000 + 1001;
      const cur = rows.filter((r) => r.date >= fyStart).reduce((a, r) => a + r.net, 0);
      const before = rows.filter((r) => r.date < fyStart).reduce((a, r) => a + r.net, 0);
      const text = `🔔 เริ่มระบบแจ้งเตือนเงินโอน สปสช.\n${hospital} (HC${HCODE})\n\nยอดโอนสุทธิ ปีงบ ${fy - 1}: ${baht(before)} บาท\nยอดโอนสุทธิ ปีงบ ${fy} (ถึงวันนี้): ${baht(cur)} บาท\nโอนล่าสุด: ${last ? thDate(last) : '-'}\n\nต่อจากนี้เมื่อมีเงินโอนเข้า ระบบจะแจ้งในกลุ่มนี้ทันที`;
      await sendNotify([{ type: 'text', text }], keys);
    }
    await saveState(state);
    log(`seeded ${fresh.length} lines`);
    return;
  }

  if (!fresh.length) { log('no new transfers'); return; }

  const byDate = new Map();
  for (const r of fresh) byDate.set(r.date, [...(byDate.get(r.date) || []), r]);
  const msgs = [...byDate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([date, list]) => ({ date, list, msg: transferBubble({ hospital, hcode: HCODE, date, rows: list, dashboardUrl: DASHBOARD_URL }) }));

  if (DRY) {
    for (const m of msgs) console.log(JSON.stringify(m.msg, null, 1));
    log(`dry-run: would send ${msgs.length} message(s)`);
    return;
  }
  requireKeys();

  // Send in batches and only mark lines as seen once their message went out, so a failure retries next run.
  let sent = 0;
  try {
    for (let i = 0; i < msgs.length; i += BATCH) {
      const chunk = msgs.slice(i, i + BATCH);
      await sendNotify(chunk.map((m) => m.msg), keys);
      const at = new Date().toISOString();
      for (const m of chunk) {
        for (const r of m.list) {
          state.seen[r.key] = r.date;
          state.recent.unshift({
            date: r.date, batch: r.batch, fund: r.fund, sub: r.sub, right: rightOf(r.fund, r.account),
            amount: r.amount, wait: r.wait, deduct: r.deduct, net: r.net, notifiedAt: at,
          });
        }
      }
      sent += chunk.length;
    }
  } finally {
    if (sent) {
      state.recent = state.recent.slice(0, MAX_RECENT);
      // forget lines older than the previous fiscal year; SMT will not return them again
      const floor = (fy - 2) * 10000 + 1001;
      for (const [k, d] of Object.entries(state.seen)) if (d < floor) delete state.seen[k];
      state.updated = new Date().toISOString();
      state.lastNotified = state.updated;
      await saveState(state);
      log(`sent ${sent} message(s)`);
    }
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
