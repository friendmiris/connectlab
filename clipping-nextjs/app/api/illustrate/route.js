export async function POST(request) {
  const { prompt } = await request.json();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // demo mode: no key configured yet, client will show a mock preview instead
    return Response.json({ mode: 'demo', image: null });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: `magazine editorial illustration, flat vector style, no text, no logos: ${prompt}`,
        size: '1024x1024',
      }),
    });
    if (!res.ok) throw new Error('image api error ' + res.status);
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('no image returned');
    return Response.json({ mode: 'live', image: `data:image/png;base64,${b64}` });
  } catch (err) {
    return Response.json({ mode: 'demo', image: null });
  }
}
