export async function POST(request) {
  const { title, summary } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json({ mode: 'demo', summary: null, points: null });
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
            content: `다음은 뉴스 검색 API가 준 제목과, 종종 잘려있거나 대화체라 어색한 요약문이야. 이 정보에 있는 사실만 써서(지어내지 말고) 카드뉴스용으로 자연스럽게 다듬어줘.\n\n제목: ${title}\n요약: ${summary}\n\n아래 JSON 형식으로만 답해. 다른 텍스트는 절대 포함하지 마:\n{"summary": "한 문장으로 자연스럽게 다듬은 요약", "points": ["완전한 문장", "완전한 문장 (담을 정보가 부족하면 배열에 1개만 넣어도 됨)"]}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error('anthropic error ' + res.status);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!parsed.summary || !Array.isArray(parsed.points) || !parsed.points.length) {
      throw new Error('unexpected response shape');
    }
    return Response.json({ mode: 'live', summary: parsed.summary, points: parsed.points });
  } catch (err) {
    return Response.json({ mode: 'demo', summary: null, points: null });
  }
}
