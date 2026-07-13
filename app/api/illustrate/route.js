export async function POST(request) {
  const { prompt } = await request.json();
  const styledPrompt = `flat vector illustration, simple geometric shapes and icons, absolutely no text or letters or writing or typography or logos or signage anywhere in the image, no readable characters of any kind, abstract symbolic representation only: ${prompt}`;
  const openaiKey = process.env.OPENAI_API_KEY;

  // If OPENAI_API_KEY is set, prefer it (higher, more controllable quality, costs money per image).
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: styledPrompt,
          size: '1024x1024',
        }),
      });
      if (!res.ok) throw new Error('openai image api error ' + res.status);
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) throw new Error('no image returned');
      return Response.json({ mode: 'live', provider: 'openai', image: `data:image/png;base64,${b64}` });
    } catch (err) {
      // fall through to the free option below rather than giving up entirely
    }
  }

  // Default: Pollinations.ai — genuinely free, no API key or signup required.
  // It's a public GET endpoint that returns an image directly, so we can just build the URL.
  // Rate limit for anonymous use is roughly 1 request per 15 seconds, which is fine for this app.
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=800&height=600&nologo=true&seed=${seed}`;
    return Response.json({ mode: 'live', provider: 'pollinations', image: url });
  } catch (err) {
    return Response.json({ mode: 'demo', provider: null, image: null });
  }
}
