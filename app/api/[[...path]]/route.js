import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

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

const WS = 'default'

// ---------- AI HELPERS ----------
async function callLLM({ system, messages, json = false, model = 'claude-sonnet-4-5', temperature = 0.7, max_tokens = 1500 }) {
  const url = `${process.env.EMERGENT_LLM_BASE_URL}/chat/completions`
  const body = {
    model,
    temperature,
    max_tokens,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
  }
  if (json) body.response_format = { type: 'json_object' }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.EMERGENT_LLM_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    console.error('LLM error', resp.status, text)
    throw new Error(`LLM call failed: ${resp.status}`)
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content || ''
}

function buildSalesAgentSystemPrompt(agent) {
  const a = agent || {}
  const name = a.business_name || 'Our Business'
  const persona = a.persona || `You are a friendly, persuasive AI sales rep for ${name}.`
  const tone = a.tone || 'warm, concise, conversational'
  const services = (a.services || []).map(s => `- ${s.name}${s.price ? ` (₹${s.price})` : ''}${s.description ? `: ${s.description}` : ''}`).join('\n') || '- (no services configured)'
  const faqs = (a.faqs || []).map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n') || '(no FAQs configured)'
  const booking = a.booking_link || ''
  const upi = a.upi_id || ''
  const language = a.language || 'English (auto-detect Hinglish/Hindi if user uses it)'

  return `You are "${name}'s" AI Auto-Closer — a top-tier social-media sales agent that turns Instagram DMs into revenue.

## YOUR PERSONA
${persona}
Tone: ${tone}
Language: ${language}. Match the user's language. If they write in Hinglish, reply in Hinglish.

## BUSINESS INFO
Business: ${name}

Services & Pricing:
${services}

FAQs:
${faqs}

Booking link: ${booking || '(not set)'}
UPI / Payment ID: ${upi || '(not set)'}

## YOUR JOB
1. Qualify the lead — ask 1 short, smart question if needed (budget/timeline/specific need).
2. Recommend the best service for their need.
3. Handle objections naturally.
4. CLOSE — share booking link or generate a payment link when intent is clear.
5. Keep replies SHORT (2-4 sentences max). Use 1-2 emojis max. Sound human.
6. Never invent prices, services, or facts not listed above. If unknown, say so honestly.

## OUTPUT FORMAT (STRICT JSON ONLY)
Return a JSON object:
{
  "reply": "<your DM message to the prospect>",
  "intent": "<pricing|booking|info|payment|objection|smalltalk|closing|other>",
  "lead_score": "<hot|warm|cold>",
  "lead_stage": "<new|interested|qualified|negotiation|converted|lost>",
  "actions": [ /* zero or more of: */
    { "type": "share_booking_link" },
    { "type": "share_payment_link", "amount": <number_in_inr>, "label": "<service name>" },
    { "type": "share_pricing" }
  ]
}

Use "share_payment_link" only when the user has clearly agreed to buy a specific service. Use "share_booking_link" when the user wants to schedule. Use "share_pricing" when sharing the menu.
Return ONLY the JSON. No markdown, no commentary outside JSON.`
}

function parseJSON(text) {
  try { return JSON.parse(text) } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch (e) {} }
  return { reply: text, intent: 'other', lead_score: 'warm', lead_stage: 'interested', actions: [] }
}

function generatePayLink(amount, label) {
  const id = uuidv4().slice(0, 8)
  return {
    id,
    url: `https://rzp.io/i/${id}`,
    amount,
    label: label || 'Payment',
  }
}

async function getAgent(db) {
  let a = await db.collection('agents').findOne({ workspace_id: WS })
  if (!a) {
    a = {
      id: uuidv4(),
      workspace_id: WS,
      business_name: 'Pawsome Pet Salon',
      persona: 'You are Riya — Pawsome Pet Salon\'s super-friendly AI booking assistant. You love dogs and you make every pet parent feel welcome.',
      tone: 'warm, playful, concise',
      language: 'English + Hinglish (auto-detect)',
      services: [
        { name: 'Basic Grooming', price: 799, description: 'Bath, blow-dry, brushing, ear cleaning. ~60 min.' },
        { name: 'Full Spa Package', price: 1499, description: 'Grooming + nail trim + de-shedding + paw massage. ~90 min.' },
        { name: 'Pet Photoshoot', price: 2499, description: '30-min studio shoot with 10 edited photos.' },
      ],
      faqs: [
        { q: 'Where are you located?', a: 'We are in HSR Layout, Bangalore. Free parking available.' },
        { q: 'Do you handle aggressive dogs?', a: 'Yes — we have certified handlers and a calming room.' },
        { q: 'Do you have weekend slots?', a: 'Yes! Saturdays and Sundays 9am-7pm.' },
      ],
      booking_link: 'https://cal.com/pawsome/book',
      upi_id: 'pawsome@upi',
      created_at: new Date(),
      updated_at: new Date(),
    }
    await db.collection('agents').insertOne(a)
  }
  delete a._id
  return a
}

async function ensureSeedCampaigns(db) {
  const count = await db.collection('campaigns').countDocuments({ workspace_id: WS })
  if (count > 0) return
  const seed = [
    {
      id: uuidv4(),
      workspace_id: WS,
      post_caption: 'Cutest grooming transformation of the week! 🐾✨ Comment PRICE to get our full menu in your DM 👇',
      post_image_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80',
      keyword: 'PRICE',
      dm_template: 'Hey {{handle}}! 🐾 Thanks for showing love on our reel! Here\'s the deal — what kind of pet do you have, and what service caught your eye? I\'ll share the perfect package for you 💜',
      enabled: true,
      stats: { triggers: 0, conversions: 0 },
      created_at: new Date(),
    },
    {
      id: uuidv4(),
      workspace_id: WS,
      post_caption: 'Pet photoshoot deal alert 📸 Comment SHOOT and we\'ll DM you the slots + pricing!',
      post_image_url: 'https://images.unsplash.com/photo-1546238232-20216dec9f72?w=800&q=80',
      keyword: 'SHOOT',
      dm_template: 'Hi {{handle}}! 📸 Thanks for the comment! Our pet photoshoot is ₹2499 with 10 edited photos. What pet are we shooting and which weekend works for you?',
      enabled: true,
      stats: { triggers: 0, conversions: 0 },
      created_at: new Date(),
    },
  ]
  await db.collection('campaigns').insertMany(seed)
}

async function logEvent(db, type, meta = {}) {
  await db.collection('events').insertOne({ id: uuidv4(), workspace_id: WS, type, meta, ts: new Date() })
}

// ---------- ROUTE HANDLER ----------
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()
    await ensureSeedCampaigns(db)

    // Health
    if ((route === '/' || route === '/health') && method === 'GET') {
      return handleCORS(NextResponse.json({ ok: true, app: 'ReplyRocket', model: 'claude-sonnet-4-5' }))
    }

    // ---- AGENT ----
    if (route === '/agent' && method === 'GET') {
      const a = await getAgent(db)
      return handleCORS(NextResponse.json(a))
    }
    if (route === '/agent' && (method === 'POST' || method === 'PUT')) {
      const body = await request.json()
      const update = {
        business_name: body.business_name,
        persona: body.persona,
        tone: body.tone,
        language: body.language,
        services: body.services || [],
        faqs: body.faqs || [],
        booking_link: body.booking_link,
        upi_id: body.upi_id,
        updated_at: new Date(),
      }
      await db.collection('agents').updateOne(
        { workspace_id: WS },
        { $set: update, $setOnInsert: { id: uuidv4(), workspace_id: WS, created_at: new Date() } },
        { upsert: true }
      )
      const a = await getAgent(db)
      return handleCORS(NextResponse.json(a))
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
        post_image_url: b.post_image_url || 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800&q=80',
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

    // ---- SIMULATE COMMENT (Instagram trigger) ----
    if (route === '/simulate-comment' && method === 'POST') {
      const b = await request.json()
      const camp = await db.collection('campaigns').findOne({ id: b.campaign_id, workspace_id: WS })
      if (!camp) return handleCORS(NextResponse.json({ error: 'campaign_not_found' }, { status: 404 }))

      const handle = (b.commenter_handle || '@guest_user').replace(/^@?/, '@')
      const commentText = b.comment_text || ''

      const matched = camp.keyword && commentText.toUpperCase().includes(camp.keyword)
      const result = { matched, campaign: { id: camp.id, post_caption: camp.post_caption, keyword: camp.keyword } }

      if (!matched) {
        return handleCORS(NextResponse.json({ ...result, message: `Keyword "${camp.keyword}" not detected in comment.` }))
      }

      // create lead
      const leadId = uuidv4()
      const lead = {
        id: leadId,
        workspace_id: WS,
        handle,
        source: 'instagram_comment',
        campaign_id: camp.id,
        stage: 'new',
        score: 'warm',
        revenue: 0,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('leads').insertOne(lead)

      // create conversation
      const convoId = uuidv4()
      const dmText = (camp.dm_template || '').replaceAll('{{handle}}', handle)
      const convo = {
        id: convoId,
        workspace_id: WS,
        lead_id: leadId,
        handle,
        campaign_id: camp.id,
        last_message: dmText,
        last_role: 'agent',
        unread: 1,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('conversations').insertOne(convo)

      // store original comment + initial DM
      await db.collection('messages').insertMany([
        { id: uuidv4(), conversation_id: convoId, role: 'comment', text: commentText, ts: new Date(), meta: { post_caption: camp.post_caption } },
        { id: uuidv4(), conversation_id: convoId, role: 'agent', text: dmText, ts: new Date(), meta: { is_initial_dm: true } },
      ])

      await db.collection('campaigns').updateOne({ id: camp.id }, { $inc: { 'stats.triggers': 1 } })
      await logEvent(db, 'comment_to_dm', { campaign_id: camp.id, lead_id: leadId, handle })

      return handleCORS(NextResponse.json({
        ...result,
        lead_id: leadId,
        conversation_id: convoId,
        dm_text: dmText,
      }))
    }

    // ---- CONVERSATIONS ----
    if (route === '/conversations' && method === 'GET') {
      const list = await db.collection('conversations').find({ workspace_id: WS }).sort({ updated_at: -1 }).toArray()
      const ids = list.map(c => c.lead_id)
      const leads = await db.collection('leads').find({ id: { $in: ids } }).toArray()
      const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))
      const out = list.map(({ _id, ...c }) => ({ ...c, lead: leadMap[c.lead_id] ? (() => { const { _id, ...r } = leadMap[c.lead_id]; return r })() : null }))
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

      // Append user (prospect) message
      const userMsg = { id: uuidv4(), conversation_id: convoId, role: 'user', text: b.text || '', ts: new Date() }
      await db.collection('messages').insertOne(userMsg)

      // Get history & agent profile
      const history = await db.collection('messages').find({ conversation_id: convoId }).sort({ ts: 1 }).toArray()
      const agent = await getAgent(db)

      // Build messages for LLM
      const llmMessages = history.filter(m => m.role !== 'comment').map(m => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.text,
      }))
      // Prepend the comment context as a system note inside user message if present
      const firstComment = history.find(m => m.role === 'comment')
      const contextNote = firstComment ? `\n[Context: this lead came from your Instagram post: "${firstComment.meta?.post_caption || ''}". Their original comment was: "${firstComment.text}".]` : ''
      const system = buildSalesAgentSystemPrompt(agent) + contextNote

      let aiText = ''
      let parsed = { reply: '', actions: [], intent: 'other', lead_score: 'warm', lead_stage: 'interested' }
      try {
        aiText = await callLLM({ system, messages: llmMessages, json: true, model: 'claude-sonnet-4-5' })
        parsed = parseJSON(aiText)
      } catch (e) {
        console.error('AI failed', e)
        parsed = { reply: 'Sorry, I had a hiccup — could you try again?', actions: [], lead_score: 'warm', lead_stage: 'interested', intent: 'other' }
      }

      // Process actions: payment links
      const enrichedActions = (parsed.actions || []).map(a => {
        if (a.type === 'share_payment_link') {
          const link = generatePayLink(a.amount, a.label)
          return { ...a, link }
        }
        if (a.type === 'share_booking_link') {
          return { ...a, url: agent.booking_link }
        }
        return a
      })

      const agentMsg = {
        id: uuidv4(),
        conversation_id: convoId,
        role: 'agent',
        text: parsed.reply || '...',
        ts: new Date(),
        meta: {
          intent: parsed.intent,
          lead_score: parsed.lead_score,
          actions: enrichedActions,
        },
      }
      await db.collection('messages').insertOne(agentMsg)

      // Update lead stage/score
      const leadUpdate = { score: parsed.lead_score || 'warm', updated_at: new Date() }
      if (parsed.lead_stage) leadUpdate.stage = parsed.lead_stage

      // If converted via payment, log revenue
      let revenueDelta = 0
      for (const a of enrichedActions) {
        if (a.type === 'share_payment_link' && a.amount) revenueDelta += Number(a.amount) || 0
      }
      if (parsed.lead_stage === 'converted' && revenueDelta > 0) {
        await db.collection('campaigns').updateOne({ id: convo.campaign_id }, { $inc: { 'stats.conversions': 1 } })
      }

      await db.collection('leads').updateOne(
        { id: convo.lead_id },
        {
          $set: leadUpdate,
          $inc: revenueDelta > 0 && parsed.lead_stage === 'converted' ? { revenue: revenueDelta } : {},
        }
      )

      await db.collection('conversations').updateOne(
        { id: convoId },
        { $set: { last_message: parsed.reply, last_role: 'agent', updated_at: new Date() } }
      )

      await logEvent(db, 'ai_reply', { conversation_id: convoId, intent: parsed.intent, score: parsed.lead_score })

      const { _id: _u, ...userMsgClean } = userMsg
      const { _id: _a, ...agentMsgClean } = agentMsg
      return handleCORS(NextResponse.json({
        user_message: userMsgClean,
        agent_message: agentMsgClean,
        ai_meta: { ...parsed, actions: enrichedActions },
      }))
    }

    // Mark as converted manually (e.g., user paid via the link)
    const convoConvertMatch = route.match(/^\/conversations\/([^/]+)\/convert$/)
    if (convoConvertMatch && method === 'POST') {
      const convoId = convoConvertMatch[1]
      const b = await request.json().catch(() => ({}))
      const amount = Number(b.amount) || 0
      const convo = await db.collection('conversations').findOne({ id: convoId, workspace_id: WS })
      if (!convo) return handleCORS(NextResponse.json({ error: 'not_found' }, { status: 404 }))
      await db.collection('leads').updateOne({ id: convo.lead_id }, { $set: { stage: 'converted', score: 'hot', updated_at: new Date() }, $inc: { revenue: amount } })
      await db.collection('campaigns').updateOne({ id: convo.campaign_id }, { $inc: { 'stats.conversions': 1 } })
      await logEvent(db, 'manual_convert', { conversation_id: convoId, amount })
      return handleCORS(NextResponse.json({ ok: true }))
    }

    // ---- LEADS ----
    if (route === '/leads' && method === 'GET') {
      const leads = await db.collection('leads').find({ workspace_id: WS }).sort({ updated_at: -1 }).toArray()
      return handleCORS(NextResponse.json(leads.map(({ _id, ...r }) => r)))
    }
    const leadStageMatch = route.match(/^\/leads\/([^/]+)$/)
    if (leadStageMatch && method === 'PATCH') {
      const b = await request.json()
      const update = { updated_at: new Date() }
      if (b.stage) update.stage = b.stage
      if (b.score) update.score = b.score
      await db.collection('leads').updateOne({ id: leadStageMatch[1], workspace_id: WS }, { $set: update })
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
      const top_campaigns = camps.map(c => ({ id: c.id, keyword: c.keyword, post_caption: c.post_caption, triggers: c.stats?.triggers || 0, conversions: c.stats?.conversions || 0 })).sort((a,b)=>b.triggers-a.triggers).slice(0,5)
      return handleCORS(NextResponse.json({
        total_conversations: convs,
        total_leads: leads.length,
        total_messages: msgs,
        total_campaigns: camps.length,
        comment_triggers: triggers,
        revenue,
        converted,
        conversion_rate,
        stages,
        top_campaigns,
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
