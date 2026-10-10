/** Read-only facade for the public SwordWeave artwork catalog. */
export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    let key;
    try { key = decodeURIComponent(new URL(request.url).pathname).slice(1); }
    catch { return new Response('Invalid path', { status: 400 }); }
    // No bucket listings, writes, arbitrary folders, or private upload access.
    if (!/^(?:images\/(characters|lineages|heritages)|art\/monsters)\/[a-zA-Z0-9_./-]+\.(png|webp)$/.test(key)
        || key.split('/').some(segment => segment === '..' || segment === '.')) {
      return new Response('Not found', { status: 404 });
    }
    const object = await env.ART.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', key.endsWith('.webp') ? 'image/webp' : 'image/png');
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Content-Type-Options', 'nosniff');
    const matches = request.headers.get('If-None-Match')?.split(',').map(value => value.trim());
    if (matches?.includes(object.httpEtag) || matches?.includes('*')) return new Response(null, { status: 304, headers });
    headers.set('Content-Length', String(object.size));
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  },
};
