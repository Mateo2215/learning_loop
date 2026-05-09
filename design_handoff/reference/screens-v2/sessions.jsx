// Learning Loop v2 — sesje (review + deep dive)

const TopNavRef = () => {
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
      backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 16px',
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="serif" style={{ fontSize: 18 }}>
          Learning <span style={{ color: 'var(--accent)' }}>Loop</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {items.map(it => (
            <a key={it.id} style={{
              position: 'relative', padding: '8px 12px', borderRadius: 6,
              fontSize: 13, fontWeight: it.id === 'sessions' ? 500 : 400,
              color: it.id === 'sessions' ? 'var(--fg-primary)' : 'var(--fg-secondary)',
              background: it.id === 'sessions' ? 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)' : 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {it.label}
              {it.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><path d="m6 9 6 6 6-6"/></svg>}
              {it.id === 'sessions' && (
                <span style={{ position: 'absolute', insetInline: 12, bottom: -1, height: 2, borderRadius: 1, background: 'var(--accent)' }} />
              )}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
};

// 03 · SESJA POWTÓREK (Fiszki) — full-screen, no nav
const ReviewSessionScreen = () => {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="ll2" style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-canvas)',
    }}>
      {/* Minimal session topbar */}
      <header style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            Wyjdź
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border-default)' }} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>1 / 20</span>
          <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>Wartość pieniądza w czasie</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--fg-muted)' }}>
          <span className="mono">Nowa</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            01:24
          </span>
        </div>
      </header>

      {/* Progress strip */}
      <div style={{ padding: '8px 24px', display: 'flex', gap: 3 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: i === 0 ? 'var(--accent)' : 'var(--border-default)',
          }} />
        ))}
      </div>

      {/* Card stage */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
        position: 'relative',
      }}>
        {/* Material chip top center */}
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}>
          <span className="chip">cloze · trudność 2/5</span>
        </div>

        <div className="serif" style={{
          fontSize: 38, lineHeight: 1.25, textAlign: 'center', maxWidth: 720,
          margin: '0 0 32px', letterSpacing: '-0.015em',
        }}>
          Wzór na Wartość Teraźniejszą to:{' '}
          {revealed ? (
            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>PV = FV / (1 + r)<sup>n</sup></span>
          ) : (
            <span style={{ color: 'var(--fg-muted)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.05em' }}>______</span>
          )}.
        </div>

        {revealed && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 12, padding: '16px 20px', maxWidth: 560,
            fontSize: 13, color: 'var(--fg-secondary)', lineHeight: 1.55,
          }}>
            <div className="uppercase-label" style={{ marginBottom: 8 }}>Kontekst ze źródła</div>
            "Wartość teraźniejsza dyskontuje przyszłe przepływy stopą oczekiwanej rentowności,
            pozwalając porównać przepływy z różnych okresów na wspólnej skali."
          </div>
        )}
      </div>

      {/* Footer — either reveal CTA or grading row */}
      <footer style={{ padding: '20px 24px', borderTop: '1px solid var(--border-default)' }}>
        {!revealed ? (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => setRevealed(true)} className="btn btn-primary" style={{
              width: '100%', height: 52, fontSize: 14, justifyContent: 'center',
            }}>
              Pokaż odpowiedź
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fg-muted)', marginTop: 10 }}>
              <span className="mono" style={{
                padding: '2px 6px', border: '1px solid var(--border-default)', borderRadius: 4,
                background: 'var(--bg-surface)',
              }}>Spacja</span> = pokaż odpowiedź
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 720, margin: '0 auto' }}>
            {[
              { k: '1', label: 'Znów',      next: '<1 min',  color: 'var(--danger)',  bg: 'color-mix(in srgb, var(--danger) 18%, transparent)' },
              { k: '2', label: 'Trudne',    next: '6 min',   color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 18%, transparent)' },
              { k: '3', label: 'Dobrze',    next: '10 dni',  color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 18%, transparent)' },
              { k: '4', label: 'Łatwe',     next: '4 tyg.',  color: 'var(--accent-2)',bg: 'color-mix(in srgb, var(--accent-2) 18%, transparent)' },
            ].map(g => (
              <button key={g.k} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: g.bg, color: g.color, fontFamily: 'inherit',
                position: 'relative',
              }}>
                <span className="mono" style={{ position: 'absolute', top: 6, left: 8, fontSize: 10, opacity: 0.6 }}>{g.k}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g.label}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{g.next}</span>
              </button>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
};

// 04 · DEEP DIVE — material picker + active question
const DeepDiveScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNavRef />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: '0 0 8px' }}>Deep Dive</h1>
      <p style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '0 0 8px', maxWidth: 560 }}>
        Wybierz materiał, na którym chcesz przepracować pytania otwarte. AI oceni Twoje odpowiedzi.
      </p>
      <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 32px' }}>
        Każda odpowiedź to ~30s analizy przez Sonnet · ok. $0.012 za pytanie.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
        {/* Picker */}
        <div>
          <div className="uppercase-label" style={{ marginBottom: 12 }}>Twoje materiały</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { title: 'DCF 4',              cat: 'Finanse', q: 7,  status: 'aktywne', selected: true },
              { title: 'DCF 3',              cat: 'Finanse', q: 7 },
              { title: 'DCF 2',              cat: 'Finanse', q: 7 },
              { title: 'DCF',                cat: 'Finanse', q: 7 },
              { title: 'Wartość pieniądza w czasie', cat: 'Finanse', q: 15, status: 'audyt 7d' },
            ].map((m, i) => (
              <a key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid ' + (m.selected ? 'var(--accent)' : 'var(--border-default)'),
                background: m.selected ? 'color-mix(in srgb, var(--accent-soft) 50%, transparent)' : 'var(--bg-surface)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: m.selected ? 'var(--accent)' : 'var(--fg-primary)' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {m.cat} · {m.q} pytań otwartych
                  </div>
                </div>
                {m.status && <span className="chip">{m.status}</span>}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: m.selected ? 'var(--accent)' : 'var(--fg-muted)' }}>
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Active question preview */}
        <div>
          <div className="uppercase-label" style={{ marginBottom: 12 }}>Pytanie 3 / 7</div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="chip">DCF 4</span>
                <span className="chip" style={{ color: 'var(--accent-2)' }}>synteza</span>
              </div>
              <div className="serif" style={{ fontSize: 19, lineHeight: 1.4, color: 'var(--fg-primary)' }}>
                Wyjaśnij, dlaczego stopa dyskontowa rośnie wraz ze wzrostem ryzyka projektu — i co
                to oznacza w praktyce dla wyceny start-upów.
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <div className="uppercase-label" style={{ marginBottom: 8 }}>Twoja odpowiedź</div>
              <div style={{
                minHeight: 140, padding: 14, borderRadius: 8,
                border: '1px solid var(--border-default)', background: 'var(--bg-canvas)',
                fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55,
              }}>
                Pisz tutaj. AI oceni argumentację, kompletność i jakość przykładów…
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                  ~$0.012 · Sonnet 4.6
                </span>
                <button className="btn btn-primary">Wyślij do oceny →</button>
              </div>
            </div>
          </div>

          {/* Previous answer score */}
          <div className="uppercase-label" style={{ marginTop: 24, marginBottom: 12 }}>Poprzednia ocena</div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Pytanie 2/7 · 03.05 21:38</span>
              <span className="chip" style={{ background: 'color-mix(in srgb, var(--success) 25%, transparent)', color: 'var(--success)' }}>
                4 / 5
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-secondary)', lineHeight: 1.5 }}>
              "Dobra struktura argumentu. Brakuje jednak rozróżnienia między ryzykiem
              systematycznym a specyficznym — w wycenie start-upów to drugie..."
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
);

window.ReviewSessionScreen = ReviewSessionScreen;
window.DeepDiveScreen = DeepDiveScreen;
