// MOPH Notify (หมอพร้อม LINE OA) client and the Flex message we send for new transfers.
// API: POST {URL}/api/notify/send with headers client-key / secret-key, body { messages: [LINE message objects] }.

export const NOTIFY_URL = process.env.MOPH_NOTIFY_URL || 'https://morpromt2f.moph.go.th/api/notify/send';

const MINT = '#14A47F';
const MINT_DARK = '#0B6E57';
const MINT_SOFT = '#E7F8F1';
const INK = '#0E3B33';
const MUTED = '#6B8580';

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** 25691012 -> "12 ต.ค. 2569" */
export function thDate(k) {
  const y = Math.floor(k / 10000), m = Math.floor(k / 100) % 100, d = k % 100;
  return `${d} ${TH_M[m - 1] || '?'} ${y}`;
}

export const baht = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Right (สิทธิ) from fund name / account code, same rule as the dashboard. */
export function rightOf(fund, account) {
  if (/ส่วนท้องถิ่น/.test(fund) || /80[12]/.test(account)) return 'อปท.';
  if (/ประกันสังคม/.test(fund)) return 'ประกันสังคม';
  if (/ข้าราชการ|กรมบัญชีกลาง/.test(fund)) return 'ข้าราชการ';
  if (/ต่างด้าว/.test(fund)) return 'ต่างด้าว';
  return 'บัตรทอง';
}

export async function sendNotify(messages, { clientKey, secretKey } = {}) {
  const res = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'client-key': clientKey, 'secret-key': secretKey },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(30_000),
  });
  let j = null;
  try { j = await res.json(); } catch { /* non-JSON error page */ }
  const code = j && (j.message_code ?? j.status);
  if (!res.ok || (code !== undefined && Number(code) !== 200)) {
    throw new Error(`MOPH Notify failed: HTTP ${res.status} ${j ? JSON.stringify(j) : ''}`.trim());
  }
  return j;
}

const txt = (text, extra = {}) => ({ type: 'text', text: String(text), ...extra });

function lineRow(label, sub, amount) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md',
    contents: [
      {
        type: 'box', layout: 'vertical', flex: 7,
        contents: [
          txt(label, { size: 'sm', color: INK, wrap: true, weight: 'bold' }),
          ...(sub ? [txt(sub, { size: 'xxs', color: MUTED, wrap: true })] : []),
        ],
      },
      txt(baht(amount), { size: 'sm', color: MINT_DARK, align: 'end', weight: 'bold', flex: 4, gravity: 'top' }),
    ],
  };
}

const MAX_LINES = 10;

/**
 * One Flex bubble summarising every new transfer line posted on one date.
 * Lines are grouped by fund + sub-fund so "where the money came from" reads at a glance.
 */
export function transferBubble({ hospital, hcode, date, rows, dashboardUrl }) {
  const net = rows.reduce((a, r) => a + r.net, 0);
  const wait = rows.reduce((a, r) => a + r.wait, 0);
  const deduct = rows.reduce((a, r) => a + r.deduct, 0);

  const groups = new Map();
  for (const r of rows) {
    const k = `${r.fund}\u0000${r.sub}`;
    const g = groups.get(k) || { fund: r.fund, sub: r.sub, right: rightOf(r.fund, r.account), net: 0, n: 0 };
    g.net += r.net; g.n += 1;
    groups.set(k, g);
  }
  const list = [...groups.values()].sort((a, b) => b.net - a.net);
  const shown = list.slice(0, MAX_LINES);
  const rest = list.slice(MAX_LINES);

  const body = [
    txt('ยอดโอนเข้าบัญชีสุทธิ', { size: 'xs', color: MUTED }),
    txt(`${net < 0 ? '-' : ''}฿${baht(Math.abs(net))}`, { size: 'xxl', weight: 'bold', color: MINT_DARK, adjustMode: 'shrink-to-fit' }),
    txt(`${rows.length} รายการ · ${list.length} กองทุนย่อย`, { size: 'xs', color: MUTED, margin: 'xs' }),
  ];
  if (wait > 0 || deduct > 0) {
    const parts = [];
    if (wait > 0) parts.push(`ชะลอ ${baht(wait)}`);
    if (deduct > 0) parts.push(`หัก ${baht(deduct)}`);
    body.push(txt(parts.join(' · '), { size: 'xs', color: '#A35F00', margin: 'sm', wrap: true }));
  }
  body.push({ type: 'separator', margin: 'lg', color: '#CFEBE1' });
  body.push(txt('เงินมาจาก', { size: 'xs', color: MUTED, margin: 'lg', weight: 'bold' }));
  for (const g of shown) {
    const label = g.sub || g.fund || '-';
    const sub = [g.sub && g.sub !== g.fund ? g.fund : '', g.right, g.n > 1 ? `${g.n} รายการ` : ''].filter(Boolean).join(' · ');
    body.push(lineRow(label, sub, g.net));
  }
  if (rest.length) {
    const restNet = rest.reduce((a, g) => a + g.net, 0);
    body.push(lineRow(`และอีก ${rest.length} กองทุนย่อย`, '', restNet));
  }

  const bubble = {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: MINT, paddingAll: '16px',
      contents: [
        txt('💰 เงินโอนเข้า สปสช.', { size: 'md', weight: 'bold', color: '#FFFFFF' }),
        txt(`${hospital} · HC${hcode}`, { size: 'xs', color: '#E6FFF6', wrap: true, margin: 'xs' }),
        txt(`วันที่โอน ${thDate(date)}`, { size: 'xs', color: '#E6FFF6', margin: 'xs' }),
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#FFFFFF', contents: body },
  };
  if (dashboardUrl) {
    bubble.styles = { footer: { backgroundColor: MINT_SOFT } };
    bubble.footer = {
      type: 'box', layout: 'vertical', paddingAll: '10px',
      contents: [{
        type: 'button', style: 'primary', color: MINT, height: 'sm',
        action: { type: 'uri', label: 'ดูรายละเอียดในแดชบอร์ด', uri: dashboardUrl },
      }],
    };
  }
  return {
    type: 'flex',
    altText: `เงินโอนเข้า HC${hcode} ${thDate(date)} สุทธิ ${baht(net)} บาท (${rows.length} รายการ)`,
    contents: bubble,
  };
}
