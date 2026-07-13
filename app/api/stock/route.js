export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || 'news';
  const seed = searchParams.get('seed') || '1';
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (apiKey) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${apiKey}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('unsplash error ' + res.status);
      const data = await res.json();
      const photo = data.results && data.results[0];
      if (photo) {
        return Response.json({
          mode: 'live',
          image: photo.urls.regular,
          credit: `Photo by ${photo.user.name} on Unsplash`,
        });
      }
    } catch (err) {
      // fall through to placeholder below
    }
  }

  // demo mode: no UNSPLASH_ACCESS_KEY set, or the query returned nothing.
  // NOTE: this is a random placeholder, not actually related to the query.
  return Response.json({
    mode: 'demo',
    image: `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/480`,
    credit: null,
  });
}
