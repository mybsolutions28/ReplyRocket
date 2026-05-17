'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Rocket, Check, Sparkles, Crown, Building2, Zap, Loader2, ArrowRight } from 'lucide-react'
import { PLANS, PLAN_ORDER, formatINR } from '@/lib/plans'

function api(path, opts = {}) {
  return fetch(`/api${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  }).then(async r => {
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const err = new Error(j.error || 'request failed')
      err.status = r.status
      err.payload = j
      throw err
    }
    return j
  })
}

const PLAN_ICONS = {
  free: Sparkles,
  pro: Zap,
  growth: Crown,
  agency: Building2,
}
const PLAN_GRADIENTS = {
  free: 'from-slate-500 to-slate-700',
  pro: 'from-violet-600 to-fuchsia-500',
  growth: 'from-fuchsia-500 to-pink-500',
  agency: 'from-amber-500 to-rose-500',
}

export default function PricingPage() {
  const [me, setMe] = useState(undefined) // undefined=loading, null=anon, obj=authed
  const [billing, setBilling] = useState(null)
  const [busyPlan, setBusyPlan] = useState(null)

  useEffect(() => {
    api('/auth/me').then(setMe).catch(() => setMe(null))
  }, [])
  useEffect(() => {
    if (me) api('/billing/status').then(setBilling).catch(() => setBilling({ plan: 'free', status: 'inactive' }))
  }, [me])

  const subscribe = async (planId) => {
    if (!me) {
      // Anonymous → push them to sign up first, remember intent.
      localStorage.setItem('rr_pending_plan', planId)
      window.location.href = '/?from=pricing&plan=' + encodeURIComponent(planId)
      return
    }
    if (planId === 'free') {
      toast.message('You are already on the Free plan.')
      return
    }
    setBusyPlan(planId)
    try {
      const r = await api('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: planId }) })
      if (r.short_url) {
        window.location.href = r.short_url
      } else {
        toast.error('Could not start checkout. Try again.')
      }
    } catch (e) {
      if (e.payload?.error === 'plan_not_configured') {
        toast.error('This plan is not yet configured on the platform. Try another plan or contact support.')
      } else {
        toast.error(e.message || 'Checkout failed.')
      }
    } finally {
      setBusyPlan(null)
    }
  }

  const currentPlan = billing?.plan || 'free'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30">
      {/* Header */}
      <header className="border-b border-violet-100 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">ReplyRocket</div>
              <div className="text-[10px] text-slate-500 font-medium">AI REVENUE ENGINE</div>
            </div>
          </a>
          <div className="flex items-center gap-2 text-sm">
            {me === undefined ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : me ? (
              <a href="/" className="text-violet-600 font-semibold hover:underline">Go to dashboard →</a>
            ) : (
              <>
                <a href="/" className="text-slate-600 hover:text-slate-900 px-3 py-1.5">Login</a>
                <a href="/" className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white px-4 py-1.5 rounded-lg font-medium hover:opacity-90">Sign up free</a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
        <Badge className="mb-4 bg-violet-100 text-violet-700 hover:bg-violet-100 border-0 px-3 py-1">India&apos;s AI Revenue Engine</Badge>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-3">
          Simple pricing. <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">Real revenue.</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Turn every comment, DM, and reel into revenue. Start free, upgrade when you outgrow it.
        </p>
        <div className="mt-4 text-xs text-slate-500">
          ₹ INR pricing · Cancel anytime · No hidden fees
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {PLAN_ORDER.map(planId => {
            const plan = PLANS[planId]
            const Icon = PLAN_ICONS[planId]
            const gradient = PLAN_GRADIENTS[planId]
            const isCurrent = me && currentPlan === planId
            const isPaid = plan.price > 0
            return (
              <Card key={planId} className={`relative border-2 overflow-hidden flex flex-col ${plan.popular ? 'border-violet-400 shadow-xl shadow-violet-100 lg:scale-105' : 'border-violet-100'} ${isCurrent ? 'ring-2 ring-emerald-400' : ''}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-bl-lg">Most Popular</div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-br-lg">Current Plan</div>
                )}
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mb-4">{plan.tagline}</p>
                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <div className="text-3xl font-extrabold text-slate-900">Free</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <div className="text-3xl font-extrabold text-slate-900">{formatINR(plan.price)}</div>
                        <div className="text-sm text-slate-500">/mo</div>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => subscribe(planId)}
                    disabled={busyPlan === planId || isCurrent}
                    className={`w-full ${plan.popular ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white' : isCurrent ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                  >
                    {busyPlan === planId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCurrent ? (
                      'Your current plan'
                    ) : isPaid ? (
                      <>Subscribe <ArrowRight className="w-4 h-4 ml-1" /></>
                    ) : me ? (
                      'Downgrade to Free'
                    ) : (
                      'Start free'
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer info */}
        <div className="mt-10 text-center text-xs text-slate-500">
          <p className="mb-2">All plans are billed monthly via Razorpay. Cancel anytime — no questions, no penalty.</p>
          <p>Need a custom enterprise plan with 1M+ DMs/month, dedicated infra, or SSO? <a href="mailto:sales@mybsolutions.in" className="text-violet-600 hover:underline">Contact sales →</a></p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Frequently asked questions</h2>
        <div className="space-y-3">
          <FAQ q="Can I switch plans later?" a="Yes, upgrade or downgrade anytime. Upgrades take effect immediately and are prorated. Downgrades take effect at the end of your current billing cycle." />
          <FAQ q="Do you charge in INR or USD?" a="All plans are priced and billed in Indian Rupees (₹). GST is collected as applicable for Indian customers." />
          <FAQ q="Is there a free trial?" a="The Free plan gives you 100 DMs/month forever — no credit card required. You can try ReplyRocket without paying anything." />
          <FAQ q="What happens if I exceed my plan's DM limit?" a="We'll notify you when you hit 80% of your monthly limit. Once you exceed it, automations pause until you upgrade or the next billing cycle starts. Your data is never deleted." />
          <FAQ q="How does cancellation work?" a="Cancel from Settings → Billing with one click. You'll keep access until the end of your paid period. No refunds, but no penalty either." />
          <FAQ q="Is my Instagram safe?" a="Yes. We use Meta's official Graph API with your explicit OAuth consent. We never store your Instagram password and only access permissions you grant. Disconnect anytime from Settings." />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-violet-100 bg-white/40 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center"><Rocket className="w-3 h-3 text-white" /></div>
            <span>© 2026 ReplyRocket · MyBSolutions Pvt Ltd</span>
          </div>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-violet-600">Privacy</a>
            <a href="/terms" className="hover:text-violet-600">Terms</a>
            <a href="/data-deletion" className="hover:text-violet-600">Data Deletion</a>
            <a href="/pricing" className="hover:text-violet-600">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-violet-100 bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3 text-left">
        <span className="font-semibold text-slate-900 text-sm">{q}</span>
        <span className={`text-violet-500 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 text-sm text-slate-600 leading-relaxed">{a}</div>}
    </div>
  )
}
