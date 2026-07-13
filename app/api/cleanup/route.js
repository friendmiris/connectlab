export async function POST(request) {
  const { title, summary, videoId, link } = await request.json();
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!geminiKey && !anthropicKey) {
    return Response.json({ mode: 'demo', summary: null, points: null });
  }

  let contentForPrompt = `요약: ${summary}`;
  if (videoId) {
    const transcript = await fetchYoutubeTranscript(videoId);
    if (transcript) {
      contentForPrompt = `영상 자막 일부: ${transcript.slice(0, 3000)}`;
    }
  } else if (link) {
    // Naver's search API only gives a one-line snippet - fetch the actual article page
    // so the summary can be based on the real content, not just that teaser line.
    const articleText = await fetchArticleText(link, title);
    if (articleText) {
      contentForPrompt = `기사 본문 전체: ${articleText.slice(0, 6000)}`;
    }
  }

  const prompt = `다음은 기사 제목과 본문이야. 본문을 처음부터 끝까지 다 읽어. 절대 첫 1~2문단만 보고 요약하면 안 돼 — 중반부·후반부에 나오는 구체적인 정보(장소명, 날짜, 명단, 인용문 등)를 반드시 찾아서 반영해야 해. 이 정보에 있는 사실만 써야 하고(지어내지 말고), 원문 문장을 그대로 옮기지 말고 반드시 완전히 새로운 너의 표현으로 다시 써줘(패러프레이즈) — 저작권 때문에 원문 그대로 베끼면 안 돼.

제목: ${title}
${contentForPrompt}

카드뉴스 3장 분량으로 나눠서 아래 JSON 형식으로만 답해. 다른 텍스트는 절대 포함하지 마:
{
  "summary": "무엇을·누가·왜 하는지 핵심을 담은 한 문장 요약",
  "points": [
    "어디서·언제 하는지 — 구체적 장소명(리스트 있으면 나열)과 날짜·기간을 반드시 포함한 문장 (1~2문장 가능)",
    "구체적인 프로그램·내용 예시 2~3가지를 실제 이름과 함께 나열한 문장 (1~2문장 가능)",
    "관계자 발언 인용이나 추가 정보(참여 방법, 문의처 등)를 담은 문장 (없으면 이 배열 항목은 생략)"
  ]
}
본문에 해당 정보가 실제로 없는 항목은 억지로 만들지 말고 points 배열에서 그 항목을 빼줘.`;

  const clean = (s) => s.replace(/[.…]{2,}\s*$/, '').trim();

  // Prefer Gemini first - it's genuinely free (no billing required) for the Flash models,
  // unlike Anthropic/OpenAI which require a paid account. Falls back to Claude if configured
  // and Gemini isn't set up or fails.
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (!res.ok) throw new Error('gemini error ' + res.status);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (parsed.summary && Array.isArray(parsed.points)) {
        return Response.json({
          mode: 'live',
          provider: 'gemini',
          summary: clean(parsed.summary),
          points: parsed.points.slice(0, 3).map(clean),
        });
      }
    } catch (err) {
      // fall through to Anthropic (if configured) or demo mode below
    }
  }

  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new Error('anthropic error ' + res.status);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (parsed.summary && Array.isArray(parsed.points)) {
        return Response.json({
          mode: 'live',
          provider: 'anthropic',
          summary: clean(parsed.summary),
          points: parsed.points.slice(0, 3).map(clean),
        });
      }
    } catch (err) {
      // fall through to demo mode below
    }
  }

  return Response.json({ mode: 'demo', summary: null, points: null });
}

// Fetches the original article page and pulls out the visible paragraph text so the AI
// has real content to summarize from, instead of Naver's one-line snippet. This text is
// never shown to the user directly - it's only used as input for the AI to write a fresh,
// paraphrased summary (see the prompt above), which is what actually gets displayed.
async function fetchArticleText(url, title) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CardNewsBot/1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const boilerplate = /무단\s*전재|재배포\s*금지|저작권자|ⓒ|copyright|기자\s*=|이메일\s*무단수집|기사제보|구독\s*신청|제보(는|를|해)|제보\s*가능|비리.{0,10}부당대우|앱\s*다운로드|알림\s*설정|구독하기/i;
    const paragraphs = [...withoutScripts.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 25 && !boilerplate.test(p));
    const text = paragraphs.join(' ');
    if (text.length <= 100) return null;

    // A real article body is usually a handful of longer paragraphs. A "related articles" or
    // "latest news" widget tends to be many short one-line teasers instead - if that's the
    // shape of what we got, it's probably not the actual article.
    const avgLen = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
    if (paragraphs.length > 12 && avgLen < 60) return null;

    // Sanity check: if the extracted text doesn't clearly relate to the title, we probably
    // grabbed the wrong block (a "related articles" list, site chrome, etc.) instead of the
    // actual article. Require at least 2 distinct title words to show up - a single
    // coincidental match isn't enough, since a "recent articles" sidebar can easily contain
    // one word that happens to match while being full of unrelated stories.
    if (title) {
      const titleWords = title
        .replace(/[\[\]'"·…,.!?()]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const matchCount = titleWords.filter((w) => text.includes(w)).length;
      const required = titleWords.length <= 2 ? 1 : 2;
      if (titleWords.length > 0 && matchCount < required) return null;
    }

    return text;
  } catch (err) {
    // paywalled, blocked, timed out, or not html - fall back to the short snippet
    return null;
  }
}

// Unofficial: YouTube doesn't require a key for public caption tracks via this endpoint.
// It's undocumented, so it can stop working without notice - that's a real tradeoff, not a bug
// if it occasionally fails. We just fall back to the short description when it does.
async function fetchYoutubeTranscript(videoId) {
  try {
    for (const lang of ['ko', 'en']) {
      const res = await fetch(`https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml || !xml.includes('<text')) continue;
      const matches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
      if (!matches.length) continue;
      const text = matches
        .map((m) => m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
        .join(' ');
      if (text.trim().length > 30) return text;
    }
  } catch (err) {
    // no captions available, or the unofficial endpoint changed - fall back silently
  }
  return null;
}
