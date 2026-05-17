// Shared: comment matched a campaign → create lead + conversation + initial messages (+ stats).
import { v4 as uuidv4 } from 'uuid'

/**
 * @param {import('mongodb').Db} db
 * @param {string} workspaceId
 * @param {object} campaign - doc from Mongo campaigns
 * @param {{ commentText: string, handle: string, meta?: object }} opts
 */
export async function createCommentTriggeredConversation(db, workspaceId, campaign, opts) {
  const { commentText, handle } = opts
  const meta = opts.meta || {}
  const leadId = uuidv4()
  const h = handle.startsWith('@') ? handle : `@${handle}`
  const lead = {
    id: leadId,
    workspace_id: workspaceId,
    handle: h,
    source: 'instagram_comment',
    campaign_id: campaign.id,
    stage: 'new',
    score: 'warm',
    revenue: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }
  await db.collection('leads').insertOne(lead)
  const convoId = uuidv4()
  const dmText = (campaign.dm_template || '').replaceAll('{{handle}}', h)
  await db.collection('conversations').insertOne({
    id: convoId,
    workspace_id: workspaceId,
    lead_id: leadId,
    handle: h,
    campaign_id: campaign.id,
    last_message: dmText,
    last_role: 'agent',
    unread: 1,
    created_at: new Date(),
    updated_at: new Date(),
  })
  await db.collection('messages').insertMany([
    {
      id: uuidv4(),
      conversation_id: convoId,
      role: 'comment',
      text: commentText,
      ts: new Date(),
      meta: { post_caption: campaign.post_caption, ...meta },
    },
    {
      id: uuidv4(),
      conversation_id: convoId,
      role: 'agent',
      text: dmText,
      ts: new Date(),
      meta: { is_initial_dm: true },
    },
  ])
  await db.collection('campaigns').updateOne({ id: campaign.id }, { $inc: { 'stats.triggers': 1 } })
  return { leadId, convoId, dmText }
}
