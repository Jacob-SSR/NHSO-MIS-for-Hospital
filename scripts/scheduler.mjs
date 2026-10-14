#!/usr/bin/env node
// Worker process for the Docker "worker" service: runs the jobs one at a time on a schedule (Bangkok time).
//
//   notify    scripts/smt-notify.mjs       at start, then every NOTIFY_INTERVAL_MINUTES (default 30)
//   smt-data  scripts/fetch-smt-data.mjs   daily at SMT_DATA_TIME (default 07:10)
//   mis-data  scripts/fetch-mis-data.mjs   daily at MIS_DATA_TIME (default 07:25)
//
// A daily job also runs right away when its file is missing or older than today's run time, so a fresh
// install or a server that was off at 07:10 catches up. A failed daily job retries after RETRY_MINUTES.

import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || 'data';
const MIN = 60_000;
const NOTIFY_EVERY = Number(process.env.NOTIFY_INTERVAL_MINUTES || 30) * MIN;
const RETRY = Number(process.env.RETRY_MINUTES || 60) * MIN;
const JOB_TIMEOUT = 50 * MIN;
const BKK = 7 * 60 * MIN; // Asia/Bangkok is UTC+7 all year

const JOBS = [
  { name: 'notify', script: 'scripts/smt-notify.mjs', every: NOTIFY_EVERY },
  { name: 'smt-data', script: 'scripts/fetch-smt-data.mjs', daily: process.env.SMT_DATA_TIME || '07:10', file: 'smt.json' },
  { name: 'mis-data', script: 'scripts/fetch-mis-data.mjs', daily: process.env.MIS_DATA_TIME || '07:25', file: 'mis.json' },
];

const log = (...a) => console.log(new Date(Date.now() + BKK).toISOString().replace('T', ' ').slice(0, 19), '[scheduler]', ...a);

/** today's HH:MM in Bangkok as an absolute time */
function todayAt(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const bkkNow = new Date(Date.now() + BKK);
  return Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth(), bkkNow.getUTCDate(), h, m) - BKK;
}

async function mtime(file) {
  try { return (await stat(join(DATA_DIR, file))).mtimeMs; } catch { return 0; }
}

async function due(job, now) {
  if (job.every) return !job.lastStart || now - job.lastStart >= job.every;
  if (job.lastFail && now - job.lastFail < RETRY) return false;
  const target = todayAt(job.daily);
  const fresh = await mtime(job.file);
  // missing file, or not refreshed since today's run time (once that time has passed)
  return fresh === 0 || (now >= target && fresh < target);
}

function run(job) {
  return new Promise((resolve) => {
    log(`start ${job.name}`);
    const t0 = Date.now();
    const child = spawn(process.execPath, [job.script], { stdio: 'inherit', env: process.env });
    const timer = setTimeout(() => { log(`${job.name} timed out, stopping`); child.kill('SIGTERM'); }, JOB_TIMEOUT);
    child.on('exit', (code) => {
      clearTimeout(timer);
      log(`${job.name} ${code === 0 ? 'ok' : `failed (exit ${code})`} in ${Math.round((Date.now() - t0) / 1000)}s`);
      resolve(code === 0);
    });
  });
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const job of JOBS) {
      const now = Date.now();
      if (!(await due(job, now))) continue;
      job.lastStart = now;
      const ok = await run(job);
      job.lastFail = ok ? 0 : Date.now();
    }
  } finally {
    busy = false;
  }
}

log(`data dir ${DATA_DIR}; notify every ${NOTIFY_EVERY / MIN} min; smt-data ${JOBS[1].daily}; mis-data ${JOBS[2].daily} (Bangkok)`);
if (!process.env.MOPH_NOTIFY_CLIENT_KEY) log('MOPH_NOTIFY_CLIENT_KEY is not set: new transfers are held and sent once the keys are added to .env');
tick();
setInterval(tick, 30_000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { log(`${sig}, exiting`); process.exit(0); });
