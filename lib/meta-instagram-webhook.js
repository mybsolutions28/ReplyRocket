/**
 * Normalize Instagram webhook JSON from Meta → list of comment events.
 * Supports object: "instagram" with changes[].field === "comments" (and live_comments).
 */
export function extractInstagramCommentChanges(payload) {
  const out = []
  if (!payload || typeof payload !== 'object') return out

  /** @type {any[]} */
  let entries = []
  if (payload.object === 'instagram' && Array.isArray(payload.entry)) {
    entries = payload.entry
  }
  // Some legacy/Page-aliased payloads (best-effort)
  if (!entries.length && payload.object === 'page' && Array.isArray(payload.entry)) {
    entries = payload.entry
  }
  // Meta sometimes ships entry[] without a top-level object tag (fallback)
  if (!entries.length && Array.isArray(payload.entry)) {
    entries = payload.entry
  }

  for (const entry of entries) {
    const igBizUserId = entry?.id != null ? String(entry.id) : null
    if (!igBizUserId) continue
    for (const change of entry.changes || []) {
      const field = change?.field
      if (field !== 'comments' && field !== 'live_comments') continue
      const val = change?.value
      if (!val || typeof val.text !== 'string') continue
      const mediaId = val.media?.id != null ? String(val.media.id) : null
      const fromId = val.from?.id != null ? String(val.from.id) : ''
      const username = typeof val.from?.username === 'string' ? val.from.username : ''
      const commentId = val.id != null ? String(val.id) : ''
      const parentId = val.parent_id != null ? String(val.parent_id) : null
      if (!commentId) continue

      out.push({
        igBusinessUserId: igBizUserId,
        commentId,
        text: val.text,
        mediaId,
        commenterIgsid: fromId,
        commenterUsername: username,
        parentCommentId: parentId,
        rawField: field,
      })
    }
  }

  return out
}

/**
 * Why did we extract 0 comments? Helps debug payloads that differ from Expectations.
 * Does not contain tokens or signatures.
 * @returns {{ object?: string, entry_len: number, hint: string, changes_fields_sample: string[] }}
 */
export function metaWebhookCommentsExtractionHint(payload, extractedLen) {
  const object = typeof payload?.object === 'string' ? payload.object : '(missing)'
  const entry = Array.isArray(payload?.entry) ? payload.entry : []
  const fields = []
  for (const ent of entry) {
    for (const ch of ent?.changes || []) {
      if (typeof ch?.field === 'string') fields.push(ch.field)
    }
  }

  if (extractedLen > 0) {
    return {
      object,
      entry_len: entry.length,
      hint: `${extractedLen} comment event(s) parsed`,
      changes_fields_sample: [...new Set(fields)].slice(0, 15),
    }
  }

  let hint =
    'No comment-shaped events extracted. Requires entry[].changes[] with field comments|live_comments, value.text string, value.id.'
  if (!entry.length) {
    hint = 'payload.entry missing or empty — Meta may not have sent a comment webhook (often needs Live mode + Advanced access on comments field).'
  } else if (fields.length && !fields.some((f) => f === 'comments' || f === 'live_comments')) {
    hint = `entry has changes fields [${fields.join(', ')}] but no comments/live_comments — check Webhooks subscription.`
  } else if (fields.some((f) => f === 'comments' || f === 'live_comments')) {
    hint =
      'comments field present but value.text or value.id missing — event may not be a full comment notification.'
  }
  if (object === '(missing)') {
    hint += ' Top-level payload.object absent; still tried entry[].'
  }

  return {
    object,
    entry_len: entry.length,
    hint,
    changes_fields_sample: [...new Set(fields)].slice(0, 15),
  }
}