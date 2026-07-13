'use client';

import { useState, useRef, useCallback } from 'react';
import { CATEGORIES, KEYWORDS } from '../lib/mockArticles';

const IMG_MODES = [
  { id: 'ai', label: '🖌 AI 일러스트', hint: '카드마다 "AI 일러스트 생성" 버튼을 누르면 실제 이미지 생성 API를 호출해요. OPENAI_API_KEY가 설정돼 있지 않으면 대신 미리보기용 목업이 표시돼요.' },
  { id: 'stock', label: '📷 무료 스톡 사진', hint: '카드마다 "관련 이미지 불러오기" 버튼을 누르면 Unsplash에서 키워드에 맞는 사진을 찾아와요. UNSPLASH_ACCESS_KEY가 없으면 키워드와 무관한 예시 이미지로 대체돼요.' },
  { id: 'none', label: '⬆ 직접 업로드', hint: '저작권 걱정 없이 내가 가진 사진을 카드마다 직접 올릴 수 있어요.' },
];

function catInfo(id) {
  return CATEGORIES.find((c) => c.id === id);
}

function MockIllustration({ catId, color, seed }) {
  const shapes = {
    beauty: (
      <>
        <circle cx="60" cy="50" r="26" fill="#fff" />
        <path d="M42 95 Q60 62 78 95" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="60" cy="50" r="10" fill={color} />
      </>
    ),
    fashion: (
      <>
        <path d="M60 24 L44 40 L52 44 L60 36 L68 44 L76 40 Z" fill="#fff" />
        <path d="M36 46 L60 36 L84 46 L78 96 L42 96 Z" fill="#fff" />
        <path d="M52 46 Q60 58 68 46" stroke={color} strokeWidth="4" fill="none" />
      </>
    ),
    it: (
      <>
        <rect x="34" y="34" width="52" height="52" rx="8" fill="#fff" />
        <rect x="48" y="48" width="24" height="24" rx="4" fill={color} />
        <line x1="60" y1="20" x2="60" y2="34" stroke="#fff" strokeWidth="4" />
        <line x1="60" y1="86" x2="60" y2="100" stroke="#fff" strokeWidth="4" />
        <line x1="20" y1="60" x2="34" y2="60" stroke="#fff" strokeWidth="4" />
        <line x1="86" y1="60" x2="100" y2="60" stroke="#fff" strokeWidth="4" />
      </>
    ),
    humanities: (
      <>
        <path d="M60 32 C50 24 32 24 26 30 L26 88 C32 82 50 82 60 90 Z" fill="#fff" />
        <path d="M60 32 C70 24 88 24 94 30 L94 88 C88 82 70 82 60 90 Z" fill="#fff" />
        <line x1="60" y1="32" x2="60" y2="90" stroke={color} strokeWidth="3" />
      </>
    ),
    economy: (
      <>
        <rect x="28" y="66" width="14" height="26" fill="#fff" />
        <rect x="53" y="48" width="14" height="44" fill="#fff" />
        <rect x="78" y="30" width="14" height="62" fill="#fff" />
        <path d="M28 62 L53 44 L78 26" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    issue: (
      <>
        <path d="M26 34 h68 v40 h-30 l-14 14 v-14 h-24 z" fill="#fff" />
        <circle cx="46" cy="54" r="4" fill={color} />
        <circle cx="60" cy="54" r="4" fill={color} />
        <circle cx="74" cy="54" r="4" fill={color} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="120" fill={color} />
      {shapes[catId] || shapes.issue}
    </svg>
  );
}

function buildCards(article, magazine) {
  const c = catInfo(article.cat);
  const cards = [];
  cards.push({ type: 'cover', label: 'COVER', title: article.title, text: article.summary || magazine.tagline, custom: null, aiImage: null, aiState: 'idle' });

  // Merge points into at most 2 body cards so the whole set stays at 3-4 cards total,
  // and de-duplicate so a short snippet with only 1 real sentence doesn't repeat itself.
  const uniquePoints = [...new Set((article.points || []).map((p) => p.trim()).filter(Boolean))];
  const mid = Math.ceil(uniquePoints.length / 2);
  const groups = [uniquePoints.slice(0, mid), uniquePoints.slice(mid)].filter((g) => g.length > 0);
  groups.forEach((g, gi) => {
    const body = g.map((p) => `• ${p}`).join('\n');
    cards.push({ type: 'body', label: `POINT ${gi + 1}`, title: g[0], text: body, custom: null, aiImage: null, aiState: 'idle' });
  });

  cards.push({ type: 'outro', label: 'OUTRO', title: '저장하고 오래 보기', text: `${article.tag}  ${magazine.hashtags}`, custom: null, aiImage: null, aiState: 'idle' });
  return cards.map((c2) => ({ ...c2, catColor: c.color, catLabel: c.label }));
}

export default function Home() {
  const [view, setView] = useState('home');
  const [category, setCategory] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [sourceKind, setSourceKind] = useState('news'); // news | youtube | google
  const [sort, setSort] = useState('popular'); // popular | recent
  const [searchMode, setSearchMode] = useState(null); // 'live' | 'demo'
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [article, setArticle] = useState(null);
  const [cards, setCards] = useState([]);
  const [imageMode, setImageMode] = useState('ai');

  const [magazine, setMagazine] = useState({ name: 'MY MAGAZINE', tagline: '오늘의 이야기를 오려 담다', color: '#8C2F39', hashtags: '#매거진, #카드뉴스, #클리핑' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftMag, setDraftMag] = useState(magazine);

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  }, []);

  async function doSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (keyword) params.set('keyword', keyword);
      params.set('source', sourceKind);
      params.set('sort', sort);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.articles || []);
      setSearchMode(data.mode || 'demo');
      setSearchError(data.error || '');
      setView('results');
    } catch (e) {
      showToast('검색 중 오류가 발생했어요');
    } finally {
      setLoading(false);
    }
  }

  function openEditor(a) {
    setArticle(a);
    setCards(buildCards(a, magazine));
    setView('editor');
  }

  function regen() {
    setCards(buildCards(article, magazine));
    showToast('카드뉴스를 다시 만들었어요');
  }

  async function generateIllustration(idx) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, aiState: 'loading' } : c)));
    try {
      const prompt = `${catInfo(article.cat).label} magazine card: ${cards[idx].title}`;
      const res = await fetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setCards((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, aiImage: data.image, aiState: data.image ? 'live' : 'demo' } : c))
      );
      if (!data.image) showToast('OPENAI_API_KEY가 없어서 미리보기로 대체했어요');
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, aiState: 'demo' } : c)));
    }
  }

  async function fetchStockPhoto(idx) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, stockState: 'loading' } : c)));
    try {
      const q = `${catInfo(article.cat).label} ${cards[idx].title}`.slice(0, 60);
      const res = await fetch(`/api/stock?q=${encodeURIComponent(q)}&seed=${article.id}-${idx}`);
      const data = await res.json();
      setCards((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, stockImage: data.image, stockMode: data.mode, stockState: 'done' } : c))
      );
      if (data.mode === 'demo') showToast('UNSPLASH_ACCESS_KEY가 없어서 키워드와 무관한 예시 이미지로 대체했어요');
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, stockState: 'error' } : c)));
      showToast('이미지를 불러오지 못했어요');
    }
  }

  function uploadImage(idx, file) {
    const reader = new FileReader();
    reader.onload = () => {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, custom: reader.result } : c)));
      showToast('이미지가 적용됐어요');
    };
    reader.readAsDataURL(file);
  }

  async function downloadCard(idx) {
    const html2canvas = (await import('html2canvas')).default;
    const node = document.getElementById('card-' + idx);
    const canvas = await html2canvas(node, { scale: 3, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
    const link = document.createElement('a');
    link.download = `card-${idx + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function downloadZip() {
    showToast('ZIP 생성 중...');
    const html2canvas = (await import('html2canvas')).default;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (let idx = 0; idx < cards.length; idx++) {
      const node = document.getElementById('card-' + idx);
      const canvas = await html2canvas(node, { scale: 3, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
      const data = canvas.toDataURL('image/png').split(',')[1];
      zip.file(`card-${idx + 1}.png`, data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${magazine.name.replace(/\s+/g, '_')}_cards.zip`;
    link.click();
    showToast('다운로드 완료!');
  }

  function saveSettings() {
    setMagazine(draftMag);
    setSettingsOpen(false);
    showToast('매거진 설정이 저장됐어요');
    if (article) setCards(buildCards(article, draftMag));
  }

  const keywordList = category ? KEYWORDS[category] : Object.values(KEYWORDS).flat().slice(0, 6);

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="logo">
            <span className="scissor">✂︎</span>CLIPPING<span className="logo-sub">&nbsp;— 나만의 매거진</span>
          </div>
          <nav className="masthead-nav">
            <button className="nav-btn ghost" onClick={() => { setDraftMag(magazine); setSettingsOpen(true); }}>매거진 설정</button>
            <button className="nav-btn active" onClick={() => setView('home')}>홈</button>
          </nav>
        </div>
      </header>

      {searchMode === 'demo' && view !== 'home' && (
        <div className="mode-banner demo">
          {sourceKind === 'news' ? '뉴스' : sourceKind === 'youtube' ? '유튜브' : '구글'} 검색은 샘플 데이터로 동작 중이에요 · {sourceKind === 'news' ? 'NAVER_CLIENT_ID' : sourceKind === 'youtube' ? 'YOUTUBE_API_KEY' : 'GOOGLE_CSE_KEY'} 를 설정하면 실시간 검색으로 바뀝니다
          {searchError ? ` (API 오류: ${searchError})` : ''}
        </div>
      )}
      {searchMode === 'live' && view !== 'home' && (
        <div className="mode-banner live">실시간 {sourceKind === 'news' ? '네이버 뉴스' : sourceKind === 'youtube' ? '유튜브' : '구글'} 검색 결과예요 ({sort === 'popular' ? '인기순' : '최신순'})</div>
      )}

      <main>
        {view === 'home' && (
          <>
            <div className="hero">
              <div className="hero-eyebrow">FOR BEAUTY · FASHION · IT · HUMANITIES · ECONOMY · CURRENT AFFAIRS</div>
              <h1 className="serif">기사를 오려서,<br />나만의 매거진을 만들어보세요</h1>
              <p>관심 있는 분야를 고르면 관련 기사를 모아드려요. 기사를 하나 고르면 AI가 카드뉴스 5컷을 뚝딱 만들어드립니다. 사진은 저작권 걱정 없이 AI 일러스트나 무료 스톡 이미지로 채우거나, 직접 올릴 수도 있어요.</p>

              <div className="cat-row">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className={'cat-pill' + (category === c.id ? ' selected' : '')}
                    onClick={() => setCategory(category === c.id ? null : c.id)}
                  >
                    <span className="dot" style={{ background: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="cat-row" style={{ marginTop: -8 }}>
                {[{ id: 'news', label: '📰 뉴스' }, { id: 'youtube', label: '▶ 유튜브' }, { id: 'google', label: '🔍 구글' }].map((s) => (
                  <button key={s.id} className={'cat-pill' + (sourceKind === s.id ? ' selected' : '')} onClick={() => setSourceKind(s.id)}>
                    {s.label}
                  </button>
                ))}
                <span style={{ width: 1, background: 'var(--line)', margin: '4px 4px' }} />
                {[{ id: 'popular', label: '인기순' }, { id: 'recent', label: '최신순' }].map((s) => (
                  <button key={s.id} className={'cat-pill' + (sort === s.id ? ' selected' : '')} onClick={() => setSort(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="search-row">
                <input
                  className="search-input"
                  placeholder="키워드를 입력해보세요 (예: 여름 트렌드, 반도체, 생성형 AI...)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
                <button className="search-btn" onClick={doSearch} disabled={loading}>
                  {loading ? '검색 중...' : '기사 찾기'}
                </button>
              </div>
              <div className="chip-row">
                {keywordList.map((k) => (
                  <button key={k} className="chip" onClick={() => setKeyword(k)}>{k}</button>
                ))}
              </div>
            </div>

            <div className="how">
              <h2>HOW IT WORKS</h2>
              <div className="how-grid">
                <div className="how-step"><div className="n">01</div><h3>분야 고르기</h3><p>뷰티·패션부터 IT·인문학·경제·시사까지, 관심 분야를 선택해요.</p></div>
                <div className="how-step"><div className="n">02</div><h3>기사 찾기</h3><p>선택한 분야와 키워드로 관련 기사를 모아옵니다.</p></div>
                <div className="how-step"><div className="n">03</div><h3>기사 골라 생성</h3><p>마음에 드는 기사를 클릭하면 AI가 카드뉴스 5컷을 자동으로 만들어요.</p></div>
                <div className="how-step"><div className="n">04</div><h3>이미지 채우기</h3><p>AI 일러스트 · 무료 스톡 사진 · 직접 업로드 중 골라 저작권 걱정 없이 채워요.</p></div>
                <div className="how-step"><div className="n">05</div><h3>다운로드</h3><p>카드를 한 장씩, 또는 전체를 ZIP으로 받아 바로 업로드하세요.</p></div>
              </div>
            </div>
          </>
        )}

        {view === 'results' && (
          <>
            <div className="results-head">
              <div>
                <button className="back-link" onClick={() => setView('home')}>← 분야 다시 고르기</button>
                <h2 className="serif" style={{ marginTop: 6 }}>{category ? catInfo(category).label : '전체'} 관련 기사</h2>
              </div>
              <div className="results-count">{results.length}건</div>
            </div>
            {results.length === 0 ? (
              <div className="empty-state">조건에 맞는 기사를 찾지 못했어요. 키워드를 바꾸거나 분야를 다시 골라보세요.</div>
            ) : (
              <div className="clip-grid">
                {results.map((a) => {
                  const c = catInfo(a.cat) || catInfo('issue');
                  return (
                    <div className="clip-card" key={a.id}>
                      <div className="tape" style={{ background: c.color }} />
                      <div className="clip-source"><span>{a.source}</span><span>{a.date}</span></div>
                      <h3>{a.title}</h3>
                      <p className="clip-summary">{a.summary}</p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="clip-make" onClick={() => openEditor(a)}>카드뉴스 만들기 →</button>
                        {a.link && (
                          <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'underline' }}>
                            원문 보기 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === 'editor' && article && (
          <>
            <div className="editor-head">
              <div>
                <button className="back-link" onClick={() => setView('results')}>← 기사 목록으로</button>
                <h2 className="serif" style={{ marginTop: 6 }}>{article.title}</h2>
                <div className="src">{article.source} · {article.date}{article.link && (
                  <> · <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wine)', textDecoration: 'underline' }}>원문 보기 ↗</a></>
                )}</div>
              </div>
              <div className="editor-actions">
                <button className="btn" onClick={regen}>🔄 다시 생성</button>
                <button className="btn primary" onClick={downloadZip}>⬇ 전체 ZIP 다운로드</button>
              </div>
            </div>

            <div className="mode-row">
              {IMG_MODES.map((m) => (
                <button key={m.id} className={'mode-btn' + (imageMode === m.id ? ' active' : '')} onClick={() => setImageMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mode-hint">{IMG_MODES.find((m) => m.id === imageMode).hint}</p>

            <div className="filmstrip">
              {cards.map((card, idx) => (
                <div className="frame" key={idx}>
                  <div className="frame-label"><span>{card.label}</span><span>{idx + 1} / {cards.length}</span></div>
                  <div className="card" id={'card-' + idx}>
                    <div className="card-media">
                      {card.custom ? (
                        <>
                          <img src={card.custom} alt="" crossOrigin="anonymous" />
                          <span className="badge">직접 업로드</span>
                        </>
                      ) : imageMode === 'ai' ? (
                        card.aiImage ? (
                          <>
                            <img src={card.aiImage} alt="" crossOrigin="anonymous" />
                            <span className="badge">AI 생성 이미지</span>
                          </>
                        ) : (
                          <>
                            <MockIllustration catId={article.cat} color={card.catColor} seed={idx + 1} />
                            <span className="badge">{card.aiState === 'loading' ? '생성 중...' : '미리보기(목업)'}</span>
                          </>
                        )
                      ) : imageMode === 'stock' ? (
                        card.stockImage ? (
                          <>
                            <img src={card.stockImage} alt="" crossOrigin="anonymous" />
                            <span className="badge">{card.stockMode === 'live' ? '무료 스톡(관련 이미지)' : '무료 스톡(예시, 키워드 무관)'}</span>
                          </>
                        ) : (
                          <>
                            <MockIllustration catId={article.cat} color={card.catColor} seed={idx + 1} />
                            <span className="badge">{card.stockState === 'loading' ? '불러오는 중...' : '이미지 불러오기 필요'}</span>
                          </>
                        )
                      ) : (
                        <div className="ph">이미지 없음<br />아래 &apos;이미지 업로드&apos;로 사진을 추가하세요</div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-cat" style={{ color: card.catColor }}>{card.catLabel.toUpperCase()} · {magazine.name}</div>
                      <div className="card-title">{card.title}</div>
                      <div className="card-text">{card.text}</div>
                      <div className="card-foot"><span>{article.source}</span><span>{article.date}</span></div>
                    </div>
                  </div>
                  <div className="frame-tools">
                    {imageMode === 'ai' && !card.custom && (
                      <button className="tool-btn" disabled={card.aiState === 'loading'} onClick={() => generateIllustration(idx)}>
                        {card.aiState === 'loading' ? <><span className="spinner" />생성 중</> : 'AI 일러스트 생성'}
                      </button>
                    )}
                    {imageMode === 'stock' && !card.custom && (
                      <button className="tool-btn" disabled={card.stockState === 'loading'} onClick={() => fetchStockPhoto(idx)}>
                        {card.stockState === 'loading' ? <><span className="spinner" />불러오는 중</> : '관련 이미지 불러오기'}
                      </button>
                    )}
                    <button className="tool-btn" onClick={() => document.getElementById('file-' + idx).click()}>이미지 업로드</button>
                    <button className="tool-btn" onClick={() => downloadCard(idx)}>PNG 다운로드</button>
                  </div>
                  <input type="file" accept="image/*" id={'file-' + idx} onChange={(e) => e.target.files[0] && uploadImage(idx, e.target.files[0])} />
                </div>
              ))}
            </div>

            <div className="caption-box">
              <h3>캡션 &amp; 해시태그</h3>
              <textarea readOnly value={`${article.title}\n\n${article.summary}\n\n${article.tag} ${magazine.hashtags}\n(출처: ${article.source})`} />
              <div className="caption-foot">
                <button className="btn" onClick={() => {
                  navigator.clipboard.writeText(`${article.title}\n\n${article.summary}\n\n${article.tag} ${magazine.hashtags}\n(출처: ${article.source})`);
                  showToast('캡션이 복사됐어요');
                }}>전체 복사</button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer>© 2026 CLIPPING · developed with Claude · 뉴스·이미지 API를 연결하면 실제 서비스로 확장돼요</footer>

      {settingsOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="modal">
            <h3 className="serif">매거진 설정</h3>
            <p className="sub">표지 카드와 캡션에 적용될 나만의 브랜드예요.</p>
            <div className="field">
              <label>매거진 이름</label>
              <input type="text" value={draftMag.name} onChange={(e) => setDraftMag({ ...draftMag, name: e.target.value })} />
            </div>
            <div className="field">
              <label>한줄 멘트</label>
              <input type="text" value={draftMag.tagline} onChange={(e) => setDraftMag({ ...draftMag, tagline: e.target.value })} />
            </div>
            <div className="field">
              <label>대표 컬러</label>
              <div className="swatches">
                {CATEGORIES.map((c) => c.color).concat(['#1E1B16']).map((col) => (
                  <div key={col} className={'swatch' + (draftMag.color === col ? ' selected' : '')} style={{ background: col }} onClick={() => setDraftMag({ ...draftMag, color: col })} />
                ))}
              </div>
            </div>
            <div className="field">
              <label>해시태그 (쉼표로 구분)</label>
              <input type="text" value={draftMag.hashtags} onChange={(e) => setDraftMag({ ...draftMag, hashtags: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setSettingsOpen(false)}>취소</button>
              <button className="btn primary" onClick={saveSettings}>저장</button>
            </div>
          </div>
        </div>
      )}

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </>
  );
}
