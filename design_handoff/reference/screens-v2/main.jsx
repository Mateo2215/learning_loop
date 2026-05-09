// Learning Loop v2 — desktop screens matching the existing repo
// All copy is in Polish, all routes match app/(app)/* structure.

const TopNav = ({ active }) => {
  const items = [
    { id: 'dashboard', label: 'Przegląd' },
    { id: 'materials', label: 'Materiały' },
    { id: 'sessions',  label: 'Sesje', dropdown: true },
    { id: 'stats',     label: 'Statystyki' },
    { id: 'menu',      label: 'Menu', dropdown: true },
  ];
  return (
    <header style={{
      borderBottom: '1px solid var(--border-default)',
      background: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
      backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div style={{
        maxWidth: 1024, margin: '0 auto', padding: '0 16px',
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="serif" style={{ fontSize: 18, letterSpacing: '-0.01em' }}>
          Learning <span style={{ color: 'var(--accent)' }}>Loop</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {items.map(it => (
            <a key={it.id} style={{
              position: 'relative', padding: '8px 12px', borderRadius: 6,
              fontSize: 13, fontWeight: active === it.id ? 500 : 400,
              color: active === it.id ? 'var(--fg-primary)' : 'var(--fg-secondary)',
              background: active === it.id ? 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              cursor: 'pointer',
            }}>
              {it.label}
              {it.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><path d="m6 9 6 6 6-6"/></svg>}
              {active === it.id && (
                <span style={{ position: 'absolute', insetInline: 12, bottom: -1, height: 2, borderRadius: 1, background: 'var(--accent)' }} />
              )}
            </a>
          ))}
          <div style={{ marginLeft: 8, paddingLeft: 12, borderLeft: '1px solid var(--border-default)' }}>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: 4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};

// 01 · PRZEGLĄD (Dashboard)
const PrzegladScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="dashboard" />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <div className="uppercase-label" style={{ marginBottom: 8 }}>środa, 6 maja</div>
      <h1 className="serif" style={{ fontSize: 48, lineHeight: 1.05, margin: '0 0 32px' }}>
        Witaj z powrotem, <span style={{ color: 'var(--fg-muted)' }}>Mateusz.</span>
      </h1>

      {/* Today focus row — 2 cards: most pressing thing + streak */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 16, marginBottom: 28 }}>
        <a style={{
          display: 'block',
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-surface) 65%)',
          border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          borderRadius: 16, padding: 24, cursor: 'pointer',
        }}>
          <div className="uppercase-label" style={{ color: 'var(--accent)', marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: -2, marginRight: 4 }}>
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
            Dzisiejsza pętla
          </div>
          <h2 className="serif" style={{ fontSize: 28, lineHeight: 1.15, margin: '0 0 8px' }}>
            92 fiszki czekają. <span style={{ color: 'var(--fg-muted)' }}>Około 14 minut.</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: '0 0 18px', maxWidth: 520 }}>
            Ostatnia sesja: wczoraj, 23:18. Skupiasz się głównie na <em>DCF 4</em> i <em>Wartości pieniądza w czasie</em>.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary">
              Zacznij powtórki
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
            <button className="btn btn-outline">+ Nowy materiał</button>
          </div>
        </a>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="uppercase-label">Seria</div>
            <span className="chip chip-accent">aktywna</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="serif" style={{ fontSize: 56, lineHeight: 0.95, color: 'var(--accent)' }}>1</span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>dzień z rzędu</span>
          </div>
          {/* 7-day mini calendar */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['Cz','Pt','Sb','Nd','Pn','Wt','Śr'].map((d, i) => {
              const filled = i === 6;
              const hadActivity = [false, true, false, false, true, false, true][i];
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', aspectRatio: '1', borderRadius: 6,
                    background: filled ? 'var(--accent)' : hadActivity ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    border: '1px solid ' + (filled ? 'var(--accent)' : 'var(--border-default)'),
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'Geist Mono, monospace' }}>{d}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            Najlepsza seria: <strong style={{ color: 'var(--fg-primary)' }}>14 dni</strong>
          </div>
        </div>
      </div>

      {/* Do zrobienia dziś */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Do zrobienia dziś</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { val: 92, lbl: 'fiszek do powtórki', accent: true, route: '/sessions/review' },
          { val: 1,  lbl: 'audyt na dziś',      accent: true, route: '/sessions/audit', sub: 'Wartość pieniądza w czasie · 4d zaległy' },
          { val: 0,  lbl: 'otwartych luk',      accent: false, route: '/gaps' },
        ].map((s, i) => (
          <a key={i} style={{
            display: 'block', padding: 20, borderRadius: 12,
            border: '1px solid ' + (s.accent ? 'color-mix(in srgb, var(--accent) 60%, transparent)' : 'var(--border-default)'),
            background: s.accent ? 'color-mix(in srgb, var(--accent-soft) 40%, transparent)' : 'var(--bg-surface)',
            cursor: 'pointer',
          }}>
            <div className="serif" style={{
              fontSize: 36, lineHeight: 1, color: s.accent ? 'var(--accent)' : 'var(--fg-primary)',
            }}>{s.val}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 8 }}>{s.lbl}</div>
            {s.sub && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>{s.sub}</div>}
          </a>
        ))}
      </div>

      {/* Świeże materiały — list */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="uppercase-label">Świeże materiały</div>
        <a style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Wszystkie →
        </a>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {[
          { title: 'DCF 4',  cat: 'Finanse', date: '3 maja 2026', items: '32 fiszki · 7 pytań', fresh: true },
          { title: 'DCF 3',  cat: 'Finanse', date: '3 maja 2026', items: '28 fiszek · 7 pytań' },
          { title: 'DCF 2',  cat: 'Finanse', date: '2 maja 2026', items: '24 fiszek · 7 pytań' },
        ].map((m, i, arr) => (
          <div key={i} style={{
            padding: '14px 20px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--accent-soft)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</span>
                {m.fresh && <span className="chip chip-accent">świeży</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                {m.cat} · {m.date} · {m.items}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-muted)' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        ))}
      </div>

      {/* Snapshot biblioteki */}
      <div className="uppercase-label" style={{ marginTop: 32, marginBottom: 12 }}>Twoja biblioteka</div>
      <div className="card" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: 20,
      }}>
        {[
          { val: 5,        lbl: 'materiałów',     mono: false },
          { val: 138,      lbl: 'pytań i fiszek', mono: false },
          { val: '$0.210', lbl: 'koszt miesiąca · projekcja $1.08', mono: true },
        ].map((s, i) => (
          <div key={i}>
            <div className={s.mono ? 'mono' : 'serif'} style={{ fontSize: 28, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6 }}>{s.lbl}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 8 }}>
        Pełne statystyki postępów → <a style={{ color: 'var(--accent)' }}>Statystyki</a>
      </p>
    </main>
  </div>
);

// 02 · MATERIAŁY (Library)
const MaterialyScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNav active="materials" />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: 0 }}>
            Materiały <span style={{ color: 'var(--fg-muted)' }}>· 5</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '8px 0 0', maxWidth: 480 }}>
            Wszystkie wgrane źródła. Kliknij, by zobaczyć fiszki, pytania i postęp utrwalania.
          </p>
        </div>
        <button className="btn btn-primary">+ Nowy</button>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 360,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: 'var(--fg-muted)' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Szukaj w materiałach…</span>
        </div>
        {['Wszystkie · 5', 'Finanse · 5', 'AI · 0'].map((t, i) => (
          <button key={i} className={i === 0 ? 'btn btn-outline' : 'btn btn-ghost'} style={{
            fontSize: 12, padding: '6px 12px',
            ...(i === 0 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}),
          }}>{t}</button>
        ))}
      </div>

      {/* Month group header */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Maj 2026</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { title: 'DCF 4', date: '3 maja', fsrs: { mastered: 18, young: 8, learning: 4, total: 32 }, q: 7, tags: ['discounted cash flow', 'wycena firm', 'analiza finansowa'], due: 14 },
          { title: 'DCF 3', date: '3 maja', fsrs: { mastered: 12, young: 9, learning: 7, total: 28 }, q: 7, tags: ['discounted cash flow', 'wycena przedsiębiorstw', 'inwestycje'], due: 9 },
          { title: 'DCF 2', date: '2 maja', fsrs: { mastered: 14, young: 6, learning: 4, total: 24 }, q: 7, tags: ['discounted cash flow', 'wycena firm'] },
          { title: 'DCF',   date: '2 maja', fsrs: { mastered: 16, young: 4, learning: 6, total: 26 }, q: 7, tags: ['discounted cash flow', 'analiza finansowa'], due: 6 },
        ].map((m, i) => {
          const pct = (k) => `${(m.fsrs[k] / m.fsrs.total) * 100}%`;
          return (
            <div key={i} className="card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em', marginBottom: 2 }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'Geist Mono, monospace' }}>
                    Finanse · {m.date} 2026
                  </div>
                </div>
                {m.due ? (
                  <span className="chip chip-accent">{m.due} due</span>
                ) : (
                  <span className="chip">opanowany</span>
                )}
              </div>

              {/* FSRS distribution bar */}
              <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex', background: 'var(--bg-elevated)', marginBottom: 8 }}>
                <div style={{ width: pct('mastered'), background: 'var(--success)' }} />
                <div style={{ width: pct('young'), background: 'var(--accent)' }} />
                <div style={{ width: pct('learning'), background: 'var(--warning)' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-muted)', marginBottom: 12 }}>
                <span><span style={{ color: 'var(--success)' }}>●</span> {m.fsrs.mastered} mature</span>
                <span><span style={{ color: 'var(--accent)' }}>●</span> {m.fsrs.young} young</span>
                <span><span style={{ color: 'var(--warning)' }}>●</span> {m.fsrs.learning} learning</span>
                <span style={{ marginLeft: 'auto' }}>{m.q} pytań</span>
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {m.tags.map(t => <span key={t} className="chip">{t}</span>)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Old material example */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Kwiecień 2026</div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: 0.85 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--bg-elevated)', color: 'var(--fg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Wartość pieniądza w czasie</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
            Finanse · 28 kwietnia · 28 fiszek · 15 pytań · audyt 7d zaległy
          </div>
        </div>
        <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--warning)' }}>audyt zaległy</span>
      </div>
    </main>
  </div>
);

window.PrzegladScreen = PrzegladScreen;
window.MaterialyScreen = MaterialyScreen;
