"use client";

import { useState, useSyncExternalStore } from "react";
import NotifyPanel from "./notify-panel";

type View = "smt" | "mis" | "notify";

const VIEWS: { id: View; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: "smt", label: "เงินโอน สปสช.", hint: "Smart Money Transfer", icon: <CoinIcon /> },
  { id: "mis", label: "ผลงาน MIS", hint: "บริการและการชดเชย", icon: <ChartIcon /> },
  { id: "notify", label: "แจ้งเตือน LINE", hint: "MOPH Notify", icon: <BellIcon /> },
];

const FRAMES: Record<Exclude<View, "notify">, { src: string; title: string }> = {
  smt: { src: "/dashboards/smt/index.html", title: "แดชบอร์ดเงินโอน สปสช. บุรีรัมย์" },
  mis: { src: "/dashboards/mis/index.html", title: "แดชบอร์ดผลงานบริการ MIS บุรีรัมย์" },
};

function isView(v: string | null): v is View {
  return v === "smt" || v === "mis" || v === "notify";
}

// the selected view lives in ?view= so a link can open a specific page
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
function readView(): View {
  const v = new URLSearchParams(window.location.search).get("view");
  return isView(v) ? v : "smt";
}
function writeView(v: View) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", v);
  window.history.replaceState(null, "", url);
  listeners.forEach((l) => l());
}

export default function AppShell() {
  const view = useSyncExternalStore(subscribe, readView, () => "smt" as View);
  // frames are mounted on first visit (so they lay out at full size) and then kept alive to preserve filters
  const [visited, setVisited] = useState<ReadonlySet<View>>(() => new Set<View>(["smt"]));
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const isMounted = (v: View) => v === view || visited.has(v);

  const select = (v: View) => {
    setVisited((s) => new Set([...s, view, v]));
    writeView(v);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = VIEWS[(i + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  const frame = view === "notify" ? null : FRAMES[view];

  return (
    <div className="flex h-full flex-col">
      <header className="z-10 shrink-0 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-white shadow-sm shadow-mint-700/30">
              <PulseIcon />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tracking-tight">Planfin</span>
                <span className="rounded-full bg-mint-100 px-2 py-0.5 text-xs font-medium text-mint-800 dark:bg-mint-900 dark:text-mint-200">
                  HC10909
                </span>
              </div>
              <div className="truncate text-xs text-muted">โรงพยาบาลพลับพลาชัย · จ.บุรีรัมย์</div>
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="เลือกหน้าที่ต้องการดู"
            className="order-last grid w-full grid-cols-3 gap-1 rounded-2xl bg-mint-50 p-1 ring-1 ring-line sm:order-none sm:ml-auto sm:flex sm:w-auto dark:bg-mint-950"
          >
            {VIEWS.map((v, i) => {
              const active = v.id === view;
              return (
                <button
                  key={v.id}
                  id={`tab-${v.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${v.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(v.id)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={`group flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium sm:flex-row sm:gap-2 sm:px-4 sm:text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-500 sm:justify-start ${
                    active
                      ? "bg-mint-600 text-white shadow-md shadow-mint-700/25"
                      : "text-mint-900 hover:bg-white hover:text-mint-700 dark:text-mint-200 dark:hover:bg-mint-900"
                  }`}
                >
                  <span className={`shrink-0 ${active ? "text-white" : "text-mint-600 dark:text-mint-300"}`}>{v.icon}</span>
                  <span className="flex min-w-0 max-w-full flex-col items-center leading-tight sm:items-start">
                    <span className="max-w-full truncate">{v.label}</span>
                    <span className={`hidden text-[11px] font-normal lg:block ${active ? "text-mint-50/90" : "text-muted"}`}>{v.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {frame && (
            <a
              href={frame.src}
              target="_blank"
              rel="noopener"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted ring-1 ring-line transition-colors hover:text-mint-700 hover:ring-mint-400 md:inline-flex"
              title="เปิดหน้านี้ในแท็บใหม่"
            >
              <ExternalIcon />
              <span>เต็มจอ</span>
            </a>
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {(Object.keys(FRAMES) as (keyof typeof FRAMES)[]).map((id) => {
          if (!isMounted(id)) return null;
          const active = view === id;
          return (
            <div
              key={id}
              id={`panel-${id}`}
              role="tabpanel"
              aria-labelledby={`tab-${id}`}
              aria-hidden={!active}
              className={`absolute inset-0 ${active ? "visible" : "pointer-events-none invisible"}`}
            >
              {!loaded[id] && <FrameSkeleton />}
              <iframe
                src={FRAMES[id].src}
                title={FRAMES[id].title}
                onLoad={() => setLoaded((l) => ({ ...l, [id]: true }))}
                className={`size-full border-0 transition-opacity duration-300 ${loaded[id] ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          );
        })}
        {isMounted("notify") && (
          <div
            id="panel-notify"
            role="tabpanel"
            aria-labelledby="tab-notify"
            hidden={view !== "notify"}
            className="absolute inset-0 overflow-y-auto"
          >
            <NotifyPanel />
          </div>
        )}
      </main>
    </div>
  );
}

function FrameSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-live="polite">
      <div className="h-36 bg-mint-100/60 dark:bg-mint-950" />
      <div className="mx-auto max-w-[1180px] space-y-4 px-5 py-6">
        <div className="flex flex-wrap gap-3">
          {[120, 180, 140, 220].map((w) => (
            <div key={w} className="skeleton h-10 rounded-xl" style={{ width: w }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-2xl" />
        <p className="text-center text-sm text-muted">กำลังโหลดแดชบอร์ด…</p>
      </div>
    </div>
  );
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function CoinIcon() {
  return <Svg><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.6 1.4 5.6 4.2 0 1.3-1.2 2.1-2.8 2.1-1.3 0-2.4-.6-2.9-1.5M12 6.2v1.6M12 16.2v1.6" /></Svg>;
}
function ChartIcon() {
  return <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
}
function BellIcon() {
  return <Svg><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></Svg>;
}
function ExternalIcon() {
  return <Svg><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
}
function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}
