'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CATEGORIES, KEYWORDS } from '../lib/mockArticles';
import { supabase } from '../lib/supabaseClient';

const IMG_MODES = [
  { id: 'ai', label: '🖌 AI 일러스트', hint: '카드마다 "AI 일러스트 생성" 버튼을 누르면 진짜 이미지가 생성돼요. 키 없이 무료(Pollinations.ai)로 동작하고, OPENAI_API_KEY를 넣으면 더 고품질 유료 생성으로 바뀌어요.' },
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

function splitLongPoint(p, maxLen) {
  if (p.length <= maxLen) return [p];
  // try to split at a sentence boundary closest to the midpoint - never split mid-sentence
  const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 1) {
    let mid = 0, running = 0;
    for (let i = 0; i < sentences.length; i++) {
      running += sentences[i].length;
      if (running >= p.length / 2) { mid = i + 1; break; }
    }
    const first = sentences.slice(0, mid).join(' ').trim();
    const second = sentences.slice(mid).join(' ').trim();
    if (first && second) return [first, second];
  }
  // no sentence boundary available - leave it as one card rather than cutting mid-sentence
  return [p];
}

function buildCards(article, magazine) {
  const c = catInfo(article.cat);
  const cards = [];

  const allPoints = [...new Set((article.points || []).map((p) => p.trim()).filter(Boolean))];

  let coverText, bodyPoints;
  if (article.cleaned) {
    // Claude already wrote a standalone summary and points that deliberately avoid
    // repeating it, so use them as-is.
    coverText = article.summary || magazine.tagline;
    bodyPoints = allPoints;
  } else {
    // Raw regex-split sentences: the cover text and the points would otherwise be the
    // exact same sentences. Avoid duplication by construction instead of trying to detect
    // it after the fact - the cover gets the first sentence, the rest become points.
    coverText = allPoints.length > 1 ? allPoints[0] : (article.summary || magazine.tagline);
    bodyPoints = allPoints.length > 1 ? allPoints.slice(1) : [];
  }

  // If a point is too long for one card, split it across two cards instead of
  // cramming it all in - this can push the body card count past 3 when needed.
  const expandedPoints = bodyPoints.flatMap((p) => splitLongPoint(p, 140));

  cards.push({ type: 'cover', label: 'HOOK', title: article.title, text: coverText, custom: null, aiImage: null, aiState: 'idle', footLeft: article.source, footRight: article.date });

  expandedPoints.slice(0, 4).forEach((p, i) => {
    cards.push({ type: 'body', label: `BODY ${i + 1}`, title: `포인트 ${i + 1}`, text: p, custom: null, aiImage: null, aiState: 'idle', footLeft: article.source, footRight: article.date });
  });

  cards.push({ type: 'outro', label: '결론', title: '저장하고 오래 보기', text: `${article.tag}  ${magazine.hashtags}`, custom: null, aiImage: null, aiState: 'idle', footLeft: article.source, footRight: article.date });
  return cards.map((c2) => ({ ...c2, catColor: c.color, catLabel: c.label }));
}

export default function Home() {
  const [view, setView] = useState('home');
  const [category, setCategory] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [sourceKind, setSourceKind] = useState('news'); // news | youtube | google
  const [sort, setSort] = useState('popular'); // popular | recent
  const [searchMode, setSearchMode] = useState(null); // 'live' | 'demo'
  const [scraps, setScraps] = useState([]);
  const [user, setUser] = useState(null);
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginSent, setLoginSent] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    let localScraps = [];
    try {
      const saved = localStorage.getItem('clipping_scraps');
      if (saved) localScraps = JSON.parse(saved);
      setScraps(localScraps);
    } catch (e) {
      // localStorage unavailable or corrupted - just start empty
    }

    if (!supabase) return; // Supabase not configured - stay in local-only mode

    async function handleSession(session) {
      if (!session) {
        setUser(null);
        return;
      }
      const u = session.user;
      setUser(u);
      const { data } = await supabase
        .from('user_favorites')
        .select('favorites')
        .eq('user_id', u.id)
        .maybeSingle();
      if (data && data.favorites && data.favorites.length) {
        setScraps(data.favorites);
        try { localStorage.setItem('clipping_scraps', JSON.stringify(data.favorites)); } catch (e) {}
      } else if (localScraps.length) {
        // first login on this device with existing local scraps - push them up as the starting cloud copy
        await supabase
          .from('user_favorites')
          .upsert({ user_id: u.id, favorites: localScraps, updated_at: new Date().toISOString() });
      }
      showToast(`${u.email} 로 로그인됐어요`);
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => handleSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function requestLoginLink() {
    if (!supabase) { showToast('Supabase가 아직 설정 안 돼있어요'); return; }
    const email = loginEmailInput.trim();
    if (!email.includes('@')) { showToast('이메일 형식을 확인해주세요'); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) showToast('로그인 링크 발송 실패: ' + error.message);
    else {
      setLoginSent(true);
      showToast('로그인 링크를 보냈어요, 메일함을 확인해주세요');
    }
  }

  function logout() {
    if (supabase) supabase.auth.signOut();
    setUser(null);
    showToast('로그아웃했어요');
  }

  function toggleScrap(article) {
    setScraps((prev) => {
      const exists = prev.some((a) => a.id === article.id);
      const next = exists ? prev.filter((a) => a.id !== article.id) : [article, ...prev];
      try {
        localStorage.setItem('clipping_scraps', JSON.stringify(next));
      } catch (e) {
        // storage full or unavailable - keep the in-memory state anyway
      }
      if (supabase && user) {
        supabase
          .from('user_favorites')
          .upsert({ user_id: user.id, favorites: next, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) showToast('동기화 실패: ' + error.message); });
      }
      return next;
    });
  }

  function isScrapped(id) {
    return scraps.some((a) => a.id === id);
  }
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [article, setArticle] = useState(null);
  const [captionOverride, setCaptionOverride] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [cards, setCards] = useState([]);
  const [imageMode, setImageMode] = useState('ai');
  const [bulkLoading, setBulkLoading] = useState(false);

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

  async function openEditor(a) {
    setArticle(a);
    setCards(buildCards(a, magazine));
    setCaptionOverride(null);
    setView('editor');
    setCleaning(true);
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: a.title,
          summary: a.summary,
          videoId: a.kind === 'youtube' ? a.id.replace(/^yt-/, '') : null,
          link: a.kind === 'news' ? a.link : null,
        }),
      });
      const data = await res.json();
      if (data.mode === 'live' && data.summary && data.points) {
        const cleaned = { ...a, summary: data.summary, points: data.points, cleaned: true };
        setArticle(cleaned);
        setCards(buildCards(cleaned, magazine));
        showToast('AI로 카드 내용을 다듬었어요');
      }
    } catch (e) {
      // silently keep the original regex-split version
    } finally {
      setCleaning(false);
    }
  }

  function regen() {
    setCards(buildCards(article, magazine));
    showToast('카드뉴스를 다시 만들었어요');
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('image failed to load'));
      img.src = url;
    });
  }

  async function generateIllustration(idx) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, aiState: 'loading' } : c)));
    try {
      const prompt = `${catInfo(article.cat).label} theme: ${cards[idx].title}`;
      const res = await fetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!data.image) {
        setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, aiState: 'demo' } : c)));
        showToast('이미지 생성에 실패해서 미리보기로 대체했어요');
        return;
      }
      // Pollinations can take several seconds to actually render - wait for the browser
      // to finish loading it before showing it as ready, otherwise a quick download
      // afterwards would capture a blank image.
      await preloadImage(data.image);
      setCards((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, aiImage: data.image, aiProvider: data.provider, aiState: 'live' } : c))
      );
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, aiState: 'demo' } : c)));
      showToast('이미지를 불러오지 못했어요, 다시 시도해주세요');
    }
  }

  async function fetchStockPhoto(idx) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, stockState: 'loading' } : c)));
    try {
      const q = `${catInfo(article.cat).label} ${cards[idx].title}`.slice(0, 60);
      const res = await fetch(`/api/stock?q=${encodeURIComponent(q)}&seed=${article.id}-${idx}`);
      const data = await res.json();
      await preloadImage(data.image);
      setCards((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, stockImage: data.image, stockMode: data.mode, stockState: 'done' } : c))
      );
      if (data.mode === 'demo') showToast('UNSPLASH_ACCESS_KEY가 없어서 키워드와 무관한 예시 이미지로 대체했어요');
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, stockState: 'error' } : c)));
      showToast('이미지를 불러오지 못했어요');
    }
  }

  async function loadAllImages() {
    setBulkLoading(true);
    for (let idx = 0; idx < cards.length; idx++) {
      const card = cards[idx];
      if (card.custom) continue;
      if (imageMode === 'ai' && !card.aiImage) await generateIllustration(idx);
      if (imageMode === 'stock' && !card.stockImage) await fetchStockPhoto(idx);
    }
    setBulkLoading(false);
  }

  function uploadImage(idx, file) {
    const reader = new FileReader();
    reader.onload = () => {
      setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, custom: reader.result } : c)));
      showToast('이미지가 적용됐어요');
    };
    reader.readAsDataURL(file);
  }

  function waitForNodeImages(node) {
    const imgs = Array.from(node.querySelectorAll('img'));
    return Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 8000);
            })
      )
    );
  }

  async function downloadCard(idx) {
    const html2canvas = (await import('html2canvas')).default;
    const node = document.getElementById('card-' + idx);
    await waitForNodeImages(node);
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
      await waitForNodeImages(node);
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
            <button className="nav-btn ghost" onClick={() => setLoginModalOpen(true)}>
              {user ? `${user.email.split('@')[0]}님` : '로그인'}
            </button>
            <button className="nav-btn ghost" onClick={() => { setDraftMag(magazine); setSettingsOpen(true); }}>매거진 설정</button>
            <button className={'nav-btn ghost' + (view === 'scraps' ? ' active' : '')} onClick={() => setView('scraps')}>
              스크랩{scraps.length > 0 ? ` (${scraps.length})` : ''}
            </button>
            <button className={'nav-btn' + (view === 'home' ? ' active' : '')} onClick={() => setView('home')}>홈</button>
          </nav>
        </div>
      </header>

      {searchMode === 'demo' && view !== 'home' && (
        <div className="mode-banner demo">
          {sourceKind === 'news' ? '뉴스' : sourceKind === 'youtube' ? '유튜브' : '블로그'} 검색은 샘플 데이터로 동작 중이에요 · {sourceKind === 'news' ? 'NAVER_CLIENT_ID' : sourceKind === 'youtube' ? 'YOUTUBE_API_KEY' : 'NAVER_CLIENT_ID'} 를 설정하면 실시간 검색으로 바뀝니다
          {searchError ? ` (API 오류: ${searchError})` : ''}
        </div>
      )}
      {searchMode === 'live' && view !== 'home' && (
        <div className="mode-banner live">실시간 {sourceKind === 'news' ? '네이버 뉴스' : sourceKind === 'youtube' ? '유튜브' : '네이버 블로그'} 검색 결과예요 ({sort === 'popular' ? '인기순' : '최신순'})</div>
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
                {[{ id: 'news', label: '📰 뉴스' }, { id: 'youtube', label: '▶ 유튜브' }, { id: 'blog', label: '📝 블로그' }].map((s) => (
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
                      <button
                        className="scrap-btn"
                        onClick={() => toggleScrap(a)}
                        aria-label={isScrapped(a.id) ? '스크랩 해제' : '스크랩'}
                        title={isScrapped(a.id) ? '스크랩 해제' : '스크랩'}
                      >
                        {isScrapped(a.id) ? '★' : '☆'}
                      </button>
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

        {view === 'scraps' && (
          <>
            <div className="results-head">
              <div>
                <button className="back-link" onClick={() => setView('home')}>← 홈으로</button>
                <h2 className="serif" style={{ marginTop: 6 }}>스크랩한 기사</h2>
              </div>
              <div className="results-count">{scraps.length}건</div>
            </div>

            <div className="caption-box" style={{ marginBottom: 24 }}>
              <h3>다른 기기에서도 보기</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.6 }}>
                {user ? (
                  <>✓ <b>{user.email}</b> 로 로그인돼 있어요 — 다른 기기에서도 같은 이메일로 로그인하면 이 스크랩이 그대로 보여요.</>
                ) : (
                  <>오른쪽 위 <b>"로그인"</b> 버튼으로 이메일 로그인하면, 다른 기기에서도 같은 스크랩을 볼 수 있어요. 로그인 안 하면 이 브라우저에만 저장돼요.</>
                )}
              </p>
            </div>

            {scraps.length === 0 ? (
              <div className="empty-state">아직 스크랩한 기사가 없어요. 검색 결과에서 ☆ 버튼을 눌러 저장해보세요.</div>
            ) : (
              <div className="clip-grid">
                {scraps.map((a) => {
                  const c = catInfo(a.cat) || catInfo('issue');
                  return (
                    <div className="clip-card" key={a.id}>
                      <div className="tape" style={{ background: c.color }} />
                      <button className="scrap-btn" onClick={() => toggleScrap(a)} aria-label="스크랩 해제" title="스크랩 해제">★</button>
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

            {cleaning && (
              <div className="mode-banner live" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} />
                AI가 카드 내용을 더 정확하게 다듬는 중이에요. 몇 초만 기다려주세요...
              </div>
            )}

            <div className="mode-row">
              {IMG_MODES.map((m) => (
                <button key={m.id} className={'mode-btn' + (imageMode === m.id ? ' active' : '')} onClick={() => setImageMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            {(imageMode === 'ai' || imageMode === 'stock') && (
              <button className="btn" style={{ marginBottom: 16 }} disabled={bulkLoading} onClick={loadAllImages}>
                {bulkLoading ? '카드마다 이미지 불러오는 중...' : `카드 ${cards.length}장 이미지 한 번에 불러오기`}
              </button>
            )}

            <div className="filmstrip">
              {cards.map((card, idx) => (
                <div className="frame" key={idx}>
                  <div className="frame-label"><span>{card.label}</span><span>{idx + 1} / {cards.length}</span></div>
                  <div className="card" id={'card-' + idx}>
                    <div className="card-media">
                      {(card.aiState === 'loading' || card.stockState === 'loading') && (
                        <div className="media-loading"><span className="spinner-lg" /></div>
                      )}
                      {card.custom ? (
                        <img src={card.custom} alt="" crossOrigin="anonymous" />
                      ) : imageMode === 'ai' ? (
                        card.aiImage ? (
                          <img src={card.aiImage} alt="" crossOrigin="anonymous" />
                        ) : (
                          <MockIllustration catId={article.cat} color={card.catColor} seed={idx + 1} />
                        )
                      ) : imageMode === 'stock' ? (
                        card.stockImage ? (
                          <img src={card.stockImage} alt="" crossOrigin="anonymous" />
                        ) : (
                          <MockIllustration catId={article.cat} color={card.catColor} seed={idx + 1} />
                        )
                      ) : (
                        <div className="ph">이미지 없음<br />아래 &apos;이미지 업로드&apos;로 사진을 추가하세요</div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-cat" style={{ color: card.catColor }}>{card.catLabel.toUpperCase()} · {magazine.name}</div>
                      <div
                        className="card-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const val = e.currentTarget.innerText;
                          setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, title: val } : c)));
                        }}
                      >
                        {card.title}
                      </div>
                      <div
                        className="card-text"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const val = e.currentTarget.innerText;
                          setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, text: val } : c)));
                        }}
                      >
                        {card.text}
                      </div>
                      <div className="card-foot">
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const val = e.currentTarget.innerText;
                            setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, footLeft: val } : c)));
                          }}
                        >
                          {card.footLeft}
                        </span>
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const val = e.currentTarget.innerText;
                            setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, footRight: val } : c)));
                          }}
                        >
                          {card.footRight}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="frame-tools">
                    {imageMode === 'ai' && !card.custom && (
                      <button className="tool-btn" disabled={card.aiState === 'loading'} onClick={() => generateIllustration(idx)}>
                        {card.aiState === 'loading' ? <><span className="spinner" />생성 중</> : 'AI 일러스트'}
                      </button>
                    )}
                    {imageMode === 'stock' && !card.custom && (
                      <button className="tool-btn" disabled={card.stockState === 'loading'} onClick={() => fetchStockPhoto(idx)}>
                        {card.stockState === 'loading' ? <><span className="spinner" />불러오는 중</> : '이미지 불러오기'}
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
              <textarea
                value={captionOverride ?? `${article.title}\n\n${article.summary}\n\n${article.tag} ${magazine.hashtags}\n(출처: ${article.source})`}
                onChange={(e) => setCaptionOverride(e.target.value)}
              />
              <div className="caption-foot">
                <button className="btn" onClick={() => {
                  navigator.clipboard.writeText(captionOverride ?? `${article.title}\n\n${article.summary}\n\n${article.tag} ${magazine.hashtags}\n(출처: ${article.source})`);
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

      {loginModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setLoginModalOpen(false)}>
          <div className="modal">
            <h3 className="serif">{user ? '내 계정' : '이메일로 로그인'}</h3>
            {user ? (
              <>
                <p className="sub">✓ <b>{user.email}</b> 로 로그인돼 있어요. 다른 기기에서도 같은 이메일로 로그인하면 스크랩이 그대로 보여요.</p>
                <div className="modal-actions">
                  <button className="btn" onClick={() => setLoginModalOpen(false)}>닫기</button>
                  <button className="btn primary" onClick={() => { logout(); setLoginModalOpen(false); }}>로그아웃</button>
                </div>
              </>
            ) : (
              <>
                <p className="sub">비밀번호 없이, 이메일로 받은 링크만 누르면 로그인돼요. 로그인하면 스크랩이 다른 기기에서도 똑같이 보여요.</p>
                {loginSent ? (
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1F9D74' }}>메일함(스팸함도)을 확인해서 링크를 눌러주세요.</p>
                ) : (
                  <div className="field">
                    <label>이메일 주소</label>
                    <input
                      type="text"
                      value={loginEmailInput}
                      onChange={(e) => setLoginEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && requestLoginLink()}
                    />
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn" onClick={() => setLoginModalOpen(false)}>닫기</button>
                  {!loginSent && <button className="btn primary" onClick={requestLoginLink}>로그인 링크 받기</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </>
  );
}
