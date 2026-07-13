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
    const articleText = await fetchArticleText(link);
    if (articleText) {
      contentForPrompt = `기사 본문 전체: ${articleText.slice(0, 6000)}`;
    }
  }

  const prompt = `다음은 기사 제목과 본문이야. 본문을 처음부터 끝까지 다 읽고, 첫 문단만 보고 요약하지 말고 전체 내용을 반영해서 육하원칙(누가·언제·어디서·무엇을·어떻게·왜)에 맞게 정확하고 풍성하게 정리해줘. 이 정보에 있는 사실만 써야 하고(지어내지 말고), 원문 문장을 그대로 옮기지 말고 반드시 완전히 새로운 너의 표현으로 다시 써줘(패러프레이즈) — 저작권 때문에 원문 그대로 베끼면 안 돼. 자막처럼 구어체·잡음이 섞여 있어도 핵심만 추려서 문어체로 정리해줘.

제목: ${title}
${contentForPrompt}

아래 JSON 형식으로만 답해. 다른 텍스트는 절대 포함하지 마:
{"summary": "본문 전체를 반영한 한 문장 요약, 육하원칙 중 핵심 요소(누가 무엇을 언제·어디서 했는지)를 담을 것 (네 표현으로 새로 쓸 것)", "points": ["summary에 없는 구체적인 새 정보(일정, 장소, 배경, 이유 등)를 담은 완전한 문장 (네 표현으로 새로 쓸 것)", "본문 후반부에 나온 내용 등 summary에 없는 또 다른 구체적 정보 (본문이 짧아서 더 담을 정보가 없으면 배열을 비워도 됨 [])", "본문에 담긴 세 번째 구체적 정보 (없으면 생략 가능)"]}`;

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
async function fetchArticleText(url) {
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
    const paragraphs = [...withoutScripts.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 20);
    const text = paragraphs.join(' ');
    return text.length > 100 ? text : null;
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
