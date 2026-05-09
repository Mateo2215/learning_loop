// Learning Loop v3 — Sesja powtórek (rich study session w języku v2)
// Stos kart · panel kontekstu · historia · następne · grading row · keyboard hints

const StudyV2 = () => {
  const [revealed, setRevealed] = React.useState(false);

  const total = 20;
  const current = 4; // currently on card 4 (index 3)
  const correctCount = 3;

  const card = {
    num: 18,
    tag: 'cloze',
    difficulty: '2/5',
    front: (
      <>
        Wzór na Wartość Teraźniejszą to:{' '}
        {revealed ? (
          <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
            PV = FV / (1 + r)<sup>n</sup>
          </span>
        ) : (
          <span className="mono" style={{
            color: 'var(--fg-muted)', letterSpacing: '0.05em',
            background: 'var(--bg-elevated)', padding: '0 14px',
            borderRadius: 4, border: '1px dashed var(--border-default)',
          }}>______</span>
        )}.
      </>
    ),
    backNote: 'Wartość teraźniejsza dyskontuje przyszłe przepływy stopą oczekiwanej rentowności, pozwalając porównać przepływy z różnych okresów na wspólnej skali.',
    source: 'pp. 12–14',
  };

  return (
    <div className="ll2" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-canvas)', overflow: 'hidden',
    }}>
      {/* Top session bar */}
      <header style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
            Wyjdź
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>Wartość pieniądza w czasie</div>
          <span className="chip">karta {current} / {total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            03:42
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
            <span><span style={{ color: 'var(--fg-secondary)' }}>{correctCount}</span> trafione · 0 pomyłek</span>
          </div>
        </div>
      </header>

      {/* Progress strip */}
      <div style={{ display: 'flex', gap: 3, padding: '8px 24px 0' }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < correctCount ? 'var(--success)'
              : i === current - 1 ? 'var(--accent)'
              : 'var(--border-default)',
          }} />
        ))}
      </div>

      {/* Body — card stage + side panel */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 296px',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Card stage */}
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 40,
        }}>
          {/* Stack — two cards behind */}
          <div style={{
            position: 'absolute', width: 620, height: 360, borderRadius: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            transform: 'translate(8px, 8px) rotate(1.2deg)', opacity: 0.45,
          }} />
          <div style={{
            position: 'absolute', width: 620, height: 360, borderRadius: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            transform: 'translate(4px, 4px) rotate(-0.6deg)', opacity: 0.7,
          }} />

          {/* Front card */}
          <div style={{
            position: 'relative', width: 620, minHeight: 360,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 16,
            padding: '32px 40px',
            display: 'flex', flexDirection: 'column', gap: 18,
            boxShadow: '0 12px 40px -12px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="chip">{card.tag}</span>
                <span className="chip">trudność {card.difficulty}</span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                #{card.num} · {card.source}
              </span>
            </div>

            <div className="serif" style={{
              fontSize: 32, lineHeight: 1.25,
              letterSpacing: '-0.015em', textAlign: 'center',
              maxWidth: 540, margin: '12px auto',
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 500,
            }}>
              {card.front}
            </div>

            {revealed ? (
              <div style={{
                paddingTop: 16, borderTop: '1px solid var(--border-default)',
                fontSize: 13, color: 'var(--fg-secondary)', lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                {card.backNote}
              </div>
            ) : (
              <div style={{
                fontSize: 12, color: 'var(--fg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
                Naciśnij <KbdV2>Spacja</KbdV2> lub kliknij, aby pokazać odpowiedź
              </div>
            )}
          </div>
        </div>

        {/* Side panel — context */}
        <aside style={{
          borderLeft: '1px solid var(--border-default)',
          padding: '28px 22px',
          overflow: 'auto',
          background: 'var(--bg-canvas)',
        }}>
          <div className="uppercase-label" style={{ marginBottom: 10 }}>Z źródła</div>
          <div className="serif" style={{
            fontSize: 14, fontStyle: 'italic', lineHeight: 1.5,
            color: 'var(--fg-secondary)', marginBottom: 16,
            paddingLeft: 12, borderLeft: '2px solid var(--accent)',
          }}>
            "Wartość teraźniejsza dyskontuje przyszłe przepływy stopą oczekiwanej rentowności,
            pozwalając porównać przepływy z różnych okresów na wspólnej skali."
          </div>

          <hr className="line" style={{ margin: '20px 0', border: 0, height: 1, background: 'var(--border-default)' }} />

          <div className="uppercase-label" style={{ marginBottom: 10 }}>Historia karty</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { date: '4 dni temu',  result: 'Trudne',  color: 'var(--warning)' },
              { date: '11 dni temu', result: 'Dobrze',  color: 'var(--success)' },
              { date: '18 dni temu', result: 'Znów',    color: 'var(--danger)' },
              { date: '23 dni temu', result: 'Nowa',    color: 'var(--fg-muted)' },
            ].map(h => (
              <div key={h.date} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, color: 'var(--fg-secondary)',
              }}>
                <span style={{ color: 'var(--fg-muted)' }}>{h.date}</span>
                <span style={{ color: h.color, fontWeight: 500 }}>{h.result}</span>
              </div>
            ))}
          </div>

          <hr className="line" style={{ margin: '20px 0', border: 0, height: 1, background: 'var(--border-default)' }} />

          <div className="uppercase-label" style={{ marginBottom: 10 }}>Następne</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id: '#23', text: 'Jak harmonogramować pierwsze 3 powtórki?', kind: 'card' },
              { id: 'Q',   text: 'Pytanie otwarte · synteza',                kind: 'q' },
              { id: '#29', text: 'Co to jest "desirable difficulty"?',       kind: 'card' },
            ].map((u, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 7,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}>
                <span className="mono" style={{
                  fontSize: 11,
                  color: u.kind === 'q' ? 'var(--accent-2)' : 'var(--fg-muted)',
                }}>{u.id}</span>
                <span style={{
                  fontSize: 12, flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: u.kind === 'q' ? 'var(--accent-2)' : 'var(--fg-secondary)',
                }}>
                  {u.text}
                </span>
              </div>
            ))}
          </div>

          <hr className="line" style={{ margin: '20px 0', border: 0, height: 1, background: 'var(--border-default)' }} />

          <div className="uppercase-label" style={{ marginBottom: 10 }}>Statystyki sesji</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { val: '87%',  lbl: 'retencja' },
              { val: '14s',  lbl: 'śr. czas/karta' },
              { val: '+2',   lbl: 'młodych → mature' },
              { val: '~$0.003', lbl: 'koszt sesji', mono: true },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}>
                <div className={s.mono ? 'mono' : 'serif'} style={{
                  fontSize: s.mono ? 13 : 18, lineHeight: 1,
                  color: 'var(--fg-primary)',
                }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Footer — grading or hints */}
      <footer style={{
        padding: '16px 24px 22px',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-canvas)',
      }}>
        {revealed ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            maxWidth: 760, margin: '0 auto',
          }}>
            {[
              { k: '1', label: 'Znów',     next: '<1 min',   color: 'var(--danger)' },
              { k: '2', label: 'Trudne',   next: '6 min',    color: 'var(--warning)' },
              { k: '3', label: 'Dobrze',   next: '10 dni',   color: 'var(--success)' },
              { k: '4', label: 'Łatwe',    next: '4 tyg.',   color: 'var(--accent-2)' },
            ].map(g => (
              <button key={g.k} style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '14px 16px', borderRadius: 12,
                border: '1px solid color-mix(in srgb, ' + g.color + ' 40%, transparent)',
                background: 'color-mix(in srgb, ' + g.color + ' 14%, transparent)',
                color: g.color, fontFamily: 'inherit', cursor: 'pointer',
                transition: 'transform 0.06s, filter 0.12s',
              }}>
                <span className="mono" style={{
                  position: 'absolute', top: 6, left: 8,
                  fontSize: 10, opacity: 0.6,
                }}>{g.k}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{g.label}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{g.next}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            maxWidth: 720, margin: '0 auto',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <button onClick={() => setRevealed(true)} className="btn btn-primary" style={{
              width: '100%', height: 48, fontSize: 14, justifyContent: 'center',
            }}>
              Pokaż odpowiedź
            </button>
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 18, fontSize: 11, color: 'var(--fg-muted)',
            }}>
              <span><KbdV2>Spacja</KbdV2> pokaż</span>
              <span><KbdV2>S</KbdV2> pomiń</span>
              <span><KbdV2>E</KbdV2> edytuj</span>
              <span><KbdV2>Esc</KbdV2> zakończ</span>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};

const KbdV2 = ({ children }) => (
  <span className="mono" style={{
    fontSize: 10, padding: '2px 6px', borderRadius: 4,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    color: 'var(--fg-secondary)',
    margin: '0 2px',
  }}>{children}</span>
);

window.StudyV2 = StudyV2;
