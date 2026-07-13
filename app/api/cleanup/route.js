export async function POST(request) {
  const { title, summary, videoId } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json({ mode: 'demo', summary: null, points: null });
  }

  let contentForPrompt = `요약: ${summary}`;
  if (videoId) {
    const transcript = await fetchYoutubeTranscript(videoId);
    if (transcript) {
      contentForPrompt = `영상 자막 일부: ${transcript.slice(0, 3000)}`;
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `다음은 콘텐츠 제목과 내용이야. 이 정보에 있는 사실만 써서(지어내지 말고) 카드뉴스용으로 자연스럽게 다듬어줘. 자막처럼 구어체·잡음이 섞여 있어도 핵심 내용만 추려서 문어체로 정리해줘.\n\n제목: ${title}\n${contentForPrompt}\n\n아래 JSON 형식으로만 답해. 다른 텍스트는 절대 포함하지 마:\n{"summary": "한 문장으로 자연스럽게 다듬은 요약", "points": ["summary에 없는 새로운 정보를 담은 완전한 문장", "summary에 없는 또 다른 새로운 정보 (원본 정보가 짧아서 summary 이상의 새로운 내용이 없으면 빈 배열 []을 반환해도 됨. summary 문장을 그대로 옮기거나 살짝 바꿔 쓰지 말 것)"]}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error('anthropic error ' + res.status);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!parsed.summary || !Array.isArray(parsed.points)) {
      throw new Error('unexpected response shape');
    }
    return Response.json({ mode: 'live', summary: parsed.summary, points: parsed.points });
  } catch (err) {
    return Response.json({ mode: 'demo', summary: null, points: null });
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

