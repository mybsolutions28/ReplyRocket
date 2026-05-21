#!/usr/bin/env node
/**
 * Prints webhook / OAuth URLs to register in Meta and Razorpay.
 *
 * Usage:
 *   node scripts/print-deploy-urls.js https://replyrocket.site
 *   npm run deploy:urls -- https://replyrocket.site
 */

const PRODUCTION_ORIGIN = 'https://replyrocket.site'
const baseInput = process.argv[2] || process.env.NEXT_PUBLIC_BASE_URL || PRODUCTION_ORIGIN

if (!baseInput || String(baseInput).includes('REPLACE_WITH_YOUR_DOMAIN')) {
  console.error(
    [
      'Missing public URL.',
      '',
      `  node scripts/print-deploy-urls.js ${PRODUCTION_ORIGIN}`,
      `  npm run deploy:urls -- ${PRODUCTION_ORIGIN}`,
      '',
      'Use the same origin as NEXT_PUBLIC_BASE_URL (HTTPS in production).',
    ].join('\n'),
  )
  process.exit(1)
}

const origin = String(baseInput).replace(/\/$/, '')

const rows = [
  ['Meta webhook (subscribe + events)', `${origin}/api/webhooks/meta`],
  ['Razorpay webhook (subscription billing)', `${origin}/api/webhooks/razorpay`],
  ['Instagram OAuth redirect', `${origin}/api/auth/instagram/callback`],
  ['Instagram deauthorize callback', `${origin}/api/auth/instagram/deauthorize`],
  ['Instagram data deletion callback', `${origin}/api/auth/instagram/delete`],
  ['Data deletion status page (linked from Meta)', `${origin}/data-deletion`],
]

console.log('\nRegister these URLs in the Meta Developer Portal and Razorpay Dashboard:\n')
for (const [label, url] of rows) {
  console.log(`${label}\n  ${url}\n`)
}
