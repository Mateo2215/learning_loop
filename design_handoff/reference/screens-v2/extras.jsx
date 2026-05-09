// Learning Loop v3 — dodatkowe ekrany:
// Deep Dive (active/full-screen) · Audyty · Statystyki · Ustawienia · Koszty

const TopNavX = ({ active }) => {
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
          {items.map(it => {
            const isActive = active === it.id;
            return (
              <a key={it.id} style={{
                position: 'relative', padding: '8px 12px', borderRadius: 6,
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                background: isActive ? 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)' : 'transparent',
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              }}>
                {it.label}
                {it.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><path d="m6 9 6 6 6-6"/></svg>}
                {isActive && <span style={{ position: 'absolute', insetInline: 12, bottom: -1, height: 2, borderRadius: 1, background: 'var(--accent)' }} />}
              </a>
            );
          })}
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

// 06 · DEEP DIVE — aktywne pytanie (full-screen, jak na screenshocie)
const DeepDiveActiveScreen = () => (
  <div className="ll2" style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: 'var(--bg-canvas)', overflow: 'hidden',
  }}>
    <header style={{
      padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 12, color: 'var(--fg-muted)',
    }}>
      <span className="mono">1 / 7</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ color: 'var(--fg-secondary)' }}>Deep Dive</span>
        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>
          Zakończ
        </button>
      </div>
    </header>

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      maxWidth: 880, margin: '0 auto', width: '100%', padding: '0 32px 80px' }}>
      <div className="uppercase-label" style={{ marginBottom: 14, color: 'var(--accent)' }}>
        DCF 4 · synteza · pp. 12–14
      </div>
      <div className="serif" style={{
        fontSize: 30, lineHeight: 1.35, letterSpacing: '-0.015em',
        color: 'var(--fg-primary)', marginBottom: 36, fontWeight: 500,
      }}>
        Wyjaśnij, dlaczego Warren Buffett i fundusze private equity opierają się na Model DCF
        zamiast na zysku netto jako mierze wartości firmy. Jakie są konkretne zalety gotówki w stosunku do zysku?
      </div>

      <div style={{
        position: 'relative',
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 12, padding: '14px 56px 14px 18px',
      }}>
        <div style={{ fontSize: 14, color: 'var(--fg-muted)', minHeight: 40, lineHeight: 1.55 }}>
          Wpisz swoją odpowiedź…
        </div>
        <button style={{
          position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 8,
          background: 'var(--bg-elevated)', color: 'var(--fg-secondary)',
          border: '1px solid var(--border-default)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16,
        fontSize: 11, color: 'var(--fg-muted)' }}>
        <span>~30s analizy · Sonnet 4.6 · ok. $0.012</span>
        <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
          Wyślij do oceny →
        </button>
      </div>
    </div>

    <footer style={{ padding: '16px 28px', borderTop: '1px solid var(--border-default)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 11, color: 'var(--fg-muted)' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ width: 24, height: 3, borderRadius: 2,
            background: i === 0 ? 'var(--accent)' : 'var(--border-default)' }} />
        ))}
      </div>
      <span>
        <span className="mono" style={{ padding: '2px 6px', border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-surface)' }}>⌘ ↵</span> wyślij ·
        <span className="mono" style={{ padding: '2px 6px', border: '1px solid var(--border-default)', borderRadius: 4, background: 'var(--bg-surface)', marginLeft: 8 }}>Esc</span> zakończ
      </span>
    </footer>
  </div>
);

// 07 · AUDYTY
const AudytyScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNavX active="sessions" />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: '0 0 8px' }}>
        Audyty <span style={{ color: 'var(--fg-muted)' }}>· 1</span>
      </h1>
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '0 0 28px', maxWidth: 540 }}>
        Sprawdzenie utrwalenia po 7, 30 i 90 dniach. AI generuje świeże pytania kontrolne na bazie materiału.
      </p>

      {/* Schedule legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: '7d audyt', desc: 'tydzień po nauce', color: 'var(--accent)' },
          { label: '30d audyt', desc: 'miesiąc po nauce', color: 'var(--accent-2)' },
          { label: '90d audyt', desc: 'kwartał po nauce', color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="mono" style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'color-mix(in srgb, ' + s.color + ' 22%, transparent)',
              color: s.color, fontWeight: 500,
            }}>{s.label}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Due audits */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Zaległe</div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        {[
          { tag: '7D', tagColor: 'var(--warning)', title: 'Wartość pieniądza w czasie',
            sub: '7d zaległy · ostatnia nauka 28 kwietnia', cta: 'Zacznij' },
        ].map((a, i) => (
          <div key={i} style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <span className="mono" style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 4,
              background: 'color-mix(in srgb, ' + a.tagColor + ' 22%, transparent)',
              color: a.tagColor, fontWeight: 600,
            }}>{a.tag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{a.sub}</div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
              {a.cta} →
            </button>
          </div>
        ))}
      </div>

      {/* Upcoming */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Nadchodzące</div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        {[
          { tag: '7D',  tagColor: 'var(--accent)',   title: 'DCF 4', sub: 'za 4 dni · 10 maja' },
          { tag: '7D',  tagColor: 'var(--accent)',   title: 'DCF 3', sub: 'za 5 dni · 11 maja' },
          { tag: '30D', tagColor: 'var(--accent-2)', title: 'DCF 2', sub: 'za 24 dni · 1 czerwca' },
          { tag: '90D', tagColor: 'var(--success)',  title: 'DCF',   sub: 'za 78 dni · 25 lipca' },
        ].map((a, i, arr) => (
          <div key={i} style={{
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
          }}>
            <span className="mono" style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 4,
              background: 'color-mix(in srgb, ' + a.tagColor + ' 18%, transparent)',
              color: a.tagColor, fontWeight: 500,
            }}>{a.tag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{a.sub}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>zaplanowany</span>
          </div>
        ))}
      </div>

      {/* Recent done */}
      <div className="uppercase-label" style={{ marginBottom: 12 }}>Ostatnio wykonane</div>
      <div className="card" style={{ padding: 0 }}>
        {[
          { date: '1 maja',  title: 'DCF',   tag: '30D', score: '5/7', good: true },
          { date: '24 kwie', title: 'DCF 2', tag: '7D',  score: '6/7', good: true },
          { date: '21 kwie', title: 'DCF 3', tag: '7D',  score: '4/7', good: false },
        ].map((a, i, arr) => (
          <div key={i} style={{
            padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
          }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', width: 60 }}>
              {a.date}
            </span>
            <span style={{ flex: 1, fontSize: 13 }}>{a.title}</span>
            <span className="chip">{a.tag}</span>
            <span className="mono" style={{
              fontSize: 12,
              color: a.good ? 'var(--success)' : 'var(--warning)',
              fontWeight: 500,
            }}>{a.score}</span>
          </div>
        ))}
      </div>
    </main>
  </div>
);

// 08 · STATYSTYKI
const StatystykiScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNavX active="stats" />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <div className="uppercase-label" style={{ marginBottom: 8 }}>Postępy</div>
      <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: '0 0 10px' }}>Statystyki</h1>
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '0 0 28px', maxWidth: 580 }}>
        Jak idzie nauka? Tygodniowa dynamika, opanowane fiszki, ciągłość codziennych powtórek i koszty AI.
      </p>

      {/* Top: this week + efficacy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{
          padding: 20, borderRadius: 12,
          background: 'color-mix(in srgb, var(--accent-soft) 35%, var(--bg-surface))',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
        }}>
          <div className="uppercase-label" style={{ color: 'var(--accent)', marginBottom: 10 }}>W tym tygodniu</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="serif" style={{ fontSize: 44, lineHeight: 1, color: 'var(--accent)' }}>9</span>
            <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>powtórek</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M17 7H8M17 7v9"/></svg>
            +5 vs poprzedni tydzień
          </div>
        </div>
        <div className="card">
          <div className="uppercase-label" style={{ marginBottom: 10 }}>Skuteczność tego tygodnia</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span className="serif" style={{ fontSize: 44, lineHeight: 1 }}>56%</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>5 / 9 poprawnych</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M17 7H8M17 7v9"/></svg>
            +56 pp vs poprzedni
          </div>
        </div>
      </div>

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {[
          { val: '0', lbl: 'dni z rzędu', icon: '🔥', accent: true },
          { val: '0', lbl: 'opanowanych' },
          { val: '138', lbl: 'aktywnych' },
          { val: '0', lbl: 'problematycznych' },
        ].map((s, i) => (
          <div key={i} className="card" style={{
            padding: 16,
            ...(s.accent ? { borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' } : {}),
          }}>
            <div className="serif" style={{
              fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 6,
              color: s.accent ? 'var(--accent)' : 'var(--fg-primary)',
            }}>
              {s.icon && <span style={{ fontSize: 14 }}>{s.icon}</span>}
              {s.val}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 className="serif" style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>Aktywność — ostatnie 8 tygodni</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', marginRight: 5, verticalAlign: -1 }} />poprawne</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--bg-elevated)', marginRight: 5, verticalAlign: -1 }} />pomyłki</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 24px' }}>
          Liczba powtórek i pytań tygodniowo. Jaśniejsza część kafelka = poprawne odpowiedzi.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, padding: '0 4px' }}>
          {[
            { w: '16.03', total: 0,  good: 0  },
            { w: '23.03', total: 0,  good: 0  },
            { w: '30.03', total: 0,  good: 0  },
            { w: '06.04', total: 0,  good: 0  },
            { w: '13.04', total: 0,  good: 0  },
            { w: '20.04', total: 0,  good: 0  },
            { w: '27.04', total: 4,  good: 2,  pale: true },
            { w: '04.05', total: 9,  good: 5,  current: true },
          ].map((b, i) => {
            const max = 12;
            const totalH = (b.total / max) * 100;
            const goodH = (b.good / max) * 100;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', minHeight: 1 }}>
                  <div style={{
                    width: '100%', position: 'relative',
                    height: totalH ? totalH + '%' : 2,
                    background: b.total ? 'var(--bg-elevated)' : 'var(--border-default)',
                    borderRadius: 4, overflow: 'hidden',
                    border: b.current ? '1px solid var(--accent)' : 'none',
                  }}>
                    {b.total > 0 && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0,
                        height: (b.good / b.total) * 100 + '%',
                        background: b.current ? 'var(--accent)' : b.pale ? 'color-mix(in srgb, var(--accent) 50%, var(--bg-elevated))' : 'var(--accent)',
                      }} />
                    )}
                  </div>
                </div>
                <span className="mono" style={{
                  fontSize: 10,
                  color: b.current ? 'var(--accent)' : 'var(--fg-muted)',
                  fontWeight: b.current ? 500 : 400,
                }}>{b.w}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Costs preview */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 className="serif" style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>Koszty AI</h3>
          <a style={{ fontSize: 12, color: 'var(--accent)' }}>Zobacz szczegóły →</a>
        </div>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 18px' }}>
          Zużycie API — szczegóły per operacja: <span className="mono" style={{ color: 'var(--accent)' }}>/costs</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { val: '$0.210', lbl: 'ten miesiąc', mono: true },
            { val: '$0',     lbl: 'poprzedni miesiąc', mono: true, muted: true },
            { val: '$0.814', lbl: 'projekcja na koniec', mono: true },
          ].map((c, i) => (
            <div key={i}>
              <div className="mono" style={{ fontSize: 22, color: c.muted ? 'var(--fg-muted)' : 'var(--fg-primary)' }}>
                {c.val}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6 }}>{c.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  </div>
);

// 09 · USTAWIENIA
const UstawieniaScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNavX active="menu" />
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: '0 0 6px' }}>Ustawienia</h1>
      <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 28px' }}>
        Konto: <span className="mono" style={{ color: 'var(--fg-secondary)' }}>matrixqr@gmail.com</span>
      </p>

      {/* Theme */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 6px', fontWeight: 600 }}>Motyw</h3>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
              Przełącz między jasnym i ciemnym motywem, lub pozwól aplikacji ustawić go automatycznie po zmroku.
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 8,
          border: '1px solid var(--border-default)', marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Motyw</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>aktualnie aktywny: <span className="mono">dark</span></div>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--fg-secondary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4, marginTop: 2,
            border: '1.5px solid var(--border-strong)', flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Automatycznie przełączaj na ciemny po 19:00</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Wymusza ciemny tryb między 19:00 a 6:00, jasny w pozostałych godzinach. Gdy włączone, ręczny wybór motywu jest ignorowany.
            </div>
          </div>
        </label>
      </div>

      {/* AI calibration */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 6px', fontWeight: 600 }}>Kalibracja AI</h3>
            <p style={{ fontSize: 12, color: 'var(--fg-secondary)', margin: '0 0 16px', lineHeight: 1.55 }}>
              Na podstawie Twoich kalibracji (<span className="mono" style={{ color: 'var(--danger)' }}>Za surowo</span> / <span className="mono" style={{ color: 'var(--success)' }}>Trafnie</span> / <span className="mono" style={{ color: 'var(--warning)' }}>Za pobłażliwie</span>) AI dostosowuje surowość ocen w każdej kategorii.
            </p>
          </div>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}>
            Przelicz teraz
          </button>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: 'var(--bg-canvas)', border: '1px dashed var(--border-default)',
          fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.55,
        }}>
          Brak danych kalibracyjnych. Po Deep Dive klikaj 3 przyciski (<span className="mono">Za surowo</span>, <span className="mono">Trafnie</span>, <span className="mono">Za pobłażliwie</span>), wtedy AI nauczy się Twoich preferencji.
        </div>
      </div>

      {/* Costs summary */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 600 }}>Koszty</h3>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              <span className="mono" style={{ color: 'var(--fg-secondary)' }}>$0.210</span> / <span className="mono">$5.00</span> miękki limit miesięczny
            </div>
          </div>
          <a style={{ fontSize: 12, color: 'var(--accent)' }}>Szczegóły →</a>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ width: '4.2%', height: '100%', background: 'var(--accent)' }} />
        </div>
      </div>

      {/* Export */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px', fontWeight: 600 }}>Export danych</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
          Pobierz wszystkie swoje materiały, fiszki, sesje, kalibracje i koszty jako jeden plik JSON. Embeddingi i identyfikatory użytkownika są pomijane.
        </p>
        <button className="btn btn-primary" style={{ fontSize: 13 }}>
          Pobierz jako JSON
        </button>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--danger) 40%, var(--border-default))' }}>
        <h3 style={{ fontSize: 15, margin: '0 0 6px', fontWeight: 600, color: 'var(--danger)' }}>Strefa zagrożenia</h3>
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
          Usunięcie konta jest nieodwracalne — wszystkie materiały, fiszki, oceny i historia powtórek znikną.
        </p>
        <button style={{
          fontSize: 13, padding: '8px 14px', borderRadius: 8,
          background: 'transparent', color: 'var(--danger)',
          border: '1px solid color-mix(in srgb, var(--danger) 50%, transparent)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Usuń konto
        </button>
      </div>
    </main>
  </div>
);

// 10 · KOSZTY
const KosztyScreen = () => (
  <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
    <TopNavX active="menu" />
    <main style={{ maxWidth: 1024, margin: '0 auto', padding: '40px 16px', width: '100%' }}>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, margin: '0 0 8px' }}>Koszty</h1>
      <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 28px', maxWidth: 580 }}>
        Każde wywołanie AI logowane przez <span className="mono" style={{ color: 'var(--fg-secondary)' }}>trackAICall</span>.
        Limity: <span className="mono">$5</span> ostrzeżenie / <span className="mono">$8</span> twardy / <span className="mono">$0.5</span> per call.
      </p>

      {/* Top cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { lbl: 'Dziś',         val: '$0',     sub: '0 wywołań' },
          { lbl: 'Ten miesiąc',  val: '$0.210', sub: '44 wywołań', accent: true },
          { lbl: 'Projekcja',    val: '$0.814', sub: 'na koniec miesiąca' },
        ].map((c, i) => (
          <div key={i} className="card" style={c.accent ? {
            background: 'color-mix(in srgb, var(--accent-soft) 30%, var(--bg-surface))',
            borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
          } : {}}>
            <div className="uppercase-label" style={{ marginBottom: 12, color: c.accent ? 'var(--accent)' : 'var(--fg-muted)' }}>
              {c.lbl}
            </div>
            <div className="mono" style={{
              fontSize: 32, lineHeight: 1, color: c.accent ? 'var(--accent)' : 'var(--fg-primary)',
            }}>{c.val}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 10 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Per operation + per model */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 600 }}>Per operacja</h3>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 18px' }}>
            Suma kosztów według typu wywołania.
          </p>
          {[
            { name: 'generate_open',           count: '5×',  cost: '$0.057', pct: 100 },
            { name: 'generate_cloze',          count: '5×',  cost: '$0.047', pct: 82 },
            { name: 'generate_audit_questions',count: '2×',  cost: '$0.041', pct: 72 },
            { name: 'compress_material',       count: '5×',  cost: '$0.038', pct: 67 },
            { name: 'validate_open_answer',    count: '5×',  cost: '$0.019', pct: 33 },
            { name: 'auto_tag_material',       count: '5×',  cost: '$0.0073',pct: 13 },
            { name: 'embed_material',          count: '17×', cost: '$0.0010',pct: 2 },
          ].map(op => (
            <div key={op.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, marginBottom: 4 }}>
                <span className="mono" style={{ color: 'var(--fg-secondary)' }}>{op.name}</span>
                <span style={{ color: 'var(--fg-muted)' }}>
                  <span className="mono">{op.count}</span> · <span className="mono" style={{ color: 'var(--fg-primary)' }}>{op.cost}</span>
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{ width: op.pct + '%', height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 600 }}>Per model</h3>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 18px' }}>
            Haiku robi większość pracy, Sonnet tylko walidację.
          </p>
          {[
            { name: 'claude-haiku-4-5',  count: '20×', cost: '$0.149', pct: 100, color: 'var(--accent)' },
            { name: 'claude-sonnet-4-6', count: '7×',  cost: '$0.060', pct: 40,  color: 'var(--accent-2)' },
            { name: 'voyage-3',          count: '17×', cost: '$0.0010',pct: 2,   color: 'var(--success)' },
          ].map(m => (
            <div key={m.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, marginBottom: 4 }}>
                <span className="mono" style={{ color: 'var(--fg-secondary)' }}>{m.name}</span>
                <span style={{ color: 'var(--fg-muted)' }}>
                  <span className="mono">{m.count}</span> · <span className="mono" style={{ color: 'var(--fg-primary)' }}>{m.cost}</span>
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{ width: m.pct + '%', height: '100%', background: m.color }} />
              </div>
            </div>
          ))}

          <hr className="line" style={{ margin: '20px 0 16px', border: 0, height: 1, background: 'var(--border-default)' }} />
          <div className="uppercase-label" style={{ marginBottom: 10 }}>Limity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Ostrzeżenie</span>
              <span className="mono" style={{ color: 'var(--warning)' }}>$5.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Twardy limit</span>
              <span className="mono" style={{ color: 'var(--danger)' }}>$8.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Per call</span>
              <span className="mono" style={{ color: 'var(--fg-secondary)' }}>$0.50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent calls table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 600 }}>Ostatnie wywołania</h3>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
            10 najnowszych wpisów z <span className="mono" style={{ color: 'var(--fg-secondary)' }}>usage_logs</span>.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1.5fr 1fr 90px 70px 70px 80px', padding: '10px 20px',
          borderBottom: '1px solid var(--border-default)', fontSize: 11, color: 'var(--fg-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Geist Mono, monospace' }}>
          <span>Czas</span>
          <span>Operacja</span>
          <span>Model</span>
          <span style={{ textAlign: 'right' }}>Tokeny in</span>
          <span style={{ textAlign: 'right' }}>cache</span>
          <span style={{ textAlign: 'right' }}>out</span>
          <span style={{ textAlign: 'right' }}>$</span>
        </div>
        {[
          { t: '03.05, 21:38', op: 'generate_open',          m: 'haiku-4-5',  tin: 1496, c: '—',  out: 2080, $: '$0.012' },
          { t: '03.05, 21:37', op: 'generate_cloze',         m: 'haiku-4-5',  tin: 1555, c: '—',  out: 1650, $: '$0.0098' },
          { t: '03.05, 21:37', op: 'auto_tag_material',      m: 'haiku-4-5',  tin: 1342, c: '—',  out: 39,   $: '$0.0015' },
          { t: '03.05, 21:37', op: 'compress_material',      m: 'haiku-4-5',  tin: 2404, c: 1111, out: 0,    $: '$0.0080' },
          { t: '03.05, 21:35', op: 'embed_material',         m: 'voyage-3',   tin: 1946, c: '—',  out: 0,    $: '$0.0001' },
          { t: '03.05, 21:31', op: 'generate_open',          m: 'haiku-4-5',  tin: 1561, c: '—',  out: 1967, $: '$0.011' },
          { t: '03.05, 21:31', op: 'generate_cloze',         m: 'haiku-4-5',  tin: 1620, c: '—',  out: 1610, $: '$0.0097' },
          { t: '03.05, 21:31', op: 'auto_tag_material',      m: 'haiku-4-5',  tin: 1407, c: '—',  out: 43,   $: '$0.0016' },
          { t: '03.05, 21:31', op: 'compress_material',      m: 'haiku-4-5',  tin: 2404, c: 1176, out: 0,    $: '$0.0083' },
          { t: '03.05, 21:31', op: 'embed_material',         m: 'voyage-3',   tin: 1946, c: '—',  out: 0,    $: '$0.0001' },
        ].map((r, i, arr) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '110px 1.5fr 1fr 90px 70px 70px 80px',
            padding: '10px 20px', fontSize: 12, alignItems: 'center',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
            fontFamily: 'Geist Mono, monospace',
          }}>
            <span style={{ color: 'var(--fg-muted)' }}>{r.t}</span>
            <span style={{ color: 'var(--fg-primary)' }}>{r.op}</span>
            <span style={{ color: 'var(--fg-secondary)' }}>{r.m}</span>
            <span style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}>{r.tin}</span>
            <span style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{r.c}</span>
            <span style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}>{r.out}</span>
            <span style={{ textAlign: 'right', color: 'var(--accent)' }}>{r.$}</span>
          </div>
        ))}
      </div>
    </main>
  </div>
);

window.DeepDiveActiveScreen = DeepDiveActiveScreen;
window.AudytyScreen = AudytyScreen;
window.StatystykiScreen = StatystykiScreen;
window.UstawieniaScreen = UstawieniaScreen;
window.KosztyScreen = KosztyScreen;
