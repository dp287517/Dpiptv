/**
 * Dpiptv — proxy de flux IPTV (Cloudflare Worker)
 *
 * Contourne les deux blocages navigateur qui empêchent de lire certains flux
 * depuis player.html : les flux http:// (mixed content) et les serveurs sans
 * en-têtes CORS. Les manifests HLS (.m3u8) sont réécrits pour que segments et
 * clés passent aussi par le proxy — la lecture HLS native (iOS) fonctionne donc
 * aussi.
 *
 * Déploiement (gratuit, ~5 minutes) :
 *   1. Crée un compte sur https://dash.cloudflare.com (plan Free)
 *   2. Workers & Pages → Create → Worker → nomme-le (ex: dpiptv-proxy)
 *   3. Remplace le code par ce fichier → Deploy
 *   4. Dans player.html → ⚙️ → colle : https://dpiptv-proxy.<ton-compte>.workers.dev/?url={url}
 *
 * Usage : GET https://<worker>/?url=<URL du flux encodée>
 */

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url)
    const target = reqUrl.searchParams.get('url')
    if (!target) return textResponse('Missing ?url= parameter', 400)

    let t
    try {
      t = new URL(target)
    } catch {
      return textResponse('Invalid url', 400)
    }
    if (t.protocol !== 'http:' && t.protocol !== 'https:') {
      return textResponse('Unsupported scheme', 400)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    let upstream
    try {
      upstream = await fetch(t.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': request.headers.get('user-agent') || 'VLC/3.0.20 LibVLC/3.0.20',
          Referer: t.origin + '/',
          Range: request.headers.get('range') || undefined
        }
      })
    } catch (e) {
      return textResponse('Upstream fetch failed: ' + e.message, 502)
    }

    const contentType = upstream.headers.get('content-type') || ''
    const finalUrl = upstream.url || t.toString()
    const isManifest =
      /mpegurl/i.test(contentType) || /\.m3u8?(\?|$)/i.test(new URL(finalUrl).pathname)

    const headers = corsHeaders()
    if (contentType) headers.set('Content-Type', contentType)

    if (isManifest && upstream.ok) {
      const text = await upstream.text()
      const proxyBase = reqUrl.origin + reqUrl.pathname + '?url='
      const rewritten = text
        .split('\n')
        .map(line => {
          const trimmed = line.trim()
          if (!trimmed) return line
          if (trimmed.startsWith('#')) {
            return line.replace(
              /URI="([^"]+)"/g,
              (_m, u) => `URI="${proxyBase}${encodeURIComponent(abs(u, finalUrl))}"`
            )
          }
          return proxyBase + encodeURIComponent(abs(trimmed, finalUrl))
        })
        .join('\n')
      headers.set('Content-Type', 'application/vnd.apple.mpegurl')
      return new Response(rewritten, { status: upstream.status, headers })
    }

    const passthrough = ['content-length', 'content-range', 'accept-ranges']
    for (const name of passthrough) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  }
}

function abs(u, base) {
  try {
    return new URL(u, base).toString()
  } catch {
    return u
  }
}

function corsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store'
  })
}

function textResponse(message, status) {
  return new Response(message, { status, headers: corsHeaders() })
}
