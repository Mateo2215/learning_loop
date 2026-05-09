// Learning Loop v3 — Szczegół materiału (rich) w języku v2
// Header z okładką + chips + mastery FSRS · Wyróżniony cytat ·
// Taby: Fiszki / Pytania / Źródło / Notatki · Siatka fiszek · Lista pytań

const TopNavV3 = ({ active }) => {
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
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            }}>
              {it.label}
              {it.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><path d="m6 9 6 6 6-6"/></svg>}
              {active === it.id && (
                <span style={{ position: 'absolute', insetInline: 12, bottom: -1, height: 2, borderRadius: 1, background: 'var(--accent)' }} />
              )}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
};

const FlashThumbV3 = ({ card }) => (
  <div style={{
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 12, padding: 18,
    cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
  }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 12,
    }}>
      <span className="chip" style={{
        background: card.tagBg, color: card.tagFg, borderColor: 'transparent',
      }}>{card.tag}</span>
      <span className="mono" style={{ fontSize: 10, color: 'var(--fg-muted)' }}>
        #{card.num}
      </span>
    </div>
    <div className="serif" style={{
      fontSize: 16, fontWeight: 500, lineHeight: 1.35,
      letterSpacing: '-0.005em', color: 'var(--fg-primary)',
      marginBottom: 14,
    }}>
      {card.front}
    </div>
    <div style={{
      fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5,
      paddingTop: 12, borderTop: '1px dashed var(--border-default)',
    }}>
      {card.back}
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 14, fontSize: 11,
    }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: 999,
            background: i <= card.strength ? 'var(--accent)' : 'var(--border-default)',
          }} />
        ))}
        <span className="mono" style={{ marginLeft: 6, color: 'var(--fg-muted)' }}>
          {['nowa','learning','young','mature','mastered'][card.strength - 1] || 'nowa'}
        </span>
      </div>
      <span className="mono" style={{ color: 'var(--fg-muted)' }}>
        {card.due}
      </span>
    </div>
  </div>
);

const QuestionItemV3 = ({ q }) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
        Q{q.num.toString().padStart(2, '0')}
      </span>
      <span className="chip" style={{ color: q.kindColor }}>{q.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>
        {q.from}
      </span>
    </div>
    <div className="serif" style={{
      fontSize: 18, fontWeight: 500, lineHeight: 1.4,
      letterSpacing: '-0.005em', color: 'var(--fg-primary)',
      marginBottom: 14,
    }}>
      {q.text}
    </div>
    {q.answered ? (
      <div style={{
        background: 'var(--bg-canvas)',
        padding: '12px 14px', borderRadius: 10,
        borderLeft: '3px solid var(--success)',
        fontSize: 13, color: 'var(--fg-secondary)', lineHeight: 1.55,
      }}>
        <div className="uppercase-label" style={{ color: 'var(--success)', marginBottom: 6 }}>
          Twoja odpowiedź · {q.score}
        </div>
        {q.answered}
      </div>
    ) : (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: 'var(--bg-canvas)',
        border: '1px solid var(--border-default)',
        borderRadius: 10, fontSize: 12, color: 'var(--fg-muted)',
      }}>
        <span>Czeka na Twoją odpowiedź · ~2–3 min · ok. $0.012</span>
        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
          Odpowiedz teraz →
        </button>
      </div>
    )}
  </div>
);

const MaterialDetailV2 = () => {
  const [tab, setTab] = React.useState('cards');

  const cards = [
    { num: '04', tag: 'definicja',  tagBg: 'var(--accent-soft)',     tagFg: 'var(--accent)',
      front: 'Czym jest stopa dyskontowa?',
      back: 'Wymagana stopa zwrotu używana do sprowadzenia przyszłych przepływów pieniężnych do wartości teraźniejszej.',
      strength: 4, due: 'za 6 dni' },
    { num: '12', tag: 'mechanizm',  tagBg: 'var(--accent-2-soft)',   tagFg: 'var(--accent-2)',
      front: 'Dlaczego stopa dyskontowa rośnie ze wzrostem ryzyka?',
      back: 'Inwestor wymaga premii za ryzyko: większa niepewność przepływów = wyższe oczekiwania zwrotu = wyższa stopa.',
      strength: 2, due: 'dzisiaj' },
    { num: '18', tag: 'edge case',  tagBg: 'color-mix(in srgb, var(--warning) 22%, transparent)', tagFg: 'var(--warning)',
      front: 'Kiedy DCF zawodzi przy wycenie start-upów?',
      back: 'Gdy przepływy są ujemne lub bardzo niepewne — terminal value dominuje wycenę i model staje się empirycznie pusty.',
      strength: 1, due: 'dzisiaj' },
    { num: '23', tag: 'aplikacja', tagBg: 'color-mix(in srgb, var(--success) 22%, transparent)', tagFg: 'var(--success)',
      front: 'Jak dobrać WACC dla projektu o profilu odmiennym od reszty firmy?',
      back: 'Użyj pure-play approach: WACC liczymy z bety odlewarowanej spółek czysto reprezentujących projekt + struktury kapitału tego projektu.',
      strength: 5, due: 'za 21 dni' },
    { num: '29', tag: 'definicja', tagBg: 'var(--accent-soft)', tagFg: 'var(--accent)',
      front: 'Wartość terminalna — wzór Gordona.',
      back: 'TV = CF_n+1 / (r − g), gdzie r = stopa dyskontowa, g = stała stopa wzrostu po horyzoncie projekcji.',
      strength: 3, due: 'za 2 dni' },
    { num: '34', tag: 'porównanie', tagBg: 'var(--accent-2-soft)', tagFg: 'var(--accent-2)',
      front: 'DCF vs mnożnikowa — kiedy która?',
      back: 'DCF: stabilne przepływy, długi horyzont, zrozumiały model. Mnożniki: szybka wycena, kiedy są dobre comparable.',
      strength: 4, due: 'za 9 dni' },
  ];

  const questions = [
    { num: 1, label: 'synteza', kindColor: 'var(--accent-2)', from: 'pp. 12–14',
      text: 'Wyjaśnij, dlaczego stopa dyskontowa rośnie wraz ze wzrostem ryzyka projektu — i co to oznacza w praktyce dla wyceny start-upów.',
      answered: null },
    { num: 2, label: 'krytyka', kindColor: 'var(--warning)', from: 'pp. 22–23',
      text: 'W jakich sytuacjach metoda DCF zawodzi i jakie alternatywy mają wtedy sens? Podaj przynajmniej dwa przypadki.',
      answered: null },
    { num: 3, label: 'aplikacja', kindColor: 'var(--success)', from: 'pp. 6–9',
      text: 'Zaprojektuj 14-dniowy harmonogram nauki wyceny dla osoby z 30 minutami dziennie. Uzasadnij każdy wybór odwołując się do wniosków z materiału.',
      answered: 'Pierwsze 3 dni — koncepcje (PV, FV, WACC) na fiszkach + 1 pytanie syntetyczne dziennie. Dni 4-7 — zastosowanie WACC w prostych modelach 2-stopniowych. Dni 8-10 wartość terminalna i wrażliwości; zaczynam re-test fiszek z dni 1-3 (rosnące interwały). Dni 11-14 — pełny case na DCF 4 + audyt wcześniejszych odpowiedzi. Uzasadnienie: kompozycja "desirable difficulty" + spaced retrieval z materiału.',
      score: '4 / 5' },
  ];

  return (
    <div className="ll2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNavV3 active="materials" />

      <main style={{ maxWidth: 1024, margin: '0 auto', padding: '32px 16px 60px', width: '100%' }}>
        {/* Breadcrumb + actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--fg-muted)' }}>
            <a style={{ color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
              Materiały
            </a>
            <span>/</span>
            <a style={{ color: 'var(--fg-muted)' }}>Finanse</a>
            <span>/</span>
            <span style={{ color: 'var(--fg-secondary)', fontWeight: 500 }}>DCF 4</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 6 3 0M21 6h-3M3 12h6M21 12h-9M3 18h12M21 18h-3M14 4l4 4-4 4M10 20l-4-4 4-4"/></svg>
              Tasuj
            </button>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 10px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              Wygeneruj więcej
            </button>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>
              Zacznij powtórki →
            </button>
          </div>
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
          {/* PDF cover */}
          <div style={{
            width: 84, height: 110, borderRadius: 10, flex: '0 0 84px',
            background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 55%, var(--bg-surface)) 0%, var(--accent) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 22px -8px color-mix(in srgb, var(--accent) 60%, transparent)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="1.4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="chip">PDF</span>
              <span className="chip">28 stron</span>
              <span className="chip">3 maja 2026</span>
              <span className="chip chip-accent">14 due dziś</span>
            </div>
            <h1 className="serif" style={{ fontSize: 36, lineHeight: 1.1, margin: '0 0 8px' }}>
              DCF 4
            </h1>
            <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: '0 0 18px', maxWidth: 620, lineHeight: 1.55 }}>
              Czwarta część cyklu o discounted cash flow — WACC dla projektów heterogenicznych,
              wartość terminalna i wrażliwości. Auto-wygenerowane <strong style={{ color: 'var(--fg-primary)' }}>32 fiszki</strong> i <strong style={{ color: 'var(--fg-primary)' }}>7 pytań otwartych</strong>.
            </p>

            {/* Mastery bar */}
            <div style={{ maxWidth: 520 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6,
              }}>
                <span>Postęp utrwalania</span>
                <span><strong style={{ color: 'var(--fg-primary)' }}>22 / 32</strong> fiszek · 69%</span>
              </div>
              <div style={{
                height: 6, background: 'var(--bg-elevated)', borderRadius: 3,
                overflow: 'hidden', display: 'flex',
              }}>
                <div style={{ width: '56%', background: 'var(--success)' }} />
                <div style={{ width: '13%', background: 'var(--accent)' }} />
                <div style={{ width: '13%', background: 'var(--warning)' }} />
              </div>
              <div style={{
                display: 'flex', gap: 14, fontSize: 11,
                color: 'var(--fg-muted)', marginTop: 8,
              }}>
                <span><span style={{ color: 'var(--success)' }}>●</span> mature 18</span>
                <span><span style={{ color: 'var(--accent)' }}>●</span> young 4</span>
                <span><span style={{ color: 'var(--warning)' }}>●</span> learning 4</span>
                <span><span style={{ color: 'var(--fg-muted)' }}>●</span> nowe 6</span>
              </div>
            </div>
          </div>
        </div>

        {/* Highlighted source quote */}
        <div style={{
          padding: '20px 24px', borderRadius: 12, marginBottom: 8,
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-soft) 50%, var(--bg-surface)) 0%, var(--bg-surface) 100%)',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border-default))',
          maxWidth: 720,
        }}>
          <div className="uppercase-label" style={{ color: 'var(--accent)', marginBottom: 8 }}>
            Wyróżniony fragment · str. 12
          </div>
          <blockquote className="serif" style={{
            fontSize: 18, fontWeight: 400, fontStyle: 'italic',
            color: 'var(--fg-primary)', margin: '0 0 10px',
            lineHeight: 1.45, letterSpacing: '-0.005em',
          }}>
            "Premia za ryzyko nie jest jednolita — dla projektu start-upowego beta odlewarowana
            może odpowiadać innemu sektorowi niż core business firmy. Stąd potrzeba pure-play approach."
          </blockquote>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            Źródło dla fiszek <span className="mono">#23</span>, <span className="mono">#12</span> i pytania <span className="mono">Q01</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 28, marginBottom: 0,
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'cards',     label: 'Fiszki',           count: 32 },
              { id: 'questions', label: 'Pytania otwarte',  count: 7 },
              { id: 'source',    label: 'Źródło',           count: null },
              { id: 'notes',     label: 'Moje notatki',     count: 4 },
            ].map(t => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 14px', marginBottom: -1,
                  background: 'transparent', border: 'none',
                  borderBottom: '2px solid ' + (isActive ? 'var(--accent)' : 'transparent'),
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  color: isActive ? 'var(--fg-primary)' : 'var(--fg-muted)',
                  cursor: 'pointer', transition: 'color 0.12s',
                }}>
                  {t.label}
                  {t.count !== null && (
                    <span className="mono" style={{
                      fontSize: 10,
                      color: isActive ? 'var(--fg-secondary)' : 'var(--fg-muted)',
                      background: isActive ? 'var(--bg-elevated)' : 'transparent',
                      padding: '1px 6px', borderRadius: 999,
                    }}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {tab === 'cards' && (
              <>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
                  Wszystkie · 32
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--accent)' }}>
                  Due · 14
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
                  Nowe · 6
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ paddingTop: 20 }}>
          {tab === 'cards' && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
            }}>
              {cards.map(c => <FlashThumbV3 key={c.num} card={c} />)}
            </div>
          )}

          {tab === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
              {questions.map(q => <QuestionItemV3 key={q.num} q={q} />)}
            </div>
          )}

          {tab === 'source' && (
            <div className="card" style={{
              padding: 60, textAlign: 'center', color: 'var(--fg-muted)',
            }}>
              <div className="uppercase-label" style={{ marginBottom: 8 }}>Wkrótce</div>
              <div style={{ fontSize: 14 }}>Wbudowana przeglądarka PDF z anotacjami inline</div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="card" style={{
              padding: 60, textAlign: 'center', color: 'var(--fg-muted)',
            }}>
              <div className="uppercase-label" style={{ marginBottom: 8 }}>Wkrótce</div>
              <div style={{ fontSize: 14 }}>Edytor swobodnych notatek</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

window.MaterialDetailV2 = MaterialDetailV2;
