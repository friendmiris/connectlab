import { MOCK_ARTICLES, CATEGORIES } from '../../../lib/mockArticles';

function stripTags(str = '') {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ');
}

function splitToPoints(text) {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    // drop a trailing fragment that's just Naver's own "..." truncation marker with no real content
    .filter(s => s.replace(/\.+$/, '').trim().length > 0);
  // IMPORTANT: never pad short results by repeating the last sentence - that was producing
  // duplicate-looking cards when a Naver snippet only had one real sentence in it.
  return parts.length ? parts.slice(0, 4) : [text];
}

// ---------- Naver News ----------
function normalizeForCompare(title) {
  return title
    .replace(/["'“”‘’\[\]〈〉《》\(\)…·,.!?]/g, '')
    .trim();
}

function titleSimilarity(a, b) {
  const wordsA = new Set(normalizeForCompare(a).split(/\s+/).filter((w) => w.length > 1));
  const wordsB = new Set(normalizeForCompare(b).split(/\s+/).filter((w) => w.length > 1));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) overlap++; });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// Different outlets often cover the exact same story with near-identical titles.
// Keep only the first (most relevant/recent, since results already came sorted) of each cluster.
function dedupeBySimilarTitle(articles, threshold = 0.6) {
  const kept = [];
  for (const article of articles) {
    const isDuplicate = kept.some((k) => titleSimilarity(k.title, article.title) >= threshold);
    if (!isDuplicate) kept.push(article);
  }
  return kept;
}

async function searchNaver({ query, sort, category, catLabel }) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Naver only supports sort=date (recency) or sort=sim (relevance, closest to "popular" since no view-count concept for news)
  const naverSort = sort === 'recent' ? 'date' : 'sim';
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=30&sort=${naverSort}`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('naver api error ' + res.status);
  const data = await res.json();
  const mapped = (data.items || []).map((item, i) => {
    const title = stripTags(item.title);
    const summary = stripTags(item.description);
    return {
      id: `naver-${Date.now()}-${i}`,
      kind: 'news',
      cat: category || 'issue',
      catLabel,
      source: (item.originallink || item.link || '').replace(/^https?:\/\//, '').split('/')[0] || '네이버뉴스',
      date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : '',
      title,
      summary,
      points: splitToPoints(summary),
      tag: catLabel ? `#${catLabel}` : '#뉴스',
      link: item.originallink || item.link,
    };
  });
  return dedupeBySimilarTitle(mapped);
}

// ---------- YouTube ----------
function cleanDescription(text) {
  return text
    .replace(/https?:\/\/\S+/g, '') // strip URLs (promo links, not real content)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      // drop lines that are just hashtags/emoji with no real sentence content
      const withoutHashtags = line.replace(/#\S+/g, '').trim();
      return withoutHashtags.length > 3;
    })
    .join(' ')
    .replace(/#\S+/g, '') // strip any remaining inline hashtags
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function searchYouTube({ query, sort }) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  // YouTube search order: viewCount = popular, date = recent
  const order = sort === 'recent' ? 'date' : 'viewCount';
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=30&order=${order}&relevanceLanguage=ko&regionCode=KR&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(searchUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('youtube api error ' + res.status);
  const data = await res.json();
  const items = data.items || [];
  const videoIds = items.map(it => it.id.videoId).filter(Boolean).join(',');

  // fetch view counts for display (search endpoint doesn't include statistics)
  let statsById = {};
  if (videoIds) {
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`, { cache: 'no-store' });
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      (statsData.items || []).forEach(v => { statsById[v.id] = v.statistics; });
    }
  }

  return items.filter(it => it.id.videoId).map(it => {
    const vid = it.id.videoId;
    const stats = statsById[vid] || {};
    const views = stats.viewCount ? Number(stats.viewCount).toLocaleString('ko-KR') + '회' : '';
    const summary = cleanDescription(stripTags(it.snippet.description || ''));
    return {
      id: `yt-${vid}`,
      kind: 'youtube',
      cat: 'issue',
      catLabel: '',
      source: it.snippet.channelTitle,
      date: it.snippet.publishedAt ? new Date(it.snippet.publishedAt).toLocaleDateString('ko-KR') : '',
      title: stripTags(it.snippet.title),
      summary: summary || (views ? `조회수 ${views}` : '영상 설명이 제공되지 않았어요.'),
      points: splitToPoints(summary || it.snippet.title),
      tag: views ? `#조회수${views}` : '#유튜브',
      link: `https://www.youtube.com/watch?v=${vid}`,
    };
  });
}

// ---------- Google (Custom Search JSON API) ----------
async function searchGoogle({ query, sort }) {
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) return null;

  // Google CSE has no "popularity" sort - only relevance (default) or date-restricted freshness.
  // For "recent" we bias toward the last month using dateRestrict; "popular" uses plain relevance ranking.
  const params = new URLSearchParams({ key: apiKey, cx, q: query, num: '10' });
  if (sort === 'recent') params.set('dateRestrict', 'm1');
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('google cse error ' + res.status);
  const data = await res.json();
  return (data.items || []).map((item, i) => ({
    id: `g-${Date.now()}-${i}`,
    kind: 'google',
    cat: 'issue',
    catLabel: '',
    source: (item.displayLink || '').replace(/^www\./, ''),
    date: '',
    title: item.title,
    summary: item.snippet || '',
    points: splitToPoints(item.snippet || item.title),
    tag: '#검색결과',
    link: item.link,
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || '';
  const keyword = searchParams.get('keyword') || '';
  const source = searchParams.get('source') || 'news'; // news | youtube | google
  const sort = searchParams.get('sort') || 'popular'; // popular | recent

  const catLabel = CATEGORIES.find(c => c.id === category)?.label || '';
  // YouTube's search doesn't have Naver's Korean-news context, so a bare "IT" reads as the
  // English pronoun "it" and pulls in totally unrelated globally popular videos. Use a less
  // ambiguous label for YouTube queries specifically.
  const youtubeCatLabel = category === 'it' ? 'IT 기술' : catLabel;
  const query = [catLabel, keyword].filter(Boolean).join(' ') || catLabel || '뉴스';
  const youtubeQuery = [youtubeCatLabel, keyword].filter(Boolean).join(' ') || youtubeCatLabel || '뉴스';

  try {
    let articles = null;
    if (source === 'news') articles = await searchNaver({ query, sort, category, catLabel });
    else if (source === 'youtube') articles = await searchYouTube({ query: youtubeQuery, sort });
    else if (source === 'google') articles = await searchGoogle({ query, sort });

    if (articles) {
      // youtube/google results aren't pre-filtered by category, so tag them for consistent card styling
      articles = articles.map(a => ({ ...a, cat: category || a.cat || 'issue' }));
      return Response.json({ mode: 'live', source, sort, articles });
    }
  } catch (err) {
    // real API call failed (bad key, quota, network) - fall back to demo data below,
    // and let the client know via `error` so it isn't silently misleading.
    return Response.json({ mode: 'demo', source, sort, articles: demoFallback({ category, keyword, source }), error: String(err.message || err) });
  }

  // demo mode: no key configured for this source yet
  return Response.json({ mode: 'demo', source, sort, articles: demoFallback({ category, keyword, source }) });
}

function demoFallback({ category, keyword, source }) {
  let list = MOCK_ARTICLES.filter(a => a.kind === source || (!a.kind && source === 'news'));
  if (category) list = list.filter(a => a.cat === category);
  if (keyword) {
    // IMPORTANT: if nothing matches the keyword, return an empty list rather than
    // silently showing unrelated items - that was the bug reported previously.
    list = list.filter(a => (a.title + a.summary + a.tag).includes(keyword));
  }
  return list;
}
