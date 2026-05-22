import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import {
  isInstagramConfigured,
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchUserProfile,
  verifyMetaWebhookSignature,
  parseSignedRequest,
  sendPrivateReplyToComment,
  enableInstagramWebhookSubscriptions,
} from '@/lib/instagram'
import { PLANS, getPlan, getRazorpayPlanId, DEFAULT_PLAN, SUBSCRIPTION_STATES } from '@/lib/plans'
import { createCommentTriggeredConversation } from '@/lib/campaign-trigger'
import { extractInstagramCommentChanges, metaWebhookCommentsExtractionHint } from '@/lib/meta-instagram-webhook'

let client
let db
let indexesEnsured = false

// Atlas: MONGODB_URI or MONGO_URL = mongodb+srv://.../sample_mflix?retryWrites=true&w=majority
// Do NOT use /admin in the URI. App always uses database "sample_mflix".
const ATLAS_DB_NAME = 'sample_mflix'
const USERS_COLLECTION = 'users'

// MONGO_URL only on Vercel/local — avoids MONGODB_URI=/admin overriding a correct MONGO_URL.
function getMongoUri() {
  return stripUriDatabase((process.env.MONGO_URL || '').trim())
}

// Remove /admin, /sample_mflix, etc. from the URI path. Database is always client.db(ATLAS_DB_NAME).
function stripUriDatabase(uri) {
  if (!uri) return ''
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^/?]+(?=\?|$)/i, '$1')
}

function maskMongoUri(uri) {
  return uri ? uri.replace(/:([^:@/]+)@/, ':***@') : '(not set)'
}

async function ensureIndexes(db) {
  if (indexesEnsured) return
  try {
    await Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('users').createIndex({ id: 1 }, { unique: true }),
      db.collection('agents').createIndex({ workspace_id: 1 }, { unique: true }),
      db.collection('campaigns').createIndex({ workspace_id: 1, created_at: -1 }),
      db.collection('campaigns').createIndex({ id: 1 }, { unique: true }),
      db.collection('conversations').createIndex({ workspace_id: 1, updated_at: -1 }),
      db.collection('conversations').createIndex({ id: 1 }, { unique: true }),
      db.collection('conversations').createIndex({ lead_id: 1 }),
      db.collection('conversations').createIndex({ campaign_id: 1 }),
      db.collection('messages').createIndex({ conversation_id: 1, ts: 1 }),
      db.collection('messages').createIndex({ id: 1 }, { unique: true }),
      db.collection('leads').createIndex({ workspace_id: 1, updated_at: -1 }),
      db.collection('leads').createIndex({ id: 1 }, { unique: true }),
      db.collection('instagram_accounts').createIndex({ workspace_id: 1 }, { unique: true }),
      db.collection('instagram_accounts').createIndex({ ig_user_id: 1 }),
      db.collection('webhook_events').createIndex({ id: 1 }, { unique: true }),
      db.collection('meta_webhook_events').createIndex({ id: 1 }, { unique: true }),
      db.collection('meta_webhook_events').createIndex({ received_at: -1 }),
      db.collection('ig_comment_dedup').createIndex({ comment_id: 1 }, { unique: true }),
      db.collection('password_resets').createIndex({ token: 1 }, { unique: true }),
      db.collection('password_resets').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ])
    indexesEnsured = true
  } catch (e) {
    console.warn('Index creation warning:', e.message)
  }
}

async function connectToMongo() {
  if (client && db) return db

  const uri = getMongoUri()
  if (!uri) {
    throw new Error(
      'MONGO_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    )
  }

  console.log('Mongo URI:', maskMongoUri(uri))
  console.log('DB name used:', ATLAS_DB_NAME)

  if (client) {
    try { await client.close() } catch (e) { /* stale partial connection */ }
    client = null
    db = null
  }

  const mongoClientOptions = {}
  // Local Windows: SRV DNS or TLS inspection often fails; set MONGO_TLS_INSECURE=1 in .env only.
  if (process.env.MONGO_TLS_INSECURE === '1') {
    mongoClientOptions.tlsAllowInvalidCertificates = true
  }

  const nextClient = new MongoClient(uri, mongoClientOptions)
  try {
    await nextClient.connect()
    const nextDb = nextClient.db(ATLAS_DB_NAME)
    console.log('Connected database:', nextDb.databaseName)
    await ensureIndexes(nextDb)
    client = nextClient
    db = nextDb
    return db
  } catch (e) {
    try { await nextClient.close() } catch (closeErr) { /* ignore */ }
    client = null
    db = null
    throw new Error(`MongoDB connection failed: ${e.message}`)
  }
}

// Resolve the public origin of this app for OAuth redirects.
// Priority: NEXT_PUBLIC_BASE_URL env -> X-Forwarded-* headers (ngrok/proxies) -> request origin.
function baseUrl(request) {
  // Priority: X-Forwarded-* headers (ngrok / Vercel / any reverse proxy) →
  // NEXT_PUBLIC_BASE_URL env → request URL. The forwarded headers must win
  // so OAuth redirects + webhook URLs auto-adapt when the user accesses the
  // app through ngrok in dev.
  const fwdHost = request.headers.get('x-forwarded-host')
  const fwdProto = request.headers.get('x-forwarded-proto')
  if (fwdHost) return `${fwdProto || 'https'}://${fwdHost}`
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const host = request.headers.get('host')
  if (host) return `http://${host}`
  try { return new URL(request.url).origin } catch { return '' }
}

// Reject requests with bodies larger than `limit` bytes (default 256KB).
// Webhooks from Meta/Razorpay are tiny; user JSON payloads are even smaller.
// This prevents a malicious client from POSTing 100MB and OOM-ing the function.
const MAX_BODY_BYTES = 256 * 1024
function tooLargeResponse() {
  return handleCORS(NextResponse.json({ error: 'payload_too_large' }, { status: 413 }))
}
function requestTooLarge(request) {
  const len = Number(request.headers.get('content-length') || 0)
  return len > MAX_BODY_BYTES
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// =====================================================================
// AUTH HELPERS
// =====================================================================
const COOKIE_NAME = 'rr_token'
const TOKEN_TTL = 7 * 24 * 60 * 60 // 7 days

function signToken(uid) {
  const secret = process.env.JWT_SECRET
  if (!secret || !String(secret).trim()) {
    throw new Error(
      'JWT_SECRET is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    )
  }
  return jwt.sign({ uid }, secret, { expiresIn: '7d' })
}

async function getUser(request, db) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const u = await db.collection('users').findOne({ id: decoded.uid })
    return u
  } catch (e) { return null }
}

function authCookieOptions() {
  // `secure: true` blocks cookie over http://localhost. Auto-enable only on
  // explicit HTTPS deployment (NEXT_PUBLIC_BASE_URL=https://...) or NODE_ENV=production.
  const isHttps = (process.env.NEXT_PUBLIC_BASE_URL || '').startsWith('https://')
  const secure = isHttps || process.env.NODE_ENV === 'production'
  const opts = {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: TOKEN_TTL,
  }
  // Share session between www.replyrocket.site and replyrocket.site (apex redirect).
  try {
    const host = new URL(process.env.NEXT_PUBLIC_BASE_URL || '').hostname
    if (host === 'replyrocket.site' || host === 'www.replyrocket.site') {
      opts.domain = '.replyrocket.site'
    }
  } catch (_) { /* ignore invalid NEXT_PUBLIC_BASE_URL */ }
  return opts
}

function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, authCookieOptions())
  return response
}

function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { ...authCookieOptions(), maxAge: 0 })
  return response
}

function publicUser(u) {
  if (!u) return null
  return { id: u.id, email: u.email, name: u.name, workspace_id: u.workspace_id, business_name: u.business_name }
}

async function seedWorkspaceData(db, workspace_id, business_name) {
  // Default agent
  const agent = {
    id: uuidv4(),
    workspace_id,
    business_name: business_name || 'My Business',
    persona: `You are a friendly AI sales assistant for ${business_name || 'this business'}. Be warm, helpful, and close deals naturally.`,
    tone: 'warm, concise, conversational',
    language: 'English (auto-detect Hinglish/Hindi if user uses it)',
    services: [
      { name: 'Sample Service', price: 999, description: 'Replace this with your real offering on the AI Agent page.' },
    ],
    faqs: [
      { q: 'Where are you located?', a: 'Update this answer on the AI Agent page.' },
    ],
    booking_link: 'https://cal.com/your-handle',
    upi_id: 'yourbiz@upi',
    created_at: new Date(),
    updated_at: new Date(),
  }
  await db.collection('agents').insertOne(agent)

  // Seed 2 demo campaigns
  await db.collection('campaigns').insertMany([
    {
      id: uuidv4(), workspace_id,
      post_caption: 'Comment PRICE to get our menu in your DM 👇',
      post_image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
      keyword: 'PRICE',
      dm_template: 'Hey {{handle}}! Thanks for the comment 💜 What are you looking for? I\'ll share the perfect option for you.',
      enabled: true,
      stats: { triggers: 0, conversions: 0 },
      created_at: new Date(),
    },
    {
      id: uuidv4(), workspace_id,
      post_caption: 'Comment INFO to learn more about our services 👇',
      post_image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
      keyword: 'INFO',
      dm_template: 'Hi {{handle}}! 🙌 So glad you reached out. What can I help you with today?',
      enabled: true,
      stats: { triggers: 0, conversions: 0 },
      created_at: new Date(),
    },
  ])
}

// =====================================================================
// LLM
// =====================================================================
async function callLLM({ system, messages, json = false, model = 'claude-sonnet-4-5', max_tokens = 1500 }) {
  const url = `${process.env.EMERGENT_LLM_BASE_URL}/chat/completions`
  const body = { model, temperature: 0.7, max_tokens, messages: [{ role: 'system', content: system }, ...messages] }
  if (json) body.response_format = { type: 'json_object' }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.EMERGENT_LLM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`LLM ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content || ''
}

function buildSalesAgentSystemPrompt(agent) {
  const a = agent || {}
  const name = a.business_name || 'Our Business'
  const services = (a.services || []).map(s => `- ${s.name}${s.price ? ` (₹${s.price})` : ''}${s.description ? `: ${s.description}` : ''}`).join('\n') || '- (no services configured)'
  const faqs = (a.faqs || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n') || '(no FAQs configured)'
  return `You are "${name}'s" AI Auto-Closer — a top-tier social-media sales agent that turns Instagram DMs into revenue.

## YOUR PERSONA
${a.persona || `You are a friendly, persuasive AI sales rep for ${name}.`}
Tone: ${a.tone || 'warm, concise, conversational'}
Language: ${a.language || 'English'}. Match the user's language. If they write Hinglish, reply in Hinglish.

## BUSINESS INFO
Business: ${name}

Services & Pricing:
${services}

FAQs:
${faqs}

Booking link: ${a.booking_link || '(not set)'}
UPI / Payment ID: ${a.upi_id || '(not set)'}

## YOUR JOB
1. Qualify the lead — ask 1 short, smart question if needed.
2. Recommend the best service for their need.
3. Handle objections naturally.
4. CLOSE — share booking link or UPI/payment ID when intent is clear (no in-app payment links).
5. Keep replies SHORT (2-4 sentences). 1-2 emojis max. Sound human.
6. Never invent prices, services, or facts not listed above.

## OUTPUT FORMAT (STRICT JSON ONLY)
Return JSON:
{
  "reply": "<DM message>",
  "intent": "<pricing|booking|info|payment|objection|smalltalk|closing|other>",
  "lead_score": "<hot|warm|cold>",
  "lead_stage": "<new|interested|qualified|negotiation|converted|lost>",
  "actions": [
    { "type": "share_booking_link" },
    { "type": "share_pricing" }
  ]
}

Return ONLY the JSON.`
}

function parseJSON(text) {
  try { return JSON.parse(text) } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (e) {} }
  return { reply: text, intent: 'other', lead_score: 'warm', lead_stage: 'interested', actions: [] }
}

// =====================================================================
// Instagram webhooks → campaign match → DM + Inbox records
// =====================================================================
async function processInstagramCommentWebhookEvent(db, evt) {
  const {
    igBusinessUserId,
    commentId,
    text,
    mediaId,
    commenterIgsid,
    commenterUsername,
  } = evt

  if (!commentId || text == null || !igBusinessUserId) return { skipped: 'invalid_event' }
  if (!commenterIgsid || commenterIgsid === igBusinessUserId) {
    return { skipped: 'no_recipient_or_self' }
  }

  const acct = await db.collection('instagram_accounts').findOne({
    $or: [{ ig_user_id: igBusinessUserId }, { ig_user_id: String(Number(igBusinessUserId)) }],
  })
  if (!acct?.access_token) {
    return { skipped: 'no_connected_account' }
  }

  const WS = acct.workspace_id
  const camps = await db
    .collection('campaigns')
    .find({ workspace_id: WS, enabled: { $ne: false } })
    .sort({ created_at: -1 })
    .toArray()

  const upper = String(text).toUpperCase()
  let camp = null
  for (const c of camps) {
    const kw = (c.keyword || '').toUpperCase().trim()
    if (!kw || !upper.includes(kw)) continue
    const mid = (c.instagram_media_id || '').trim()
    if (mid) {
      if (!mediaId || mid !== mediaId) continue
    }
    camp = c
    break
  }

  if (!camp) return { skipped: 'no_matching_campaign', workspace_id: WS }

  try {
    await db.collection('ig_comment_dedup').insertOne({ comment_id: commentId, received_at: new Date() })
  } catch (e) {
    if (e?.code === 11000) return { skipped: 'duplicate_comment' }
    throw e
  }

  const handle = commenterUsername
    ? `@${commenterUsername.replace(/^@/, '')}`
    : `@user_${commenterIgsid.slice(-8)}`

  const { convoId, dmText } = await createCommentTriggeredConversation(db, WS, camp, {
    commentText: String(text),
    handle,
    meta: {
      post_caption: camp.post_caption,
      instagram_media_id: mediaId,
      instagram_comment_id: commentId,
      webhook: true,
    },
  })

  try {
    await sendPrivateReplyToComment({
      accessToken: acct.access_token,
      commentId,
      text: dmText,
    })
    await db.collection('messages').updateMany(
      { conversation_id: convoId, role: 'agent', 'meta.is_initial_dm': true },
      { $set: { 'meta.ig_dm_sent': true } },
    )
    return { ok: true, conversation_id: convoId, campaign_id: camp.id }
  } catch (e) {
    console.error('Instagram sendPrivateReplyToComment failed:', e)
    await db.collection('messages').updateMany(
      { conversation_id: convoId, role: 'agent', 'meta.is_initial_dm': true },
      {
        $set: {
          'meta.ig_dm_sent': false,
          'meta.ig_dm_error': String(e?.message || e).slice(0, 600),
        },
      },
    )
    return { ok: true, conversation_id: convoId, dm_failed: String(e?.message || e).slice(0, 200) }
  }
}

// =====================================================================
// RAZORPAY - PLATFORM (SaaS subscription billing)
// =====================================================================
// Returns the platform's Razorpay credentials (NOT per-workspace).
// These are the keys YOU (the SaaS owner) use to collect subscription
// payments from customers buying ReplyRocket plans.
function getPlatformRazorpayCreds() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  return { keyId, keySecret, mode: String(keyId).startsWith('rzp_live_') ? 'live' : 'test' }
}

async function razorpayApi(path, { method = 'GET', body } = {}) {
  const creds = getPlatformRazorpayCreds()
  if (!creds) throw new Error('platform_razorpay_not_configured')
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64')
  const init = {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const resp = await fetch(`https://api.razorpay.com${path}`, init)
  const text = await resp.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  if (!resp.ok) {
    const err = new Error(`razorpay_${resp.status}`)
    err.status = resp.status
    err.payload = data
    throw err
  }
  return data
}

function verifyRazorpaySubscriptionWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch (e) { return false }
}

// =====================================================================
// MAIN ROUTER
// =====================================================================
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if (['POST', 'PUT', 'PATCH'].includes(method) && requestTooLarge(request)) {
      return tooLargeResponse()
    }
    const db = await connectToMongo()
    if (!db) {
      throw new Error('MongoDB is not connected. Check MONGODB_URI on Vercel, then redeploy.')
    }

    // ============ PUBLIC ENDPOINTS ============
    if ((route === '/' || route === '/health') && method === 'GET') {
      await db.command({ ping: 1 })
      return handleCORS(NextResponse.json({
        ok: true,
        app: 'ReplyRocket',
        model: 'claude-sonnet-4-5',
        mongo: true,
        db: ATLAS_DB_NAME,
      }))
    }

    // ---- AUTH ----
    if (route === '/auth/signup' && method === 'POST') {
      const b = await request.json()
      if (!b.email || !b.password) return handleCORS(NextResponse.json({ error: 'email_password_required' }, { status: 400 }))
      const existing = await db.collection(USERS_COLLECTION).findOne({ email: b.email.toLowerCase() })
      if (existing) return handleCORS(NextResponse.json({ error: 'email_taken' }, { status: 409 }))
      const uid = uuidv4()
      const wid = uuidv4()
      const hash = await bcrypt.hash(b.password, 10)
      const user = {
        id: uid,
        email: b.email.toLowerCase(),
        name: b.name || b.email.split('@')[0],
        password_hash: hash,
        workspace_id: wid,
        business_name: b.business_name || (b.name || 'My Business'),
        plan: DEFAULT_PLAN,
        subscription_status: 'active',
        created_at: new Date(),
      }
      await db.collection(USERS_COLLECTION).insertOne(user)
      await seedWorkspaceData(db, wid, user.business_name)
      const token = signToken(uid)
      const res = NextResponse.json(publicUser(user))
      setAuthCookie(res, token)
      return handleCORS(res)
    }

    if (route === '/auth/login' && method === 'POST') {
      const b = await request.json()
      // const users = db.collection("users"); await users.findOne({ email })
      const u = await db.collection(USERS_COLLECTION).findOne({ email: (b.email || '').toLowerCase() })
      if (!u) return handleCORS(NextResponse.json({ error: 'invalid_credentials' }, { status: 401 }))
      if (!u.password_hash) {
        return handleCORS(NextResponse.json({ error: 'invalid_credentials' }, { status: 401 }))
      }
      const ok = await bcrypt.compare(b.password || '', u.password_hash)
      if (!ok) return handleCORS(NextResponse.json({ error: 'invalid_credentials' }, { status: 401 }))
      const token = signToken(u.id)
      const res = NextResponse.json(publicUser(u))
      setAuthCookie(res, token)
      return handleCORS(res)
    }

    if (route === '/auth/logout' && method === 'POST') {
      const res = NextResponse.json({ ok: true })
      clearAuthCookie(res)
      return handleCORS(res)
    }

    // ---- FORGOT / RESET PASSWORD ----
    if (route === '/auth/forgot' && method === 'POST') {
      const b = await request.json().catch(() => ({}))
      const email = (b.email || '').toLowerCase().trim()
      // Always respond 200 (don't leak which emails exist)
      const generic = { ok: true, message: 'If an account exists with that email, a reset link has been sent.' }
      if (!email) return handleCORS(NextResponse.json(generic))
      const u = await db.collection('users').findOne({ email })
      if (!u) {
        console.log(`Forgot-password requested for unknown email ${email} - no-op.`)
        return handleCORS(NextResponse.json(generic))
      }
      const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await db.collection('password_resets').insertOne({
        token, user_id: u.id, email, created_at: new Date(), expires_at: expiresAt, used: false,
      })
      const resetUrl = `${baseUrl(request)}/reset?token=${token}`
      // EMAIL STUB - wire SMTP/Resend/SendGrid later.
      console.log('═══════════════════════════════════════════════════════════')
      console.log(`Password reset link for ${email}:`)
      console.log(resetUrl)
      console.log('Expires at:', expiresAt.toISOString())
      console.log('═══════════════════════════════════════════════════════════')
      return handleCORS(NextResponse.json(generic))
    }

    if (route === '/auth/reset' && method === 'POST') {
      const b = await request.json().catch(() => ({}))
      const token = b.token
      const newPassword = b.password
      if (!token || !newPassword || newPassword.length < 6) {
        return handleCORS(NextResponse.json({ error: 'invalid_input' }, { status: 400 }))
      }
      const rec = await db.collection('password_resets').findOne({ token })
      if (!rec || rec.used || new Date(rec.expires_at) < new Date()) {
        return handleCORS(NextResponse.json({ error: 'invalid_or_expired' }, { status: 400 }))
      }
      const hash = await bcrypt.hash(newPassword, 10)
      await db.collection('users').updateOne({ id: rec.user_id }, { $set: { password_hash: hash } })
      await db.collection('password_resets').updateOne({ token }, { $set: { used: true, used_at: new Date() } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route === '/auth/me' && method === 'GET') {
      const u = await getUser(request, db)
      if (!u) return handleCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
      return handleCORS(NextResponse.json(publicUser(u)))
    }

    // ---- INSTAGRAM OAUTH CALLBACK (PUBLIC) ----
    // Meta redirects back here after the user authorizes on instagram.com.
    if (route === '/auth/instagram/callback' && method === 'GET') {
      const url = new URL(request.url)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')
      const errorReason = url.searchParams.get('error_reason')
      const errorDescription = url.searchParams.get('error_description')

      const redirectWithStatus = (status) => NextResponse.redirect(`${baseUrl(request)}/?ig=${status}`)

      if (error) {
        console.warn('IG OAuth error:', error, errorReason, errorDescription)
        return redirectWithStatus(`error&reason=${encodeURIComponent(errorReason || error)}`)
      }
      if (!code || !state) return redirectWithStatus('error&reason=missing_code_or_state')
      if (!isInstagramConfigured()) return redirectWithStatus('error&reason=app_not_configured')

      let decoded
      try {
        decoded = jwt.verify(state, process.env.JWT_SECRET)
      } catch (e) {
        return redirectWithStatus('error&reason=bad_state')
      }
      const stateUser = await db.collection('users').findOne({ id: decoded.uid })
      if (!stateUser) return redirectWithStatus('error&reason=user_not_found')

      try {
        const redirectUri = `${baseUrl(request)}/api/auth/instagram/callback`
        const short = await exchangeCodeForShortLivedToken({ code, redirectUri })
        const long = await exchangeForLongLivedToken({ shortLivedToken: short.access_token })
        const profile = await fetchUserProfile({ accessToken: long.access_token })

        const expiresAt = new Date(Date.now() + (long.expires_in || 5184000) * 1000)
        await db.collection('instagram_accounts').updateOne(
          { workspace_id: stateUser.workspace_id },
          {
            $set: {
              workspace_id: stateUser.workspace_id,
              ig_user_id: String(profile.id || short.user_id),
              ig_username: profile.username || null,
              account_type: profile.account_type || null,
              profile_picture_url: profile.profile_picture_url || null,
              access_token: long.access_token,
              token_expires_at: expiresAt,
              updated_at: new Date(),
              permissions: short.permissions || null,
            },
            $setOnInsert: { id: uuidv4(), connected_at: new Date() },
          },
          { upsert: true }
        )
        try {
          await enableInstagramWebhookSubscriptions({ accessToken: long.access_token })
          console.log('IG webhook subscriptions enabled (comments)')
        } catch (subErr) {
          console.error('IG enableInstagramWebhookSubscriptions failed:', subErr)
        }
        return redirectWithStatus('connected')
      } catch (e) {
        console.error('IG OAuth callback failed:', e)
        return redirectWithStatus(`error&reason=${encodeURIComponent(String(e.message || e).slice(0, 80))}`)
      }
    }

    // ---- META: DEAUTHORIZE CALLBACK (PUBLIC) ----
    // Meta calls this when a user removes our app from their Instagram authorized-apps list.
    // We must drop their access token and connection record within 24 hrs.
    if (route === '/auth/instagram/deauthorize' && method === 'POST') {
      const form = await request.formData().catch(() => null)
      const signed = form?.get('signed_request')
      const payload = signed ? parseSignedRequest({ signedRequest: String(signed), crypto }) : null
      if (!payload?.user_id) {
        console.warn('Deauthorize callback: missing or invalid signed_request')
        return NextResponse.json({ ok: true })
      }
      const result = await db.collection('instagram_accounts').deleteMany({ ig_user_id: String(payload.user_id) })
      console.log(`Instagram deauthorize: removed ${result.deletedCount} account(s) for ig_user_id=${payload.user_id}`)
      return NextResponse.json({ ok: true, deleted: result.deletedCount })
    }

    // ---- META: DATA DELETION REQUEST (PUBLIC) ----
    // Meta calls this when a user requests their data be deleted. We must respond with
    // a confirmation code + status URL, and actually delete the data.
    if (route === '/auth/instagram/delete' && method === 'POST') {
      const form = await request.formData().catch(() => null)
      const signed = form?.get('signed_request')
      const payload = signed ? parseSignedRequest({ signedRequest: String(signed), crypto }) : null
      if (!payload?.user_id) {
        console.warn('Data deletion callback: missing or invalid signed_request')
        return NextResponse.json({ ok: false, error: 'invalid_signed_request' }, { status: 400 })
      }
      const confirmationCode = `del-${uuidv4()}`
      const igUserId = String(payload.user_id)
      // Find affected workspace(s) before deleting so we can mark conversations referencing this IG user.
      const accts = await db.collection('instagram_accounts').find({ ig_user_id: igUserId }).toArray()
      const workspaceIds = accts.map((a) => a.workspace_id)
      // Drop tokens / IG account record
      await db.collection('instagram_accounts').deleteMany({ ig_user_id: igUserId })
      // Drop Meta-side webhook events referencing this user (best-effort by payload search)
      await db.collection('meta_webhook_events').deleteMany({
        $or: [
          { 'payload.entry.changes.value.from.id': igUserId },
          { 'payload.entry.messaging.sender.id': igUserId },
        ],
      })
      // Log a deletion record so we can answer status queries later
      await db.collection('data_deletion_requests').insertOne({
        id: uuidv4(),
        confirmation_code: confirmationCode,
        ig_user_id: igUserId,
        affected_workspaces: workspaceIds,
        requested_at: new Date(),
        status: 'completed',
      })
      const statusUrl = `${baseUrl(request)}/data-deletion?code=${encodeURIComponent(confirmationCode)}`
      return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode })
    }

    // ---- META WEBHOOK (PUBLIC, NO AUTH) ----
    // GET = verification handshake. Meta sends ?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
    if (route === '/webhooks/meta' && method === 'GET') {
      const url = new URL(request.url)
      const mode = url.searchParams.get('hub.mode')
      const token = (url.searchParams.get('hub.verify_token') || '').trim()
      const challenge = url.searchParams.get('hub.challenge')
      const expected = (process.env.META_VERIFY_TOKEN || '').trim()
      if (mode === 'subscribe' && token && expected && token === expected) {
        return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      console.warn('Meta webhook GET verification failed', {
        mode,
        token_from_meta: token || '(missing)',
        env_token_set: !!expected,
        env_token_length: expected.length,
        token_matches: !!(token && expected && token === expected),
      })
      return new NextResponse('forbidden', { status: 403 })
    }
    // POST = real event from Meta. Verify HMAC signature, log, then route Instagram comments → campaigns + DM.
    if (route === '/webhooks/meta' && method === 'POST') {
      const rawBody = await request.text()
      const signature = request.headers.get('x-hub-signature-256')
      if (!verifyMetaWebhookSignature({ rawBody, signatureHeader: signature, crypto })) {
        console.warn('Meta webhook invalid signature')
        return new NextResponse('invalid_signature', { status: 401 })
      }
      let payload
      try {
        payload = JSON.parse(rawBody)
      } catch (e) {
        return new NextResponse('bad_json', { status: 400 })
      }
      await db.collection('meta_webhook_events').insertOne({
        id: uuidv4(),
        received_at: new Date(),
        payload,
      })

      /** @type {any[]} */
      const results = []
      const comments = extractInstagramCommentChanges(payload)
      if (comments.length === 0) {
        const ex = metaWebhookCommentsExtractionHint(payload, 0)
        console.warn('[meta webhook] Parsed 0 comment events', JSON.stringify(ex))
      }
      for (const evt of comments) {
        try {
          const r = await processInstagramCommentWebhookEvent(db, evt)
          results.push(r)
        } catch (err) {
          console.error('processInstagramCommentWebhookEvent', err)
          results.push({ error: String(err?.message || err).slice(0, 120) })
        }
      }

      const extractionHint =
        process.env.META_WEBHOOK_DEBUG === '1'
          ? metaWebhookCommentsExtractionHint(payload, comments.length)
          : undefined

      return NextResponse.json({
        ok: true,
        comment_events_seen: comments.length,
        results,
        ...(extractionHint ? { extraction_hint: extractionHint } : {}),
      })
    }

    // ---- RAZORPAY WEBHOOK (PUBLIC, NO AUTH) ----
    if (route === '/webhooks/razorpay' && method === 'POST') {
      const rawBody = await request.text()
      const signature = request.headers.get('x-razorpay-signature')
      const eventId = request.headers.get('x-razorpay-event-id')
      if (!verifyRazorpaySubscriptionWebhook(rawBody, signature)) {
        console.warn('Razorpay webhook invalid signature')
        return handleCORS(NextResponse.json({ error: 'invalid_signature' }, { status: 401 }))
      }
      // idempotency
      if (eventId) {
        const seen = await db.collection('webhook_events').findOne({ id: eventId })
        if (seen) return handleCORS(NextResponse.json({ ok: true, dedup: true }))
        await db.collection('webhook_events').insertOne({ id: eventId, received_at: new Date() })
      }
      let payload
      try { payload = JSON.parse(rawBody) } catch (e) { return handleCORS(NextResponse.json({ error: 'bad_json' }, { status: 400 })) }
      const event = payload.event

      // ---- SUBSCRIPTION EVENTS (SaaS billing) ----
      if (event && event.startsWith('subscription.')) {
        const sub = payload.payload?.subscription?.entity
        if (sub?.id) {
          const planFromNotes = sub.notes?.app_plan
          const userId = sub.notes?.user_id
          // Find user by subscription_id (set during checkout) or fallback to notes
          let userDoc = await db.collection('users').findOne({ subscription_id: sub.id })
          if (!userDoc && userId) userDoc = await db.collection('users').findOne({ id: userId })
          if (userDoc) {
            const set = {
              subscription_id: sub.id,
              subscription_status: SUBSCRIPTION_STATES[sub.status] || sub.status,
              updated_at: new Date(),
            }
            // Plan activates only when subscription is actually billing.
            if (['active', 'authenticated'].includes(sub.status) && planFromNotes) {
              set.plan = planFromNotes
              set.subscription_pending_plan = null
            }
            if (sub.current_end) set.current_period_end = new Date(sub.current_end * 1000)
            if (['cancelled', 'expired', 'completed'].includes(sub.status)) {
              set.plan = 'free'
              set.cancel_at_period_end = false
            }
            await db.collection('users').updateOne({ id: userDoc.id }, { $set: set })
            console.log(`[billing] ${event} -> user=${userDoc.email} plan=${set.plan || userDoc.plan} status=${set.subscription_status}`)
          } else {
            console.warn(`[billing] ${event} for unknown subscription ${sub.id}`)
          }
        }
        await db.collection('billing_events').insertOne({
          id: uuidv4(),
          event,
          subscription_id: sub?.id,
          status: sub?.status,
          received_at: new Date(),
          payload,
        })
        return handleCORS(NextResponse.json({ ok: true, handled: event }))
      }

      console.warn('[billing] Unhandled Razorpay webhook event:', event)
      return handleCORS(NextResponse.json({ ok: true, ignored: event || null }))
    }

    // ============ AUTHENTICATED ENDPOINTS ============
    const user = await getUser(request, db)
    if (!user) return handleCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
    const WS = user.workspace_id

    // ---- AGENT ----
    if (route === '/agent' && method === 'GET') {
      const a = await db.collection('agents').findOne({ workspace_id: WS })
      if (!a) return handleCORS(NextResponse.json({ error: 'no_agent' }, { status: 404 }))
      const { _id, ...rest } = a
      return handleCORS(NextResponse.json(rest))
    }
    if (route === '/agent' && (method === 'POST' || method === 'PUT')) {
      const b = await request.json()
      const update = {
        business_name: b.business_name,
        persona: b.persona,
        tone: b.tone,
        language: b.language,
        services: b.services || [],
        faqs: b.faqs || [],
        booking_link: b.booking_link,
        upi_id: b.upi_id,
        updated_at: new Date(),
      }
      await db.collection('agents').updateOne(
        { workspace_id: WS },
        { $set: update, $setOnInsert: { id: uuidv4(), workspace_id: WS, created_at: new Date() } },
        { upsert: true }
      )
      // also keep user.business_name in sync
      if (b.business_name) {
        await db.collection('users').updateOne({ id: user.id }, { $set: { business_name: b.business_name } })
      }
      const a = await db.collection('agents').findOne({ workspace_id: WS })
      if (!a) return handleCORS(NextResponse.json({ error: 'no_agent' }, { status: 404 }))
      const { _id, ...rest } = a
      return handleCORS(NextResponse.json(rest))
    }

    // =================================================================
    // BILLING - SaaS subscriptions (Razorpay Subscriptions API)
    // =================================================================
    // Returns the current user's plan, status, and (if active) period end.
    if (route === '/billing/status' && method === 'GET') {
      const u = await db.collection('users').findOne({ id: user.id })
      const planId = u?.plan || DEFAULT_PLAN
      const plan = getPlan(planId)

      // Compute current-month usage counts for the UsageBar in the sidebar.
      const startOfMonth = new Date()
      startOfMonth.setUTCDate(1)
      startOfMonth.setUTCHours(0, 0, 0, 0)
      let dmsUsed = 0
      let leadsUsed = 0
      try {
        const wsId = user.workspace_id
        dmsUsed = await db.collection('messages').countDocuments({
          workspace_id: wsId,
          direction: 'out',
          created_at: { $gte: startOfMonth.toISOString() },
        })
        leadsUsed = await db.collection('leads').countDocuments({ workspace_id: wsId })
      } catch (_) {}

      return handleCORS(NextResponse.json({
        plan: planId,
        plan_name: plan.name,
        price: plan.price,
        status: u?.subscription_status || (planId === 'free' ? 'active' : 'inactive'),
        subscription_id: u?.subscription_id || null,
        current_period_end: u?.current_period_end || null,
        cancel_at_period_end: !!u?.cancel_at_period_end,
        limits: {
          ...plan.limits,
          dms_per_month: plan.limits?.monthly_dms ?? 0,
          dms_used: dmsUsed,
          contacts: plan.limits?.monthly_dms ?? 0, // best-available proxy until contact-cap is modeled
          contacts_used: leadsUsed,
        },
        platform_configured: !!getPlatformRazorpayCreds(),
      }))
    }

    // Start a checkout - creates a Razorpay subscription, returns short_url for the
    // user's browser to redirect to. Razorpay handles the hosted checkout page.
    if (route === '/billing/checkout' && method === 'POST') {
      const b = await request.json().catch(() => ({}))
      const planId = b.plan
      if (!planId || !PLANS[planId]) {
        return handleCORS(NextResponse.json({ error: 'invalid_plan' }, { status: 400 }))
      }
      if (planId === 'free') {
        // Downgrade to free: cancel any active subscription, set plan back to free.
        const u = await db.collection('users').findOne({ id: user.id })
        if (u?.subscription_id) {
          try {
            await razorpayApi(`/v1/subscriptions/${u.subscription_id}/cancel`, {
              method: 'POST',
              body: { cancel_at_cycle_end: 1 },
            })
          } catch (e) {
            console.warn('Cancel-on-downgrade failed (continuing):', e.message)
          }
        }
        await db.collection('users').updateOne(
          { id: user.id },
          { $set: { plan: 'free', subscription_status: 'active', cancel_at_period_end: true, updated_at: new Date() } }
        )
        return handleCORS(NextResponse.json({ ok: true, plan: 'free', short_url: null }))
      }

      if (!getPlatformRazorpayCreds()) {
        return handleCORS(NextResponse.json({
          error: 'platform_not_configured',
          details: 'Platform owner needs to set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.',
        }, { status: 503 }))
      }
      const razorpayPlanId = getRazorpayPlanId(planId)
      if (!razorpayPlanId) {
        return handleCORS(NextResponse.json({
          error: 'plan_not_configured',
          details: `Platform owner needs to create a Plan in Razorpay dashboard and set the ${PLANS[planId].razorpay_plan_env} env var.`,
        }, { status: 503 }))
      }

      try {
        // total_count = 12 means subscription bills monthly for 12 months then auto-renews
        // (Razorpay requires a finite cycle count; pick a long horizon).
        const subscription = await razorpayApi('/v1/subscriptions', {
          method: 'POST',
          body: {
            plan_id: razorpayPlanId,
            customer_notify: 1,
            quantity: 1,
            total_count: 120, // 10 years monthly
            notes: {
              user_id: user.id,
              workspace_id: user.workspace_id,
              app_plan: planId,
              email: user.email,
            },
          },
        })
        // Record the pending subscription so the webhook can match it to this user
        // even before the user is redirected back.
        await db.collection('users').updateOne(
          { id: user.id },
          {
            $set: {
              subscription_id: subscription.id,
              subscription_pending_plan: planId,
              subscription_status: SUBSCRIPTION_STATES[subscription.status] || 'pending',
              updated_at: new Date(),
            },
          }
        )
        return handleCORS(NextResponse.json({
          subscription_id: subscription.id,
          short_url: subscription.short_url,
          status: subscription.status,
        }))
      } catch (e) {
        console.error('Subscription create failed:', e.message, e.payload)
        const reason = e.payload?.error?.description || e.message
        return handleCORS(NextResponse.json({
          error: 'subscription_create_failed',
          details: reason,
        }, { status: 502 }))
      }
    }

    // Cancel the user's subscription. Default: cancel at period end (no refund, no immediate downgrade).
    if (route === '/billing/cancel' && method === 'POST') {
      const u = await db.collection('users').findOne({ id: user.id })
      if (!u?.subscription_id) {
        return handleCORS(NextResponse.json({ error: 'no_active_subscription' }, { status: 400 }))
      }
      try {
        const result = await razorpayApi(`/v1/subscriptions/${u.subscription_id}/cancel`, {
          method: 'POST',
          body: { cancel_at_cycle_end: 1 },
        })
        await db.collection('users').updateOne(
          { id: user.id },
          { $set: { cancel_at_period_end: true, subscription_status: 'active', updated_at: new Date() } }
        )
        return handleCORS(NextResponse.json({
          ok: true,
          status: result.status,
          ends_at: result.current_end ? new Date(result.current_end * 1000) : null,
        }))
      } catch (e) {
        console.error('Cancel failed:', e.message, e.payload)
        return handleCORS(NextResponse.json({
          error: 'cancel_failed',
          details: e.payload?.error?.description || e.message,
        }, { status: 502 }))
      }
    }

    // ---- CAMPAIGNS ----
    if (route === '/campaigns' && method === 'GET') {
      const list = await db.collection('campaigns').find({ workspace_id: WS }).sort({ created_at: -1 }).toArray()
      return handleCORS(NextResponse.json(list.map(({ _id, ...r }) => r)))
    }
    if (route === '/campaigns' && method === 'POST') {
      const b = await request.json()
      const c = {
        id: uuidv4(),
        workspace_id: WS,
        post_caption: b.post_caption || '',
        post_image_url: b.post_image_url || 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
        keyword: (b.keyword || '').toUpperCase().trim(),
        instagram_media_id: typeof b.instagram_media_id === 'string' && b.instagram_media_id.trim()
          ? b.instagram_media_id.trim()
          : null,
        dm_template: b.dm_template || 'Hey {{handle}}! Thanks for the comment 💜 What can I help you with?',
        enabled: b.enabled !== false,
        stats: { triggers: 0, conversions: 0 },
        created_at: new Date(),
      }
      await db.collection('campaigns').insertOne(c)
      const { _id, ...rest } = c
      return handleCORS(NextResponse.json(rest))
    }
    const campMatch = route.match(/^\/campaigns\/([^/]+)$/)
    if (campMatch && method === 'DELETE') {
      await db.collection('campaigns').deleteOne({ id: campMatch[1], workspace_id: WS })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---- SIMULATE COMMENT ----
    if (route === '/simulate-comment' && method === 'POST') {
      const b = await request.json()
      const camp = await db.collection('campaigns').findOne({ id: b.campaign_id, workspace_id: WS })
      if (!camp) return handleCORS(NextResponse.json({ error: 'campaign_not_found' }, { status: 404 }))
      const handle = (b.commenter_handle || '@guest').replace(/^@?/, '@')
      const commentText = b.comment_text || ''
      const matched = camp.keyword && commentText.toUpperCase().includes(camp.keyword)
      if (!matched) {
        return handleCORS(
          NextResponse.json({ matched: false, message: `Keyword "${camp.keyword}" not detected.` }),
        )
      }
      const { leadId, convoId, dmText } = await createCommentTriggeredConversation(db, WS, camp, {
        commentText,
        handle,
        meta: { post_caption: camp.post_caption, simulator: true },
      })
      return handleCORS(
        NextResponse.json({ matched: true, lead_id: leadId, conversation_id: convoId, dm_text: dmText }),
      )
    }

    // ---- CONVERSATIONS ----
    if (route === '/conversations' && method === 'GET') {
      const list = await db.collection('conversations').find({ workspace_id: WS }).sort({ updated_at: -1 }).toArray()
      const ids = list.map(c => c.lead_id)
      const leads = await db.collection('leads').find({ id: { $in: ids } }).toArray()
      const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))
      const out = list.map(({ _id, ...c }) => ({
        ...c,
        lead: leadMap[c.lead_id] ? (() => { const { _id, ...r } = leadMap[c.lead_id]; return r })() : null,
      }))
      return handleCORS(NextResponse.json(out))
    }
    const convoMsgsMatch = route.match(/^\/conversations\/([^/]+)\/messages$/)
    if (convoMsgsMatch && method === 'GET') {
      const convoId = convoMsgsMatch[1]
      const convo = await db.collection('conversations').findOne({ id: convoId, workspace_id: WS })
      if (!convo) return handleCORS(NextResponse.json({ error: 'not_found' }, { status: 404 }))
      const messages = await db.collection('messages').find({ conversation_id: convoId }).sort({ ts: 1 }).toArray()
      const lead = await db.collection('leads').findOne({ id: convo.lead_id })
      await db.collection('conversations').updateOne({ id: convoId }, { $set: { unread: 0 } })
      return handleCORS(NextResponse.json({
        conversation: (() => { const { _id, ...r } = convo; return r })(),
        lead: lead ? (() => { const { _id, ...r } = lead; return r })() : null,
        messages: messages.map(({ _id, ...m }) => m),
      }))
    }
    const convoReplyMatch = route.match(/^\/conversations\/([^/]+)\/reply$/)
    if (convoReplyMatch && method === 'POST') {
      const convoId = convoReplyMatch[1]
      const b = await request.json()
      const convo = await db.collection('conversations').findOne({ id: convoId, workspace_id: WS })
      if (!convo) return handleCORS(NextResponse.json({ error: 'not_found' }, { status: 404 }))

      const userMsg = { id: uuidv4(), conversation_id: convoId, role: 'user', text: b.text || '', ts: new Date() }
      await db.collection('messages').insertOne(userMsg)

      const history = await db.collection('messages').find({ conversation_id: convoId }).sort({ ts: 1 }).toArray()
      const agent = await db.collection('agents').findOne({ workspace_id: WS })

      const llmMessages = history.filter(m => m.role !== 'comment' && m.role !== 'system').map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text,
      }))
      const firstComment = history.find(m => m.role === 'comment')
      const contextNote = firstComment ? `\n[Context: lead came from your post "${firstComment.meta?.post_caption || ''}". Original comment: "${firstComment.text}".]` : ''
      const system = buildSalesAgentSystemPrompt(agent) + contextNote

      let parsed = { reply: 'Sorry, I had a hiccup — could you try again?', actions: [], lead_score: 'warm', lead_stage: 'interested', intent: 'other' }
      try {
        const aiText = await callLLM({ system, messages: llmMessages, json: true })
        parsed = parseJSON(aiText)
      } catch (e) { console.error('AI failed', e) }

      const enrichedActions = (parsed.actions || []).map((a) => {
        if (a.type === 'share_booking_link') return { ...a, url: agent?.booking_link }
        return a
      })

      const agentMsg = {
        id: uuidv4(),
        conversation_id: convoId,
        role: 'agent',
        text: parsed.reply || '...',
        ts: new Date(),
        meta: { intent: parsed.intent, lead_score: parsed.lead_score, actions: enrichedActions },
      }
      await db.collection('messages').insertOne(agentMsg)

      const leadUpdate = { score: parsed.lead_score || 'warm', updated_at: new Date() }
      if (parsed.lead_stage && parsed.lead_stage !== 'converted') leadUpdate.stage = parsed.lead_stage
      // Don't auto-convert from AI — only via real webhook payment
      await db.collection('leads').updateOne({ id: convo.lead_id }, { $set: leadUpdate })

      await db.collection('conversations').updateOne(
        { id: convoId },
        { $set: { last_message: parsed.reply, last_role: 'agent', updated_at: new Date() } }
      )

      const { _id: _u, ...userMsgClean } = userMsg
      const { _id: _a, ...agentMsgClean } = agentMsg
      return handleCORS(NextResponse.json({
        user_message: userMsgClean,
        agent_message: agentMsgClean,
        ai_meta: { ...parsed, actions: enrichedActions },
      }))
    }

    // Manual convert (for testing or when paid out-of-band)
    const convoConvertMatch = route.match(/^\/conversations\/([^/]+)\/convert$/)
    if (convoConvertMatch && method === 'POST') {
      const convoId = convoConvertMatch[1]
      const b = await request.json().catch(() => ({}))
      const amount = Number(b.amount) || 0
      const convo = await db.collection('conversations').findOne({ id: convoId, workspace_id: WS })
      if (!convo) return handleCORS(NextResponse.json({ error: 'not_found' }, { status: 404 }))
      await db.collection('leads').updateOne({ id: convo.lead_id }, { $set: { stage: 'converted', score: 'hot', updated_at: new Date() }, $inc: { revenue: amount } })
      await db.collection('campaigns').updateOne({ id: convo.campaign_id }, { $inc: { 'stats.conversions': 1 } })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---- LEADS ----
    if (route === '/leads' && method === 'GET') {
      const leads = await db.collection('leads').find({ workspace_id: WS }).sort({ updated_at: -1 }).toArray()
      return handleCORS(NextResponse.json(leads.map(({ _id, ...r }) => r)))
    }
    const leadMatch = route.match(/^\/leads\/([^/]+)$/)
    if (leadMatch && method === 'PATCH') {
      const b = await request.json()
      const update = { updated_at: new Date() }
      if (b.stage) update.stage = b.stage
      if (b.score) update.score = b.score
      await db.collection('leads').updateOne({ id: leadMatch[1], workspace_id: WS }, { $set: update })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---- ANALYTICS ----
    if (route === '/analytics' && method === 'GET') {
      const [convs, leads, msgs, camps] = await Promise.all([
        db.collection('conversations').countDocuments({ workspace_id: WS }),
        db.collection('leads').find({ workspace_id: WS }).toArray(),
        db.collection('messages').countDocuments({}),
        db.collection('campaigns').find({ workspace_id: WS }).toArray(),
      ])
      const stages = leads.reduce((acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc }, {})
      const revenue = leads.reduce((s, l) => s + (l.revenue || 0), 0)
      const converted = leads.filter(l => l.stage === 'converted').length
      const conversion_rate = leads.length ? Math.round((converted / leads.length) * 100) : 0
      const triggers = camps.reduce((s, c) => s + (c.stats?.triggers || 0), 0)
      const top_campaigns = camps.map(c => ({ id: c.id, keyword: c.keyword, post_caption: c.post_caption, triggers: c.stats?.triggers || 0, conversions: c.stats?.conversions || 0 })).sort((a, b) => b.triggers - a.triggers).slice(0, 5)
      return handleCORS(NextResponse.json({
        total_conversations: convs, total_leads: leads.length, total_messages: msgs, total_campaigns: camps.length,
        comment_triggers: triggers, revenue, converted, conversion_rate, stages, top_campaigns,
      }))
    }

    // ---- INSTAGRAM CONNECT / STATUS / DISCONNECT ----
    if (route === '/instagram/status' && method === 'GET') {
      const acct = await db.collection('instagram_accounts').findOne({ workspace_id: WS })
      return handleCORS(NextResponse.json({
        configured: isInstagramConfigured(),
        connected: !!acct,
        ig_username: acct?.ig_username || null,
        ig_user_id: acct?.ig_user_id || null,
        account_type: acct?.account_type || null,
        profile_picture_url: acct?.profile_picture_url || null,
        connected_at: acct?.connected_at || null,
        token_expires_at: acct?.token_expires_at || null,
      }))
    }

    // Kick off OAuth: redirect the browser to instagram.com authorize page.
    if (route === '/instagram/connect' && method === 'GET') {
      if (!isInstagramConfigured()) {
        return handleCORS(NextResponse.json({ error: 'ig_not_configured', detail: 'Set META_INSTAGRAM_APP_ID + META_INSTAGRAM_APP_SECRET (Instagram API setup page), or META_APP_ID + META_APP_SECRET, in .env — then restart.' }, { status: 400 }))
      }
      const redirectUri = `${baseUrl(request)}/api/auth/instagram/callback`
      const state = jwt.sign({ uid: user.id, n: uuidv4() }, process.env.JWT_SECRET, { expiresIn: '10m' })
      const url = buildAuthorizeUrl({ redirectUri, state })
      return NextResponse.redirect(url)
    }

    if (route === '/instagram/disconnect' && method === 'POST') {
      await db.collection('instagram_accounts').deleteOne({ workspace_id: WS })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    if (route === '/instagram/enable-webhooks' && method === 'POST') {
      const acct = await db.collection('instagram_accounts').findOne({ workspace_id: WS })
      if (!acct?.access_token) {
        return handleCORS(NextResponse.json({ error: 'not_connected' }, { status: 400 }))
      }
      try {
        const r = await enableInstagramWebhookSubscriptions({ accessToken: acct.access_token })
        return handleCORS(NextResponse.json({ ok: true, result: r }))
      } catch (e) {
        console.error('enable-webhooks:', e)
        return handleCORS(NextResponse.json({
          error: 'subscribe_failed',
          detail: String(e?.message || e).slice(0, 500),
        }, { status: 502 }))
      }
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: 'Internal server error', detail: String(error?.message || error) }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
