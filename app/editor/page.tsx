import styles from "./editor.module.css";

export default function EditorPage() {
  return (
    <main className="h-dvh bg-slate-950 text-slate-100">
      <div className={styles.editorGrid}>
        <section className={`${styles.panel} ${styles.topbar}`}>
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Ultrarapid Editor</span>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/70">
                Draft
              </span>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10">
                Undo
              </button>
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10">
                Redo
              </button>
              <button className="rounded-xl border border-indigo-400/40 bg-indigo-500/30 px-3 py-2 text-sm font-semibold hover:bg-indigo-500/40">
                Publish
              </button>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.sidebar}`}>
          <div className={styles.title}>Assets</div>
          <div className="min-h-0 overflow-auto p-3">
            <ul className="space-y-2">
              {["Image 1", "Image 2", "Component A", "Component B"].map((x) => (
                <li key={x} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.canvas}`}>
          <div className={styles.title}>Canvas</div>
          <div className="min-h-0 overflow-auto p-3">
            <div className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-white/60">
              Your editor surface
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.inspector}`}>
          <div className={styles.title}>Inspector</div>
          <div className="min-h-0 overflow-auto p-3 space-y-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-white/70">Name</div>
              <input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20" />
            </label>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.bottom}`}>
          <div className={styles.title}>Timeline / Console</div>
          <div className="min-h-0 overflow-auto p-3 space-y-2">
            {["Track 1", "Track 2", "Track 3"].map((t) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
                {t}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}