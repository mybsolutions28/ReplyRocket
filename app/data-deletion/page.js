export const metadata = {
  title: 'Data Deletion Instructions — ReplyRocket',
  description: 'How to delete your data from ReplyRocket.',
}

const COMPANY = 'MyBSolutions Pvt Ltd'
const BRAND = 'ReplyRocket'
const PRIVACY_EMAIL = 'privacy@mybsolutions.in'

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <a href="/" className="text-violet-600 hover:underline text-sm">&larr; Back to ReplyRocket</a>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 mb-3">Data Deletion Instructions</h1>
        <p className="text-sm text-slate-500 mb-10">
          You have the right to delete your data at any time. Here is exactly how, and what happens.
        </p>

        <article className="text-slate-700 leading-relaxed space-y-6">

          <Section title="Option 1 — Disconnect Instagram only (keep your ReplyRocket account)">
            <p>If you only want to revoke {BRAND}&apos;s access to your Instagram account but keep using the rest of the product:</p>
            <Ol>
              <li>Log in to your ReplyRocket dashboard.</li>
              <li>Click <b>Settings</b> in the left sidebar.</li>
              <li>Find the <b>Instagram</b> card and click <b>Disconnect</b>.</li>
            </Ol>
            <p>The instant you click Disconnect, we permanently delete:</p>
            <Ul>
              <li>Your stored Instagram long-lived access token (so we can no longer reach Meta on your behalf).</li>
              <li>Your Instagram user ID, username, account type, and profile picture URL.</li>
            </Ul>
            <p>
              We retain conversation history and lead records associated with that workspace unless you also delete your account
              (Option 2), because that data may be needed for accounting, dispute resolution, or your own analytics.
            </p>
          </Section>

          <Section title="Option 2 — Delete your entire ReplyRocket account">
            <p>To erase everything we hold about you:</p>
            <Ol>
              <li>
                Email <a className="text-violet-600 hover:underline" href={`mailto:${PRIVACY_EMAIL}?subject=ReplyRocket%20account%20deletion`}>{PRIVACY_EMAIL}</a> from the email address on your ReplyRocket account.
              </li>
              <li>Subject: <code className="bg-slate-100 px-1 rounded">ReplyRocket account deletion</code></li>
              <li>Body: state that you are the account owner and request full deletion.</li>
            </Ol>
            <p>We will:</p>
            <Ul>
              <li>Verify your identity (we may ask you to confirm from the email registered on your account).</li>
              <li>Delete your user record, workspace, AI agent configuration, campaigns, leads, conversations, messages, and Instagram tokens within <b>7 calendar days</b> of verification.</li>
              <li>Purge backup copies within <b>30 calendar days</b>.</li>
              <li>Send you a written confirmation when deletion is complete.</li>
            </Ul>
          </Section>

          <Section title="Option 3 — Remove ReplyRocket from your Instagram authorized apps">
            <p>You can also revoke the connection from inside Instagram itself:</p>
            <Ol>
              <li>Open the Instagram mobile app.</li>
              <li>Profile → menu (☰) → <b>Settings and privacy</b>.</li>
              <li><b>Apps and websites</b> → <b>Active</b>.</li>
              <li>Find <b>ReplyRocket</b> → tap <b>Remove</b>.</li>
            </Ol>
            <p>
              When you do this, Meta calls our deauthorization webhook. Within <b>24 hours</b> we automatically delete the stored
              Instagram access token, profile metadata, and disable inbound webhook processing for your account. Equivalent to Option 1 but initiated from Instagram&apos;s side.
            </p>
          </Section>

          <Section title="What we do NOT keep after deletion">
            <Ul>
              <li>Personal contact data (email, business name, name).</li>
              <li>Stored Instagram access tokens or profile metadata.</li>
              <li>AI agent configuration (persona, services, pricing).</li>
              <li>Campaigns, leads, conversations, message history scoped to your workspace.</li>
              <li>Webhook event records associated with your workspace.</li>
            </Ul>
          </Section>

          <Section title="What we may keep (limited)">
            <Ul>
              <li>Anonymized, aggregated usage metrics that do not identify you.</li>
              <li>Financial records as required by Indian law (e.g. GST invoices, retained 8 years).</li>
              <li>Records reasonably necessary to defend against legal claims, retained only as long as required.</li>
            </Ul>
          </Section>

          <Section title="Contact">
            <p>
              For deletion requests, questions, or grievances under India&apos;s Digital Personal Data Protection Act:<br />
              <b>Email:</b> <a className="text-violet-600 hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a><br />
              <b>Data Fiduciary:</b> {COMPANY}, India
            </p>
            <p className="text-sm text-slate-500">If you are not satisfied with our response, you may approach the Data Protection Board of India.</p>
          </Section>
        </article>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
function Ul({ children }) { return <ul className="list-disc pl-6 space-y-1">{children}</ul> }
function Ol({ children }) { return <ol className="list-decimal pl-6 space-y-1">{children}</ol> }
