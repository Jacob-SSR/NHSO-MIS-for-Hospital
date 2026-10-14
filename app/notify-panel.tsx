"use client";

import { useEffect, useState } from "react";

const HCODE = "10909";
const GROUP = `Planfin HC${HCODE}`;
const HOSPITAL = "โรงพยาบาลพลับพลาชัย";

type Recent = {
  date: number;
  batch: string;
  fund: string;
  sub: string;
  right: string;
  amount: number;
  wait: number;
  deduct: number;
  net: number;
  notifiedAt: string;
};
type NotifyState = {
  hcode: string;
  group: string;
  hospital: string;
  seededAt?: string;
  updated?: string;
  lastNotified?: string;
  recent: Recent[];
};

const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = (k: number) => `${k % 100} ${TH_M[(Math.floor(k / 100) % 100) - 1] ?? "?"} ${Math.floor(k / 10000)}`;
const num = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thb = (n: number) => `${n < 0 ? "-" : ""}฿${num(Math.abs(n))}`;
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }) : "-";

// real HC10909 transfers of 9 Oct 2569, shown in the LINE preview until the first notification has gone out
const SAMPLE: Recent[] = [
  { date: 25691009, batch: "Y004", fund: "กองทุนผู้ป่วยนอก", sub: "งบบริการผู้ป่วยนอกจ่ายแบบเหมาจ่ายต่อผู้มีสิทธิ", right: "บัตรทอง", amount: 7513700, wait: 0, deduct: 0, net: 7513700, notifiedAt: "" },
  { date: 25691009, batch: "Y004", fund: "กองทุนสร้างเสริมสุขภาพและป้องกันโรค", sub: "บริการสร้างเสริมสุขภาพและป้องกันโรคสำหรับบริการพื้นฐาน (P&P BASIC SERVICE)", right: "บัตรทอง", amount: 1584800, wait: 0, deduct: 0, net: 1584800, notifiedAt: "" },
  { date: 25691009, batch: "Y004", fund: "กองทุนผู้ป่วยใน", sub: "กองทุนผู้ป่วยใน CAP", right: "บัตรทอง", amount: 300038.71, wait: 0, deduct: 0, net: 300038.71, notifiedAt: "" },
  { date: 25691009, batch: "Y004", fund: "กองทุนผู้ป่วยใน", sub: "กองทุนผู้ป่วยใน CAP", right: "บัตรทอง", amount: 0, wait: 0, deduct: 40946.85, net: -40946.85, notifiedAt: "" },
  { date: 25691009, batch: "Y004", fund: "ค่าบริการฟื้นฟูสมรรถภาพด้านการแพทย์", sub: "ค่าบริการฟื้นฟูสมรรถภาพด้านการแพทย์", right: "บัตรทอง", amount: 8315, wait: 0, deduct: 0, net: 8315, notifiedAt: "" },
];

export default function NotifyPanel() {
  const [state, setState] = useState<NotifyState | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/notify/state.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: NotifyState | null) => alive && setState(s && s.hcode === HCODE ? s : null))
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, []);

  const live = !!state;
  const recent = state?.recent ?? [];
  const latestDate = recent[0]?.date;
  const preview = latestDate ? recent.filter((r) => r.date === latestDate) : SAMPLE;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-mint-500 via-mint-600 to-mint-800 p-6 text-white shadow-lg shadow-mint-900/20 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-24 size-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-mint-100">ระบบแจ้งเตือนเงินโอน · MOPH Notify</p>
            <h1 className="mt-1 text-2xl font-semibold leading-snug sm:text-3xl">เงินเข้าเมื่อไหร่ รู้ทันทีในกลุ่ม LINE</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-mint-50/90">
              ทุกครั้งที่ สปสช. โอนเงินเข้า {HOSPITAL} (รหัส {HCODE}) ไม่ว่าจะมาจากกองทุนไหน ระบบจะส่งข้อความสรุปยอดโอนสุทธิและแหล่งที่มาของเงินเข้ากลุ่ม{" "}
              <b className="font-semibold text-white">“{GROUP}”</b> ผ่านบอทหมอพร้อม
            </p>
          </div>
          <StatusBadge state={state} />
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="รพ. ที่ติดตาม" value={`HC${HCODE}`} />
          <Stat label="ตรวจสอบทุก" value="30 นาที" />
          <Stat label="แจ้งล่าสุด" value={live ? when(state?.lastNotified) : "-"} />
          <Stat label="แหล่งข้อมูล" value="SMT สปสช." />
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* LINE preview */}
        <section aria-labelledby="pv-h">
          <h2 id="pv-h" className="mb-3 text-base font-semibold">
            {latestDate ? "ข้อความล่าสุดที่ส่งเข้ากลุ่ม" : "ตัวอย่างข้อความที่จะได้รับ"}
          </h2>
          <LinePreview rows={preview} />
        </section>

        {/* recent list */}
        <section aria-labelledby="rc-h" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="rc-h" className="text-base font-semibold">เงินเข้าที่แจ้งไปแล้ว</h2>
            {live && <span className="text-xs text-muted">อัปเดต {when(state?.updated)}</span>}
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {state === undefined ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-xl" />
                ))}
              </div>
            ) : recent.length ? (
              <ul className="divide-y divide-line">
                {recent.slice(0, 15).map((r, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-mint-100 text-xs font-semibold text-mint-800 dark:bg-mint-900 dark:text-mint-200">
                      {r.date % 100}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{r.sub || r.fund}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {thDate(r.date)} · {r.sub && r.sub !== r.fund ? `${r.fund} · ` : ""}
                        {r.right}
                        {r.batch ? ` · งวด ${r.batch}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-mint-700 dark:text-mint-300">{thb(r.net)}</p>
                      {(r.wait > 0 || r.deduct > 0) && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          {r.wait > 0 ? `ชะลอ ${num(r.wait)} ` : ""}
                          {r.deduct > 0 ? `หัก ${num(r.deduct)}` : ""}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-mint-100 text-mint-700 dark:bg-mint-900 dark:text-mint-200">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
                    <path d="M10 20a2.2 2.2 0 0 0 4 0" />
                  </svg>
                </div>
                <p className="font-medium">{live ? "ยังไม่มีเงินโอนใหม่หลังเริ่มระบบ" : "ยังไม่ได้เริ่มระบบแจ้งเตือน"}</p>
                <p className="max-w-sm text-sm text-muted">
                  {live
                    ? `ระบบจำรายการเดิมไว้แล้วเมื่อ ${when(state?.seededAt)} เมื่อมีเงินโอนเข้าใหม่จะแสดงที่นี่และในกลุ่ม LINE`
                    : "ทำตาม 5 ขั้นตอนด้านล่าง เมื่อระบบทำงานครั้งแรกจะส่งข้อความ “เริ่มระบบแจ้งเตือน” เข้ากลุ่ม"}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <Setup />
    </div>
  );
}

function StatusBadge({ state }: { state: NotifyState | null | undefined }) {
  if (state === undefined) return <div className="skeleton h-9 w-40 rounded-full opacity-40" />;
  return state ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium ring-1 ring-white/30">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2.5 rounded-full bg-white" />
      </span>
      ระบบทำงานอยู่
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/15 px-4 py-2 text-sm font-medium ring-1 ring-white/25">
      <span className="size-2.5 rounded-full bg-amber-300" />
      รอเชื่อมต่อ
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
      <dt className="text-xs text-mint-100">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

/** HTML stand-in for the Flex message built in scripts/lib/moph-notify.mjs */
function LinePreview({ rows }: { rows: Recent[] }) {
  const net = rows.reduce((a, r) => a + r.net, 0);
  const deduct = rows.reduce((a, r) => a + r.deduct, 0);
  const wait = rows.reduce((a, r) => a + r.wait, 0);
  const groups = new Map<string, { fund: string; sub: string; right: string; net: number; n: number }>();
  for (const r of rows) {
    const k = `${r.fund}|${r.sub}`;
    const g = groups.get(k) ?? { fund: r.fund, sub: r.sub, right: r.right, net: 0, n: 0 };
    g.net += r.net;
    g.n += 1;
    groups.set(k, g);
  }
  const list = [...groups.values()].sort((a, b) => b.net - a.net);
  const shown = list.slice(0, 10);
  const rest = list.slice(10);

  return (
    <div className="rounded-[28px] bg-[#8cabd9] p-4 shadow-inner dark:bg-[#1e2b3d]">
      <div className="mb-3 flex items-center gap-2 text-xs text-white/90">
        <span className="grid size-7 place-items-center rounded-full bg-white text-[10px] font-bold text-mint-700">หมอ</span>
        <span className="font-medium">หมอพร้อม</span>
        <span className="ml-auto opacity-80">{GROUP}</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white text-[#0e3b33] shadow-md">
        <div className="bg-mint-600 px-4 py-3.5 text-white">
          <p className="text-[15px] font-semibold">💰 เงินโอนเข้า สปสช.</p>
          <p className="mt-0.5 text-xs text-mint-50">
            {HOSPITAL} · HC{HCODE}
          </p>
          <p className="mt-0.5 text-xs text-mint-50">วันที่โอน {rows[0] ? thDate(rows[0].date) : "-"}</p>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-[#6b8580]">ยอดโอนเข้าบัญชีสุทธิ</p>
          <p className="text-2xl font-bold text-mint-800">{thb(net)}</p>
          <p className="mt-0.5 text-xs text-[#6b8580]">
            {rows.length} รายการ · {list.length} กองทุนย่อย
          </p>
          {(wait > 0 || deduct > 0) && (
            <p className="mt-1 text-xs text-amber-700">
              {[wait > 0 ? `ชะลอ ${num(wait)}` : "", deduct > 0 ? `หัก ${num(deduct)}` : ""].filter(Boolean).join(" · ")}
            </p>
          )}
          <hr className="my-3 border-mint-100" />
          <p className="text-xs font-semibold text-[#6b8580]">เงินมาจาก</p>
          <ul className="mt-1 space-y-2.5">
            {shown.map((g, i) => (
              <li key={i} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug">{g.sub || g.fund}</p>
                  <p className="text-[10.5px] leading-snug text-[#6b8580]">
                    {[g.sub && g.sub !== g.fund ? g.fund : "", g.right, g.n > 1 ? `${g.n} รายการ` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold text-mint-800">{num(g.net)}</p>
              </li>
            ))}
            {rest.length > 0 && (
              <li className="flex gap-3 text-[13px] font-semibold">
                <span className="flex-1">และอีก {rest.length} กองทุนย่อย</span>
                <span className="text-mint-800">{num(rest.reduce((a, g) => a + g.net, 0))}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

const STEPS: { title: string; body: React.ReactNode; tone: string }[] = [
  {
    title: "สร้างกลุ่ม LINE",
    tone: "from-lime-500 to-green-600",
    body: (
      <>
        สร้างกลุ่มใหม่ (หรือเปลี่ยนชื่อกลุ่มเดิม) ให้ชื่อลงท้ายด้วย HC + รหัส 5 หลัก
        <CopyChip text={GROUP} />
      </>
    ),
  },
  {
    title: "เพิ่มเพื่อน “หมอพร้อม”",
    tone: "from-emerald-400 to-mint-600",
    body: <>เชิญบัญชี LINE หมอพร้อม เข้ากลุ่ม หลังจากตั้งชื่อกลุ่มแล้วเท่านั้น</>,
  },
  {
    title: "Admin อนุมัติใน Web portal",
    tone: "from-teal-500 to-cyan-700",
    body: <>Admin หน่วยบริการเข้า CMS MOPH Notify เมนู “กลุ่มบอท” กด “จัดการ” แล้วเลือก “อนุมัติ”</>,
  },
  {
    title: "นำ Client ID / Secret มาใส่",
    tone: "from-indigo-500 to-violet-700",
    body: (
      <>
        กดรูปตา <span aria-hidden>👁</span> ที่ช่อง API Key แล้วนำค่าไปใส่ใน GitHub → Settings → Secrets and variables → Actions
        <span className="mt-2 flex flex-wrap gap-1.5">
          <CopyChip text="MOPH_NOTIFY_CLIENT_KEY" mono />
          <CopyChip text="MOPH_NOTIFY_SECRET_KEY" mono />
        </span>
      </>
    ),
  },
  {
    title: "ทดสอบส่งข้อความ",
    tone: "from-fuchsia-500 to-purple-700",
    body: <>ไปที่แท็บ Actions → “แจ้งเตือนเงินโอน สปสช.” → Run workflow เลือก mode = test ถ้าข้อความเข้ากลุ่มแสดงว่าใช้งานได้</>,
  },
];

function Setup() {
  return (
    <section aria-labelledby="st-h" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-mint-700 dark:text-mint-300">ตั้งค่าครั้งเดียว</p>
          <h2 id="st-h" className="text-xl font-semibold">ขั้นตอนการใช้งาน MOPH Notify</h2>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={i} className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.tone}`} />
            <span className={`inline-flex w-fit items-center rounded-full bg-gradient-to-r ${s.tone} px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white`}>
              STEP {i + 1}
            </span>
            <h3 className="mt-2 font-semibold leading-snug">{s.title}</h3>
            <div className="mt-1 text-sm leading-relaxed text-muted">{s.body}</div>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
        <b>หมายเหตุ:</b> ต้องเปลี่ยนชื่อกลุ่มเป็น “{GROUP}” ก่อน แล้วจึงเพิ่มหมอพร้อมเข้ากลุ่ม เพื่อให้ Chatbot รับรู้ตอนถูกเพิ่มเข้ากลุ่ม
      </p>
    </section>
  );
}

function CopyChip({ text, mono }: { text: string; mono?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        );
      }}
      className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-mint-50 px-2.5 py-1 text-xs font-medium text-mint-800 ring-1 ring-mint-200 transition-colors hover:bg-mint-100 dark:bg-mint-950 dark:text-mint-200 dark:ring-mint-800 ${mono ? "font-mono" : ""}`}
      title="คัดลอก"
    >
      <span className="truncate">{text}</span>
      <span className="shrink-0 text-mint-600 dark:text-mint-300">{done ? "✓" : "⧉"}</span>
    </button>
  );
}
