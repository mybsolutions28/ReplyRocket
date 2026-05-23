// =============================================================================
// Instagram Graph API helpers (Instagram API with Instagram Login)
// Docs: https://developers.facebook.com/docs/instagram-platform
// =============================================================================

import https from 'node:https'

const IG_OAUTH_HOST = 'https://www.instagram.com'
const IG_API_HOST = 'https://api.instagram.com'
const IG_GRAPH_HOST = 'https://graph.instagram.com'

/** LOCAL DEV ONLY: set IG_INSECURE_TLS=1 if Node cannot verify TLS to Meta (proxy/antivirus) → token exchange fails with "fetch failed". NEVER use in production. */
function instagramTlsBypassEnabled() {
  return process.env.IG_INSECURE_TLS === '1'
}

/**
 * @param {string} urlString
 * @param {{ method?: string, headers?: Record<string,string>, body?: string }} opts
 */
function instagramHttpsRequest(urlString, { method = 'GET', headers = {}, body } = {}) {
  const url = new URL(urlString)
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : null
  const hdrs = { ...headers }
  if (payload) hdrs['Content-Length'] = String(payload.length)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: hdrs,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              if (!text) return {}
              try {
                return JSON.parse(text)
              } catch {
                throw new Error(text.slice(0, 200))
              }
            },
          })
        })
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function igFetch(url, init = {}) {
  if (!instagramTlsBypassEnabled()) return fetch(url, init)
  const bodyStr =
    typeof init.body === 'string' ? init.body : init.body == null ? undefined : String(init.body)
  return instagramHttpsRequest(url, {
    method: init.method || 'GET',
    headers: init.headers || {},
    body: bodyStr,
  })
}

const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
].join(',')

// Instagram Login OAuth uses the **Instagram app ID + secret** shown under
// Developers → Instagram API → API setup with Instagram login ("Instagram app ID").
// The numeric App ID under App settings → Basic is often different; using it as
// client_id causes instagram.com to show "Sorry, this page isn't available."
function igOAuthClientId() {
  return process.env.META_INSTAGRAM_APP_ID || process.env.META_APP_ID
}

function igOAuthClientSecret() {
  return process.env.META_INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET
}

export function isInstagramConfigured() {
  return !!(igOAuthClientId() && igOAuthClientSecret())
}

export function buildAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: igOAuthClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: IG_SCOPES,
    state,
  })
  return `${IG_OAUTH_HOST}/oauth/authorize?${params.toString()}`
}

export async function exchangeCodeForShortLivedToken({ code, redirectUri }) {
  const body = new URLSearchParams({
    client_id: igOAuthClientId(),
    client_secret: igOAuthClientSecret(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const resp = await igFetch(`${IG_API_HOST}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_short_token_${resp.status}: ${JSON.stringify(data)}`)
  // { access_token, user_id, permissions }
  return data
}

export async function exchangeForLongLivedToken({ shortLivedToken }) {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: igOAuthClientSecret(),
    access_token: shortLivedToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/access_token?${params.toString()}`, { method: 'GET' })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_long_token_${resp.status}: ${JSON.stringify(data)}`)
  // { access_token, token_type: 'bearer', expires_in: 5184000 }
  return data
}

export async function refreshLongLivedToken({ accessToken }) {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/refresh_access_token?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_refresh_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

export async function fetchUserProfile({ accessToken, igUserId = 'me' }) {
  const params = new URLSearchParams({
    fields: 'id,username,name,account_type,profile_picture_url',
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/${igUserId}?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_profile_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

export async function sendDirectMessage({ accessToken, recipientIgsid, text }) {
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/me/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { text },
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_send_dm_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** Required so Meta delivers comment webhooks for this connected IG account (dashboard alone is not enough). */
export async function enableInstagramWebhookSubscriptions({
  accessToken,
  fields = ['comments', 'live_comments', 'messages'],
}) {
  const params = new URLSearchParams({
    subscribed_fields: fields.join(','),
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/me/subscribed_apps?${params.toString()}`, {
    method: 'POST',
  })
  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(`ig_subscribed_apps_${resp.status}: ${JSON.stringify(data)}`)
  }
  return data
}

/** First DM after a comment must use comment_id (Private Replies), not recipient user id. */
export async function sendPrivateReplyToComment({ accessToken, commentId, text }) {
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/me/messages?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text },
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_private_reply_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

export async function replyToComment({ accessToken, commentId, text }) {
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: text, access_token: accessToken }).toString(),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_reply_comment_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** GET /me/media — counts toward instagram_business_manage_comments App Review testing. */
export async function fetchRecentMedia({ accessToken, limit = 5 }) {
  const params = new URLSearchParams({
    fields: 'id',
    limit: String(limit),
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/me/media?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_media_list_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** GET /{media-id}/comments */
export async function fetchMediaComments({ accessToken, mediaId, limit = 25 }) {
  const params = new URLSearchParams({
    fields: 'id,text',
    limit: String(limit),
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/${mediaId}/comments?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_media_comments_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** POST /{media-id}/comments — Meta App Review often counts write calls, not GET alone. */
export async function createMediaComment({ accessToken, mediaId, text }) {
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/${mediaId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: text, access_token: accessToken }).toString(),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_create_comment_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

const APP_REVIEW_COMMENT_PROBE_TEXT = 'ReplyRocket Meta app review test — safe to delete'

/**
 * Meta App Review "Testing" for instagram_business_manage_comments often only registers
 * POST comment actions (create comment / reply), not GET list alone.
 */
export async function probeCommentsApiForAppReview({ accessToken }) {
  const media = await fetchRecentMedia({ accessToken, limit: 5 })
  const mediaId = media?.data?.[0]?.id
  if (!mediaId) {
    return { ok: true, skipped: 'no_media', message: 'Post at least one reel/photo on Instagram, then retry.' }
  }

  const comments = await fetchMediaComments({ accessToken, mediaId })
  const steps = ['list_media', 'list_comments']
  let writeAction = null

  const firstCommentId = comments?.data?.[0]?.id
  if (firstCommentId) {
    const reply = await replyToComment({
      accessToken,
      commentId: firstCommentId,
      text: APP_REVIEW_COMMENT_PROBE_TEXT,
    })
    steps.push('reply_to_comment')
    writeAction = { type: 'reply', comment_id: firstCommentId, id: reply?.id ?? null }
  } else {
    const created = await createMediaComment({
      accessToken,
      mediaId,
      text: APP_REVIEW_COMMENT_PROBE_TEXT,
    })
    steps.push('create_comment')
    writeAction = { type: 'create', id: created?.id ?? null }
  }

  return {
    ok: true,
    media_id: mediaId,
    comment_count: comments?.data?.length ?? 0,
    steps,
    write_action: writeAction,
    note: 'Delete the test comment on Instagram. Meta Testing may take up to 24h to show 1 of 1.',
  }
}

/** GET /me/conversations?platform=instagram — instagram_business_manage_messages */
export async function fetchInstagramConversations({ accessToken }) {
  const params = new URLSearchParams({
    platform: 'instagram',
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/me/conversations?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_conversations_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** GET /{conversation-id}?fields=messages */
export async function fetchConversationMessages({ accessToken, conversationId }) {
  const params = new URLSearchParams({
    fields: 'messages',
    access_token: accessToken,
  })
  const resp = await igFetch(`${IG_GRAPH_HOST}/v21.0/${conversationId}?${params.toString()}`)
  const data = await resp.json()
  if (!resp.ok) throw new Error(`ig_conversation_messages_${resp.status}: ${JSON.stringify(data)}`)
  return data
}

/** Meta App Review testing for instagram_business_manage_messages */
export async function probeMessagesApiForAppReview({ accessToken }) {
  const conversations = await fetchInstagramConversations({ accessToken })
  const steps = ['list_conversations']
  const convoId = conversations?.data?.[0]?.id
  let messageCount = 0

  if (convoId) {
    const convo = await fetchConversationMessages({ accessToken, conversationId: convoId })
    steps.push('list_messages')
    messageCount = convo?.messages?.data?.length ?? 0
  }

  return {
    ok: true,
    conversation_count: conversations?.data?.length ?? 0,
    message_count: messageCount,
    steps,
    note: 'Meta Testing may take up to 24h. An empty inbox still registers if the API returned 200.',
  }
}

// HMAC-SHA256 verification for Meta webhook payloads.
// Meta signs the raw POST body with the app secret and sends:
//    X-Hub-Signature-256: sha256=HEX_DIGEST
// Uses Settings → Basic secret (META_APP_SECRET) and/or Instagram API setup secret
// (META_INSTAGRAM_APP_SECRET) — whichever app you attached Webhooks to signs the body.
function metaWebhookSecretsToTry() {
  return [...new Set([process.env.META_APP_SECRET, process.env.META_INSTAGRAM_APP_SECRET].filter(Boolean))]
}

export function verifyMetaWebhookSignature({ rawBody, signatureHeader, crypto }) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  for (const secret of metaWebhookSecretsToTry()) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    try {
      if (crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))) return true
    } catch {
      // digest length mismatch
    }
  }
  return false
}

// Meta sends deauthorize + data-deletion callbacks with a POST body
// `signed_request=PAYLOAD.SIGNATURE` where PAYLOAD is base64url JSON
// and SIGNATURE is HMAC-SHA256(PAYLOAD, app_secret).
// Returns the decoded payload object if valid, else null.
export function parseSignedRequest({ signedRequest, crypto }) {
  if (!signedRequest || typeof signedRequest !== 'string') return null
  const [encodedSig, encodedPayload] = signedRequest.split('.')
  if (!encodedSig || !encodedPayload) return null
  const base64UrlToBuffer = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  let payload
  try {
    payload = JSON.parse(base64UrlToBuffer(encodedPayload).toString('utf8'))
  } catch {
    return null
  }
  if (payload.algorithm !== 'HMAC-SHA256') return null
  let provided
  try {
    provided = base64UrlToBuffer(encodedSig)
  } catch {
    return null
  }
  for (const secret of metaWebhookSecretsToTry()) {
    const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest()
    if (provided.length !== expected.length) continue
    try {
      if (crypto.timingSafeEqual(provided, expected)) return payload
    } catch {
      continue
    }
  }
  return null
}
