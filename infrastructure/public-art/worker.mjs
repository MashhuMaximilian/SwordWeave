/** Read-only facade for the public artwork catalog and versioned free rulebooks. */
export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    let key;
    try { key = decodeURIComponent(new URL(request.url).pathname).slice(1); }
    catch { return new Response('Invalid path', { status: 400 }); }
    // No bucket listings, writes, arbitrary folders, or private upload access.
    const isImage = /^images\/(characters|lineages|heritages|monsters)\/[a-zA-Z0-9_./-]+\.(png|webp)$/.test(key);
    const isBookArt = /^images\/books\/v0\.1-alpha\/(bridge|workshop|camp|tools|watcher|grazer|custodian)(-master\.png|\.webp)$/.test(key)
      || /^images\/books\/v0\.1-alpha\/print-r2\/(phb-cover|gm-cover|party-cutout|custodian-cutout|skyborn-cutout|surgeon-cutout|guardian-cutout|artificer-cutout)(-master\.png|\.webp)$/.test(key);
    const isBook = /^documents\/swordweave\/v0\.1-alpha\/(players-handbook|game-masters-guide|srd)(-dark)?\.pdf$/.test(key)
      || /^documents\/swordweave\/v0\.1-alpha\/print-r2\/(players-handbook|game-masters-guide)(-dark)?\.pdf$/.test(key)
      || /^documents\/swordweave\/v0\.1-alpha\/interwoven-2026-10-19\/players-handbook(-full)?\.pdf$/.test(key)
      || /^documents\/swordweave\/v0\.1-alpha\/organic-2026-10-20\/game-masters-guide(-full)?\.pdf$/.test(key)
      || key === 'documents/swordweave/v0.1-alpha/reference-2026-10-21/srd.pdf';
    if ((!isImage && !isBookArt && !isBook)
        || key.split('/').some(segment => segment === '..' || segment === '.')) {
      return new Response('Not found', { status: 404 });
    }
    const object = await env.ART.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', isBook ? 'application/pdf' : key.endsWith('.webp') ? 'image/webp' : 'image/png');
    if (isBook) headers.set('Content-Disposition', `inline; filename="swordweave-${key.split('/').at(-1)}"`);
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
