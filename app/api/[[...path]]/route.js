import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
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
  return jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: '7d' })
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

function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: TOKEN_TTL,
  })
  return response
}

function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
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
4. CLOSE — share booking link or generate a payment link when intent is clear.
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
    { "type": "share_payment_link", "amount": <number_in_inr>, "label": "<service name>" },
    { "type": "share_pricing" }
  ]
}

Use "share_payment_link" only when user has clearly agreed to buy a specific service. Return ONLY the JSON.`
}

function parseJSON(text) {
  try { return JSON.parse(text) } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (e) {} }
  return { reply: text, intent: 'other', lead_score: 'warm', lead_stage: 'interested', actions: [] }
}

// =====================================================================
// RAZORPAY
// =====================================================================
async function createRazorpayLink({ amount, label, conversationId, leadHandle }) {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('Razorpay not configured')
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const payload = {
    amount: Math.round(Number(amount) * 100),
    currency: 'INR',
    accept_partial: false,
    reference_id: `convo_${conversationId}`.slice(0, 40),
    description: (label || 'Payment').slice(0, 2048),
    customer: {
      name: (leadHandle || 'Customer').replace('@', '').slice(0, 50) || 'Customer',
      email: 'customer@example.com',
      contact: '+919876543210',
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
  }
  const resp = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await resp.text()
  if (!resp.ok) {
    console.error('Razorpay error:', resp.status, text)
    throw new Error(`Razorpay link creation failed: ${resp.status}`)
  }
  const data = JSON.parse(text)
  return { id: data.id, short_url: data.short_url, amount: amount, label }
}

function verifyRazorpayWebhook(rawBody, signature) {
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
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
    const db = await connectToMongo()

    // ============ PUBLIC ENDPOINTS ============
    if ((route === '/' || route === '/health') && method === 'GET') {
      return handleCORS(NextResponse.json({ ok: true, app: 'ReplyRocket', model: 'claude-sonnet-4-5' }))
    }

    // ---- AUTH ----
    if (route === '/auth/signup' && method === 'POST') {
      const b = await request.json()
      if (!b.email || !b.password) return handleCORS(NextResponse.json({ error: 'email_password_required' }, { status: 400 }))
      const existing = await db.collection('users').findOne({ email: b.email.toLowerCase() })
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
        created_at: new Date(),
      }
      await db.collection('users').insertOne(user)
      await seedWorkspaceData(db, wid, user.business_name)
      const token = signToken(uid)
      const res = NextResponse.json(publicUser(user))
      setAuthCookie(res, token)
      return handleCORS(res)
    }

    if (route === '/auth/login' && method === 'POST') {
      const b = await request.json()
      const u = await db.collection('users').findOne({ email: (b.email || '').toLowerCase() })
      if (!u) return handleCORS(NextResponse.json({ error: 'invalid_credentials' }, { status: 401 }))
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

    if (route === '/auth/me' && method === 'GET') {
      const u = await getUser(request, db)
      if (!u) return handleCORS(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))
      return handleCORS(NextResponse.json(publicUser(u)))
    }

    // ---- RAZORPAY WEBHOOK (PUBLIC, NO AUTH) ----
    if (route === '/webhooks/razorpay' && method === 'POST') {
      const rawBody = await request.text()
      const signature = request.headers.get('x-razorpay-signature')
      const eventId = request.headers.get('x-razorpay-event-id')
      if (!verifyRazorpayWebhook(rawBody, signature)) {
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
      if (payload.event === 'payment_link.paid') {
        const ent = payload.payload?.payment_link?.entity
        const refId = ent?.reference_id || ''
        const amountInr = (ent?.amount_paid || ent?.amount || 0) / 100
        if (refId.startsWith('convo_')) {
          const convoId = refId.slice('convo_'.length)
          const convo = await db.collection('conversations').findOne({ id: convoId })
          if (convo) {
            await db.collection('leads').updateOne(
              { id: convo.lead_id },
              { $set: { stage: 'converted', score: 'hot', updated_at: new Date() }, $inc: { revenue: amountInr } }
            )
            await db.collection('campaigns').updateOne(
              { id: convo.campaign_id },
              { $inc: { 'stats.conversions': 1 } }
            )
            // Add a system message into conversation for visibility
            await db.collection('messages').insertOne({
              id: uuidv4(),
              conversation_id: convoId,
              role: 'system',
              text: `💰 Payment received: ₹${amountInr} (via Razorpay).`,
              ts: new Date(),
              meta: { razorpay_payment_link_id: ent.id },
            })
            await db.collection('conversations').updateOne({ id: convoId }, { $set: { last_message: `💰 Payment of ₹${amountInr} received`, updated_at: new Date() } })
          }
        }
      }
      return handleCORS(NextResponse.json({ ok: true }))
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
      const { _id, ...rest } = a
      return handleCORS(NextResponse.json(rest))
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
        return handleCORS(NextResponse.json({ matched: false, message: `Keyword "${camp.keyword}" not detected.` }))
      }
      const leadId = uuidv4()
      const lead = {
        id: leadId, workspace_id: WS, handle, source: 'instagram_comment',
        campaign_id: camp.id, stage: 'new', score: 'warm', revenue: 0,
        created_at: new Date(), updated_at: new Date(),
      }
      await db.collection('leads').insertOne(lead)
      const convoId = uuidv4()
      const dmText = (camp.dm_template || '').replaceAll('{{handle}}', handle)
      await db.collection('conversations').insertOne({
        id: convoId, workspace_id: WS, lead_id: leadId, handle, campaign_id: camp.id,
        last_message: dmText, last_role: 'agent', unread: 1, created_at: new Date(), updated_at: new Date(),
      })
      await db.collection('messages').insertMany([
        { id: uuidv4(), conversation_id: convoId, role: 'comment', text: commentText, ts: new Date(), meta: { post_caption: camp.post_caption } },
        { id: uuidv4(), conversation_id: convoId, role: 'agent', text: dmText, ts: new Date(), meta: { is_initial_dm: true } },
      ])
      await db.collection('campaigns').updateOne({ id: camp.id }, { $inc: { 'stats.triggers': 1 } })
      return handleCORS(NextResponse.json({ matched: true, lead_id: leadId, conversation_id: convoId, dm_text: dmText }))
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

      // Process actions: payment links (REAL Razorpay)
      const enrichedActions = []
      for (const a of (parsed.actions || [])) {
        if (a.type === 'share_payment_link' && a.amount) {
          try {
            const link = await createRazorpayLink({
              amount: Number(a.amount),
              label: a.label || 'Service',
              conversationId: convoId,
              leadHandle: convo.handle,
            })
            enrichedActions.push({ ...a, link })
          } catch (e) {
            console.error('Razorpay link failed', e)
            enrichedActions.push({ ...a, link_error: 'Could not generate payment link' })
          }
        } else if (a.type === 'share_booking_link') {
          enrichedActions.push({ ...a, url: agent?.booking_link })
        } else {
          enrichedActions.push(a)
        }
      }

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
