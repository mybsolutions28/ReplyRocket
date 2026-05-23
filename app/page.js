'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Rocket, Inbox, Users, BarChart3, Bot, Megaphone, Sparkles, Send, Plus, Trash2,
  CalendarDays, IndianRupee, MessageCircle, Heart, Hash, CheckCircle2, Flame, Snowflake, Zap, Instagram, Loader2, ArrowRight, LogOut, Settings, ExternalLink, Menu, X, Crown, Lock, Check
} from 'lucide-react'
import { PLANS, formatINR } from '@/lib/plans'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'agent', label: 'AI Agent', icon: Bot },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'simulator', label: 'IG Simulator', icon: Instagram },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'leads', label: 'Leads (CRM)', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const STAGES = ['new', 'interested', 'qualified', 'negotiation', 'converted', 'lost']
const STAGE_COLORS = {
  new: 'bg-slate-100 text-slate-700',
  interested: 'bg-blue-100 text-blue-700',
  qualified: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
}

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
      throw err
    }
    return j
  })
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot' | 'forgot_sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) })
        setMode('forgot_sent')
      } else {
        const path = mode === 'signup' ? '/auth/signup' : '/auth/login'
        const body = mode === 'signup'
          ? { email, password, name, business_name: businessName }
          : { email, password }
        const u = await api(path, { method: 'POST', body: JSON.stringify(body) })
        toast.success(mode === 'signup' ? 'Welcome to ReplyRocket! 🚀' : 'Welcome back!')
        onAuthed(u)
      }
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(false) }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Forgot your password?' : mode === 'forgot_sent' ? 'Check your email' : 'Welcome back'
  const subtitle = mode === 'signup' ? 'Spin up your AI sales agent in 30 seconds.'
    : mode === 'forgot' ? "Type the email on your account. We'll send a reset link."
    : mode === 'forgot_sent' ? 'If an account exists with that email, a reset link has been sent. The link expires in 1 hour.'
    : 'Log in to your dashboard.'

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl text-slate-900">ReplyRocket</div>
              <div className="text-xs text-slate-500 -mt-0.5">AI Revenue Engine</div>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{title}</h1>
          <p className="text-slate-500 text-sm mb-6">{subtitle}</p>

          {mode === 'forgot_sent' ? (
            <Button onClick={() => setMode('login')} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">Back to log in</Button>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <Field label="Your name"><Input value={name} onChange={e => setName(e.target.value)} required /></Field>
                  <Field label="Business name"><Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Pawsome Pet Salon" required /></Field>
                </>
              )}
              <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></Field>
              {mode !== 'forgot' && (
                <Field label="Password"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></Field>
              )}
              {mode === 'login' && (
                <div className="text-right">
                  <button type="button" onClick={() => setMode('forgot')} className="text-xs text-violet-600 hover:underline">Forgot password?</button>
                </div>
              )}
              <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg">
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Log in'}
              </Button>
            </form>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-4 text-center text-sm text-slate-500">
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-violet-600 font-semibold hover:underline">
                {mode === 'signup' ? 'Log in' : 'Sign up'}
              </button>
            </div>
          )}
          {mode === 'forgot' && (
            <div className="mt-4 text-center text-sm text-slate-500">
              Remember it? <button onClick={() => setMode('login')} className="text-violet-600 font-semibold hover:underline">Back to log in</button>
            </div>
          )}

          <div className="mt-6 text-center text-[10px] text-slate-400 space-x-3">
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/data-deletion" className="hover:underline">Data deletion</a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState('dashboard')
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [user, setUser] = useState(undefined) // undefined=loading, null=anon, obj=authed
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [igStatus, setIgStatus] = useState(null)
  const [billing, setBilling] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const reloadIG = () => api('/instagram/status').then(setIgStatus).catch(() => setIgStatus({ configured: false, connected: false }))
  const reloadBilling = () => api('/billing/status').then(setBilling).catch(() => setBilling({ plan: 'free', status: 'inactive' }))

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null))
  }, [])

  // Load IG status + billing once we know there's a user
  useEffect(() => {
    if (!user) return
    reloadIG()
    reloadBilling()
  }, [user?.id])

  // Show the upgrade popup once per browser session for free-plan users
  useEffect(() => {
    if (!user || !billing) return
    if (billing.plan === 'free' && typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('rr_upgrade_modal_dismissed')
      if (!dismissed) {
        const t = setTimeout(() => setShowUpgradeModal(true), 400)
        return () => clearTimeout(t)
      }
    }
  }, [user?.id, billing?.plan])

  const dismissUpgradeModal = () => {
    setShowUpgradeModal(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rr_upgrade_modal_dismissed', '1')
    }
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    setIgStatus(null)
    setBilling(null)
    if (typeof window !== 'undefined') sessionStorage.removeItem('rr_upgrade_modal_dismissed')
    toast.message('Logged out')
  }

  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-fuchsia-50"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
  }
  if (user === null) {
    return <AuthScreen onAuthed={setUser} />
  }

  const switchToInbox = (convoId) => {
    setActiveConvoId(convoId)
    setTab('inbox')
  }

  const goToTab = (id) => {
    setTab(id)
    setMobileMenuOpen(false)
  }

  const igConnected = !!igStatus?.connected
  const startIGConnect = () => {
    if (igStatus && !igStatus.configured) {
      toast.error('Set META_APP_ID and META_APP_SECRET in .env, then restart the dev server.')
      return
    }
    window.location.href = '/api/instagram/connect'
  }
  const isFreePlan = (billing?.plan || 'free') === 'free'

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-violet-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight">ReplyRocket</div>
            <div className="text-[10px] text-slate-500 font-medium">AI REVENUE ENGINE</div>
          </div>
        </div>
        <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1.5 rounded-md hover:bg-slate-100" aria-label="Close menu">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* IG status card — LinkPlease style */}
      <div className="px-3 pt-3">
        <button
          onClick={igConnected ? () => goToTab('settings') : startIGConnect}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-violet-100 bg-white hover:bg-violet-50 transition text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(user.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-800 text-sm truncate">{user.name}</div>
            {igConnected ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-emerald-700 font-medium truncate">@{igStatus.ig_username || 'connected'}</span>
              </div>
            ) : (
              <span className="inline-block mt-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                IG not connected
              </span>
            )}
          </div>
        </button>
      </div>
      <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
        {NAV.map(n => {
          const Icon = n.icon
          const active = tab === n.id
          return (
            <button
              key={n.id}
              onClick={() => goToTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-200'
                  : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {n.label}
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-violet-100 space-y-2.5">
        {/* Connect Instagram quick action (LinkPlease pattern) */}
        {!igConnected && (
          <button
            onClick={startIGConnect}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 hover:from-pink-100 hover:to-purple-100 transition group"
          >
            <Instagram className="w-4 h-4 text-pink-600" />
            <span className="text-sm font-semibold text-slate-800 flex-1 text-left">Connect Instagram</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-600 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* Usage indicators */}
        {billing && (
          <div className="px-1 space-y-2">
            <UsageBar label="DMs / month" used={billing.limits?.dms_used ?? 0} total={billing.limits?.dms_per_month ?? 0} />
            <UsageBar label="Contacts" used={billing.limits?.contacts_used ?? 0} total={billing.limits?.contacts ?? 0} />
          </div>
        )}

        {/* Upgrade to Pro (free plan only) */}
        {isFreePlan ? (
          <a href="/pricing" className="block">
            <div className="rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 text-white p-3.5 shadow-lg shadow-orange-200 hover:shadow-orange-300 transition cursor-pointer">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <Crown className="w-4 h-4" /> Upgrade to Pro
              </div>
              <p className="text-[11px] text-white/90 mt-0.5">Unlimited DMs, AI, automation</p>
            </div>
          </a>
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white p-3.5 shadow-lg shadow-violet-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-0.5">
              <Crown className="w-3.5 h-3.5" /> {(billing?.plan || 'pro').toUpperCase()} plan active
            </div>
            <p className="text-[11px] text-violet-100">Powered by Claude 4.5</p>
          </div>
        )}

        <button onClick={logout} className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 py-1.5">
          <LogOut className="w-3 h-3" /> Log out
        </button>
      </div>
    </>
  )

  const activeNav = NAV.find(n => n.id === tab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white/95 backdrop-blur border-b border-violet-100 px-3 py-2.5">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-md hover:bg-slate-100" aria-label="Open menu">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center"><Rocket className="w-3.5 h-3.5 text-white" /></div>
          <div className="text-sm font-bold text-slate-900">{activeNav?.label || 'ReplyRocket'}</div>
        </div>
        <div className="w-9" />{/* spacer for symmetry */}
      </header>

      <div className="flex min-h-screen md:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 border-r border-violet-100 bg-white/70 backdrop-blur sticky top-0 h-screen flex-col">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
              {sidebarContent}
            </aside>
          </>
        )}

        <main className="flex-1 overflow-x-hidden min-w-0">
          {tab === 'dashboard' && <Dashboard go={setTab} igStatus={igStatus} billing={billing} onConnectIG={startIGConnect} />}
          {tab === 'agent' && <AgentPage />}
          {tab === 'campaigns' && <CampaignsPage />}
          {tab === 'simulator' && <SimulatorPage onTriggered={switchToInbox} />}
          {tab === 'inbox' && <InboxPage activeId={activeConvoId} setActiveId={setActiveConvoId} />}
          {tab === 'leads' && <LeadsPage />}
          {tab === 'settings' && <SettingsPage user={user} />}
        </main>
      </div>

      {showUpgradeModal && (
        <UpgradeModal billing={billing} onClose={dismissUpgradeModal} />
      )}
    </div>
  )
}

function UsageBar({ label, used = 0, total = 0 }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const display = total > 0 ? `${used}/${total}` : 'Unlimited'
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{display}</span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: total > 0 ? `${pct}%` : '100%' }}
        />
      </div>
    </div>
  )
}

function UpgradeModal({ billing, onClose }) {
  const plans = [
    { id: 'pro', name: PLANS.pro.name, price: formatINR(PLANS.pro.price), tagline: 'For solo creators', features: ['10,000 DMs/month', 'AI auto-replies', '5 campaigns', 'Priority support'], highlight: false },
    { id: 'growth', name: PLANS.growth.name, price: formatINR(PLANS.growth.price), tagline: 'For growing brands', features: ['50,000 DMs/month', 'AI + custom personas', 'Unlimited campaigns', 'Phone support'], highlight: true },
    { id: 'agency', name: PLANS.agency.name, price: formatINR(PLANS.agency.price), tagline: 'For agencies & teams', features: ['Unlimited DMs', 'Multi-workspace', 'White-label', 'Dedicated CSM'], highlight: false },
  ]
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="relative p-6 sm:p-8 bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 text-white rounded-t-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition" aria-label="Close">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold mb-3">
            <Crown className="w-3.5 h-3.5" /> You're on the FREE plan
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-1">Unlock the full ReplyRocket</h2>
          <p className="text-white/90 text-sm sm:text-base">Upgrade now to unlock unlimited DMs, AI personas, and revenue automation 24/7.</p>
        </div>

        <div className="p-4 sm:p-6 grid sm:grid-cols-3 gap-3 sm:gap-4">
          {plans.map(p => (
            <div key={p.id} className={`relative rounded-xl border-2 p-4 sm:p-5 ${p.highlight ? 'border-violet-500 shadow-lg shadow-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50' : 'border-slate-200 bg-white'}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-[10px] font-bold tracking-wide">
                  MOST POPULAR
                </div>
              )}
              <div className="text-sm font-semibold text-slate-700">{p.name}</div>
              <div className="text-xs text-slate-500 mb-3">{p.tagline}</div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">{p.price}</span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <a href="/pricing" className="block">
                <Button className={`w-full ${p.highlight ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}>
                  Choose {p.name}
                </Button>
              </a>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-6 pt-0 flex items-center justify-center">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 underline">
            Maybe later — continue on Free
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ go, igStatus, billing, onConnectIG }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { api('/analytics').then(setStats).catch(() => {}) }, [])

  const igConnected = !!igStatus?.connected
  const isFree = (billing?.plan || 'free') === 'free'

  // If IG isn't connected, render the LinkPlease-style gate instead of metrics
  if (igStatus && !igConnected) {
    return (
      <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        {isFree && <UpgradeBanner />}
        <ConnectInstagramGate onConnect={onConnectIG} configured={!!igStatus?.configured} />
      </div>
    )
  }

  const cards = [
    { label: 'Total Leads', value: stats?.total_leads ?? '—', icon: Users, tint: 'from-violet-500 to-fuchsia-500' },
    { label: 'Conversations', value: stats?.total_conversations ?? '—', icon: MessageCircle, tint: 'from-blue-500 to-violet-500' },
    { label: 'Conversion Rate', value: `${stats?.conversion_rate ?? 0}%`, icon: Zap, tint: 'from-amber-500 to-pink-500' },
    { label: 'Revenue (₹)', value: stats?.revenue ?? 0, icon: IndianRupee, tint: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
      {isFree && <div className="mb-4 sm:mb-6"><UpgradeBanner /></div>}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 p-8 text-white shadow-2xl shadow-violet-200 mb-8 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 mb-4 backdrop-blur">
            <Sparkles className="w-3 h-3 mr-1" /> AI Auto-Closer is LIVE
          </Badge>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Turn every comment into revenue</h1>
          <p className="text-violet-100 mb-6 max-w-xl">ReplyRocket detects keywords on your reels, fires personalized DMs, and your AI sales agent qualifies + closes deals 24/7.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => go('simulator')} className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-xl">
              <Instagram className="w-4 h-4 mr-2" /> Try the IG Simulator
            </Button>
            <Button onClick={() => go('agent')} variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white">
              <Bot className="w-4 h-4 mr-2" /> Train Your AI
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="border-violet-100 hover:shadow-lg transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{c.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{c.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.tint} flex items-center justify-center shadow`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-violet-100">
          <CardHeader>
            <CardTitle className="text-lg">Lead Pipeline</CardTitle>
            <CardDescription>Your AI's qualification funnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGES.map(s => {
              const count = stats?.stages?.[s] || 0
              const total = stats?.total_leads || 1
              const pct = Math.min(100, Math.round((count / total) * 100))
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize font-medium text-slate-700">{s}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
        <Card className="border-violet-100">
          <CardHeader>
            <CardTitle className="text-lg">Top Campaigns</CardTitle>
            <CardDescription>Comment triggers with most action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.top_campaigns || []).length === 0 && (
              <p className="text-sm text-slate-500">No data yet. Run the IG Simulator to fire your first comment-to-DM.</p>
            )}
            {(stats?.top_campaigns || []).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-violet-50/50 border border-violet-100">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">
                    <Hash className="w-3 h-3 mr-0.5" />{c.keyword}
                  </Badge>
                  <span className="text-sm text-slate-700 truncate">{c.post_caption}</span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-shrink-0">
                  <span className="text-slate-500">🎯 {c.triggers}</span>
                  <span className="text-emerald-600 font-medium">✅ {c.conversions}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UpgradeBanner() {
  return (
    <a href="/pricing" className="block">
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 p-4 sm:p-5 shadow-lg shadow-violet-200 hover:shadow-xl transition flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white text-base sm:text-lg leading-tight">Unlock Pro Power!</div>
            <div className="text-xs sm:text-sm text-white/90 mt-0.5">Get unlimited automations, contacts & advanced analytics.</div>
          </div>
        </div>
        <Button className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-md w-full sm:w-auto flex-shrink-0">
          Upgrade to Pro <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    </a>
  )
}

function ConnectInstagramGate({ onConnect, configured }) {
  return (
    <Card className="border-violet-100 bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="grid md:grid-cols-2">
          <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide w-fit mb-4">
              <Lock className="w-3 h-3" /> Action Required
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">
              Connect Instagram to unlock your dashboard
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
              Connect your Instagram Business account once to activate live metrics, the AI auto-closer, comment-to-DM automations, and lead tracking. Until then, the dashboard stays locked.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                'AI replies to every comment & DM 24/7',
                'Real-time leads, conversions & revenue',
                'Multiple campaigns per post — no limits',
                'Booking links & UPI in DMs',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            {configured ? (
              <Button
                onClick={onConnect}
                size="lg"
                className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white shadow-xl hover:shadow-2xl font-semibold w-full sm:w-auto"
              >
                <Instagram className="w-5 h-5 mr-2" /> Connect Instagram
              </Button>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>Meta app not configured.</strong> An admin needs to set <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, and <code>META_VERIFY_TOKEN</code> in the server <code>.env</code>, then restart. See the Settings page for live status.
              </div>
            )}
            <div className="mt-4 text-[11px] text-slate-500">
              We use the official Meta Instagram Graph API. We never see your password and you can disconnect any time.
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-violet-100 via-fuchsia-100 to-pink-100 p-8 hidden md:flex items-center justify-center">
            <div className="absolute inset-0 bg-grid-slate-200/40 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
            <div className="relative w-44 h-44 rounded-3xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600 shadow-2xl shadow-fuchsia-300 flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-300">
              <Instagram className="w-24 h-24 text-white drop-shadow-lg" />
            </div>
            <div className="absolute top-10 right-10 w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center -rotate-12">
              <MessageCircle className="w-7 h-7 text-violet-600" />
            </div>
            <div className="absolute bottom-12 left-10 w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center rotate-12">
              <Bot className="w-7 h-7 text-fuchsia-600" />
            </div>
            <div className="absolute bottom-8 right-12 w-12 h-12 rounded-xl bg-white shadow-xl flex items-center justify-center -rotate-6">
              <IndianRupee className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AgentPage() {
  const [agent, setAgent] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { api('/agent').then(setAgent).catch(() => {}) }, [])

  if (!agent) return <Loading />

  const update = (k, v) => setAgent({ ...agent, [k]: v })
  const updateService = (i, k, v) => {
    const services = [...(agent.services || [])]
    services[i] = { ...services[i], [k]: v }
    setAgent({ ...agent, services })
  }
  const addService = () => setAgent({ ...agent, services: [...(agent.services || []), { name: '', price: '', description: '' }] })
  const removeService = (i) => setAgent({ ...agent, services: agent.services.filter((_, j) => j !== i) })
  const updateFAQ = (i, k, v) => {
    const faqs = [...(agent.faqs || [])]
    faqs[i] = { ...faqs[i], [k]: v }
    setAgent({ ...agent, faqs })
  }
  const addFAQ = () => setAgent({ ...agent, faqs: [...(agent.faqs || []), { q: '', a: '' }] })
  const removeFAQ = (i) => setAgent({ ...agent, faqs: agent.faqs.filter((_, j) => j !== i) })

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api('/agent', { method: 'POST', body: JSON.stringify(agent) })
      setAgent(updated)
      toast.success('AI Agent saved & re-trained ✨')
    } catch (e) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
      <PageHeader icon={Bot} title="AI Sales Agent" subtitle="Train your AI Auto-Closer with your business info — pricing, FAQs, booking link." />
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-violet-100">
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Business Name">
              <Input value={agent.business_name || ''} onChange={e => update('business_name', e.target.value)} />
            </Field>
            <Field label="Persona / Voice (who is the AI?)">
              <Textarea rows={3} value={agent.persona || ''} onChange={e => update('persona', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tone">
                <Input value={agent.tone || ''} onChange={e => update('tone', e.target.value)} placeholder="warm, witty, concise" />
              </Field>
              <Field label="Language">
                <Input value={agent.language || ''} onChange={e => update('language', e.target.value)} placeholder="English + Hinglish" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-base">Services & Pricing</CardTitle><CardDescription>What you sell, with prices in ₹</CardDescription></div>
            <Button size="sm" variant="outline" onClick={addService}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(agent.services || []).map((s, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg bg-violet-50/40 border border-violet-100">
                <Input className="col-span-4" placeholder="Service name" value={s.name || ''} onChange={e => updateService(i, 'name', e.target.value)} />
                <Input className="col-span-2" type="number" placeholder="Price ₹" value={s.price || ''} onChange={e => updateService(i, 'price', e.target.value)} />
                <Input className="col-span-5" placeholder="Description" value={s.description || ''} onChange={e => updateService(i, 'description', e.target.value)} />
                <Button size="icon" variant="ghost" onClick={() => removeService(i)} className="col-span-1 text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-base">FAQs</CardTitle><CardDescription>Train the AI on your common questions</CardDescription></div>
            <Button size="sm" variant="outline" onClick={addFAQ}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(agent.faqs || []).map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 p-3 rounded-lg bg-violet-50/40 border border-violet-100">
                <Input className="col-span-5" placeholder="Question" value={f.q || ''} onChange={e => updateFAQ(i, 'q', e.target.value)} />
                <Input className="col-span-6" placeholder="Answer" value={f.a || ''} onChange={e => updateFAQ(i, 'a', e.target.value)} />
                <Button size="icon" variant="ghost" onClick={() => removeFAQ(i)} className="col-span-1 text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardHeader><CardTitle className="text-base">Conversion Tools</CardTitle><CardDescription>Used by the AI to close deals</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Booking link">
              <Input value={agent.booking_link || ''} onChange={e => update('booking_link', e.target.value)} placeholder="https://cal.com/your/booking" />
            </Field>
            <Field label="UPI ID / Payment alias">
              <Input value={agent.upi_id || ''} onChange={e => update('upi_id', e.target.value)} placeholder="yourbiz@upi" />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 text-white shadow-lg shadow-violet-200">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Save & Re-train AI
          </Button>
        </div>
      </div>
    </div>
  )
}

function CampaignsPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    post_caption: '',
    keyword: '',
    dm_template: '',
    post_image_url: '',
    instagram_media_id: '',
  })

  const reload = () => api('/campaigns').then(l => { setList(l); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const create = async () => {
    if (!form.keyword || !form.dm_template) return toast.error('Keyword + DM template required')
    setCreating(true)
    try {
      await api('/campaigns', { method: 'POST', body: JSON.stringify(form) })
      setForm({
        post_caption: '',
        keyword: '',
        dm_template: '',
        post_image_url: '',
        instagram_media_id: '',
      })
      reload()
      toast.success('Campaign live 🚀')
    } catch (e) { toast.error(e.message) } finally { setCreating(false) }
  }
  const del = async (id) => { await api(`/campaigns/${id}`, { method: 'DELETE' }); reload() }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader icon={Megaphone} title="Comment-to-DM Campaigns" subtitle="When someone comments your keyword on a post, your AI fires a personalized DM and starts closing." />

      <Card className="border-violet-100 mb-6">
        <CardHeader><CardTitle className="text-base">+ New Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger keyword (e.g. PRICE)">
              <Input value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Post image URL (optional)">
              <Input value={form.post_image_url} onChange={e => setForm({ ...form, post_image_url: e.target.value })} placeholder="https://..." />
            </Field>
          </div>
          <Field label="Post caption">
            <Textarea rows={2} value={form.post_caption} onChange={e => setForm({ ...form, post_caption: e.target.value })} placeholder="Comment PRICE to get our menu in your DM 👇" />
          </Field>
          <Field label="Instagram media ID (optional — limits this campaign to one reel/carousel)">
            <Input
              value={form.instagram_media_id}
              onChange={e => setForm({ ...form, instagram_media_id: e.target.value.trim() })}
              placeholder="Graph API media id from the post URL or Graph Explorer"
            />
          </Field>
          <Field label="Initial DM template ({{handle}} = commenter)">
            <Textarea rows={3} value={form.dm_template} onChange={e => setForm({ ...form, dm_template: e.target.value })} placeholder="Hey {{handle}}! Thanks for the comment 💜 What pet do you have?" />
          </Field>
          <div className="flex justify-end">
            <Button onClick={create} disabled={creating} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && <Loading />}
        {list.map(c => (
          <Card key={c.id} className="border-violet-100 overflow-hidden">
            {c.post_image_url && <img src={c.post_image_url} alt="" className="w-full h-40 object-cover" />}
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge className="bg-violet-100 text-violet-700 border-0 hover:bg-violet-100"><Hash className="w-3 h-3 mr-0.5" />{c.keyword}</Badge>
                <Button size="icon" variant="ghost" onClick={() => del(c.id)} className="h-7 w-7 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <p className="text-xs text-violet-600 mb-2">{c.instagram_media_id ? `📎 Media: ${c.instagram_media_id}` : '📎 All posts (keyword only)'}</p>
              <p className="text-xs text-slate-500 line-clamp-2 italic">{c.dm_template}</p>
              <div className="flex gap-3 mt-3 text-xs">
                <span className="text-slate-500">🎯 Triggers: <b className="text-slate-900">{c.stats?.triggers || 0}</b></span>
                <span className="text-emerald-600">✅ Conversions: <b>{c.stats?.conversions || 0}</b></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function SimulatorPage({ onTriggered }) {
  const [campaigns, setCampaigns] = useState([])
  const [picked, setPicked] = useState(null)
  const [handle, setHandle] = useState('@sarah_loves_dogs')
  const [comment, setComment] = useState('PRICE')
  const [firing, setFiring] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => { api('/campaigns').then(l => { setCampaigns(l); if (l[0]) setPicked(l[0]) }) }, [])

  const fire = async () => {
    if (!picked) return
    setFiring(true)
    setResult(null)
    try {
      const r = await api('/simulate-comment', {
        method: 'POST',
        body: JSON.stringify({ campaign_id: picked.id, commenter_handle: handle, comment_text: comment }),
      })
      setResult(r)
      if (r.matched) {
        toast.success(`🎯 Keyword detected! AI fired DM to ${handle}`)
      } else {
        toast.message(`Keyword "${picked.keyword}" not found in comment`)
      }
    } catch (e) { toast.error(e.message) } finally { setFiring(false) }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader icon={Instagram} title="Instagram Simulator" subtitle="Pretend to be a fan commenting on your reel. Watch ReplyRocket auto-fire the DM and start the AI sales convo." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-violet-100 overflow-hidden bg-white">
          <div className="p-3 border-b flex items-center gap-2">
            <Avatar className="w-8 h-8"><AvatarFallback className="bg-gradient-to-br from-fuchsia-500 to-violet-500 text-white text-xs">IG</AvatarFallback></Avatar>
            <div className="text-sm font-semibold">your_business</div>
            <span className="text-xs text-slate-500">• 2h</span>
          </div>
          {picked?.post_image_url && (
            <img src={picked.post_image_url} alt="" className="w-full aspect-square object-cover" />
          )}
          <div className="p-3">
            <div className="flex gap-3 mb-2">
              <Heart className="w-6 h-6" />
              <MessageCircle className="w-6 h-6" />
              <Send className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-800"><b>your_business</b> {picked?.post_caption}</p>
          </div>
          <div className="p-3 border-t bg-slate-50/60">
            <div className="text-xs text-slate-500 mb-2">Pretend you're a follower commenting:</div>
            <div className="flex gap-2 mb-2">
              <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@your_handle" className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder={`Try: ${picked?.keyword || 'PRICE'}`} className="flex-1" />
              <Button onClick={fire} disabled={firing || !picked} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                {firing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" />Comment</>}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-violet-100">
            <CardHeader><CardTitle className="text-base">Active Campaigns</CardTitle><CardDescription>Pick which post to comment on</CardDescription></CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => setPicked(c)}
                  className={`w-full text-left p-3 rounded-lg border transition ${picked?.id === c.id ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <Badge className="bg-violet-100 text-violet-700 border-0 hover:bg-violet-100 mb-1"><Hash className="w-3 h-3 mr-0.5" />{c.keyword}</Badge>
                  <div className="text-sm text-slate-700 line-clamp-2">{c.post_caption}</div>
                </button>
              ))}
              {campaigns.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No campaigns yet. Create one first.</div>}
            </CardContent>
          </Card>

          {result?.matched && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm"><CheckCircle2 className="w-4 h-4" /> Trigger fired!</div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-slate-500 mb-1">📩 DM sent to {handle}:</div>
                  <p className="text-sm text-slate-800">{result.dm_text}</p>
                </div>
                <Button onClick={() => onTriggered(result.conversation_id)} size="sm" className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                  Open Inbox & chat as the prospect <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function InboxPage({ activeId, setActiveId }) {
  const [convos, setConvos] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = () => api('/conversations').then(l => {
    setConvos(l); setLoading(false)
    if (!activeId && l[0]) setActiveId(l[0].id)
  }).catch(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const active = convos.find(c => c.id === activeId)

  return (
    <div className="h-[calc(100vh-49px)] md:h-screen flex">
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 md:flex-shrink-0 border-r border-violet-100 bg-white/60 flex-col`}>
        <div className="p-4 border-b border-violet-100">
          <h2 className="font-bold text-lg flex items-center gap-2"><Inbox className="w-4 h-4 text-violet-600" /> Inbox</h2>
          <p className="text-xs text-slate-500">{convos.length} conversations</p>
        </div>
        <ScrollArea className="flex-1">
          {loading && <div className="p-4"><Loader2 className="w-4 h-4 animate-spin text-violet-500" /></div>}
          {convos.map(c => {
            const isActive = c.id === activeId
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-3 border-b border-slate-100 transition ${isActive ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start gap-2">
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-violet-400 to-fuchsia-400 text-white text-xs font-bold">
                      {c.handle?.replace('@', '').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold truncate">{c.handle}</div>
                      {c.lead && <ScoreBadge score={c.lead.score} />}
                    </div>
                    <div className="text-xs text-slate-600 truncate">{c.last_message}</div>
                    {c.lead && <Badge className={`text-[10px] mt-1 border-0 ${STAGE_COLORS[c.lead.stage] || ''}`}>{c.lead.stage}</Badge>}
                  </div>
                </div>
              </button>
            )
          })}
          {!loading && convos.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No conversations yet. Run the IG Simulator!</div>}
        </ScrollArea>
      </div>

      <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-gradient-to-br from-slate-50 to-violet-50/30 min-w-0`}>
        {active ? <Chat key={active.id} convo={active} onChange={reload} onBack={() => setActiveId(null)} /> : (
          <div className="flex-1 hidden md:flex items-center justify-center text-slate-400">Select a conversation</div>
        )}
      </div>
    </div>
  )
}

function ScoreBadge({ score }) {
  if (score === 'hot') return <Badge className="bg-rose-100 text-rose-700 border-0 hover:bg-rose-100 text-[9px] gap-0.5"><Flame className="w-2.5 h-2.5" />HOT</Badge>
  if (score === 'cold') return <Badge className="bg-sky-100 text-sky-700 border-0 hover:bg-sky-100 text-[9px] gap-0.5"><Snowflake className="w-2.5 h-2.5" />COLD</Badge>
  return <Badge className="bg-amber-100 text-amber-700 border-0 hover:bg-amber-100 text-[9px]">WARM</Badge>
}

function Chat({ convo, onChange, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)

  const load = () => api(`/conversations/${convo.id}/messages`).then(d => { setData(d); setLoading(false) })
  useEffect(() => { setLoading(true); load() }, [convo.id])

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [data, thinking])

  const send = async () => {
    if (!input.trim() || thinking) return
    const text = input
    setInput('')
    setData(d => ({ ...d, messages: [...(d.messages || []), { id: 'tmp-' + Date.now(), role: 'user', text, ts: new Date() }] }))
    setThinking(true)
    try {
      await api(`/conversations/${convo.id}/reply`, { method: 'POST', body: JSON.stringify({ text }) })
      await load()
      onChange?.()
    } catch (e) {
      toast.error('AI failed: ' + e.message)
    } finally { setThinking(false) }
  }

  const markPaid = async (amount) => {
    try {
      await api(`/conversations/${convo.id}/convert`, { method: 'POST', body: JSON.stringify({ amount }) })
      toast.success(`💰 Marked as converted (₹${amount})`)
      await load(); onChange?.()
    } catch (e) { toast.error(e.message) }
  }

  if (loading || !data) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>

  return (
    <>
      <div className="border-b bg-white px-3 sm:px-5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-slate-100 flex-shrink-0" aria-label="Back to inbox">
              <ArrowRight className="w-5 h-5 rotate-180 text-slate-600" />
            </button>
          )}
          <Avatar className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0"><AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">{data.lead?.handle?.replace('@', '').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2 truncate">{data.lead?.handle} <ScoreBadge score={data.lead?.score} /></div>
            <div className="text-xs text-slate-500 flex items-center gap-1"><Instagram className="w-3 h-3" /> from comment trigger</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StagePicker
            value={data.lead?.stage}
            onChange={async (s) => {
              await api(`/leads/${data.lead.id}`, { method: 'PATCH', body: JSON.stringify({ stage: s }) })
              await load(); onChange?.()
            }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
        {data.messages.map(m => <MessageBubble key={m.id} m={m} onPay={markPaid} />)}
        {thinking && (
          <div className="flex items-center gap-2 text-violet-600 text-sm pl-12">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
            AI Auto-Closer is typing…
          </div>
        )}
      </div>

      <div className="border-t bg-white p-3">
        <div className="text-xs text-slate-500 mb-2 px-1">💬 Reply as the prospect (simulating the lead's side):</div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type as the prospect... (e.g. 'I have a golden retriever, what's the price for full spa?')"
            rows={2}
            className="flex-1 resize-none"
          />
          <Button onClick={send} disabled={thinking || !input.trim()} className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white self-end">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

function MessageBubble({ m, onPay }) {
  if (m.role === 'comment') {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
          📝 Original comment: "{m.text}"
        </div>
      </div>
    )
  }
  if (m.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          {m.text}
        </div>
      </div>
    )
  }
  const isAgent = m.role === 'agent'
  const actions = m.meta?.actions || []
  return (
    <div className={`flex gap-2 ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <Avatar className="w-8 h-8 flex-shrink-0"><AvatarFallback className="bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><Bot className="w-4 h-4" /></AvatarFallback></Avatar>
      )}
      <div className={`max-w-[70%] ${isAgent ? '' : 'items-end'} flex flex-col`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
          isAgent
            ? 'bg-white border border-violet-100 text-slate-800 rounded-tl-sm'
            : 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white rounded-tr-sm'
        }`}>
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {actions.map((a, i) => <ActionChip key={i} a={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionChip({ a }) {
  if (a.type === 'share_booking_link') {
    return (
      <a href={a.url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100">
        <CalendarDays className="w-3.5 h-3.5" /> Book a slot <ExternalLink className="w-3 h-3" />
      </a>
    )
  }
  if (a.type === 'share_pricing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">
        <Sparkles className="w-3.5 h-3.5" /> Pricing shared
      </span>
    )
  }
  return null
}

function StagePicker({ value, onChange }) {
  return (
    <Select value={value || 'new'} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {STAGES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = () => api('/leads').then(l => { setLeads(l); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { reload() }, [])

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader icon={Users} title="Leads (CRM)" subtitle="Every prospect captured from comments, scored & staged by your AI." />
      <Card className="border-violet-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-violet-50 text-slate-700">
            <tr>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Handle</th>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Source</th>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Stage</th>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Score</th>
              <th className="text-right p-3 font-semibold whitespace-nowrap">Revenue</th>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {leads.map(l => (
              <tr key={l.id} className="border-t hover:bg-violet-50/40">
                <td className="p-3 font-medium">{l.handle}</td>
                <td className="p-3 text-slate-600 text-xs"><Instagram className="w-3 h-3 inline mr-1" /> {l.source}</td>
                <td className="p-3">
                  <Select value={l.stage} onValueChange={async s => {
                    await api(`/leads/${l.id}`, { method: 'PATCH', body: JSON.stringify({ stage: s }) })
                    reload()
                  }}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-3"><ScoreBadge score={l.score} /></td>
                <td className="p-3 text-right font-semibold text-emerald-600">{l.revenue ? `₹${l.revenue}` : '—'}</td>
                <td className="p-3 text-xs text-slate-500">{new Date(l.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && leads.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No leads yet. Run the IG Simulator.</td></tr>}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

function SettingsPage({ user }) {
  const [igStatus, setIgStatus] = useState(null)
  const [igBusy, setIgBusy] = useState(false)
  const [billing, setBilling] = useState(null)
  const [billingBusy, setBillingBusy] = useState(false)

  const reloadBilling = () => api('/billing/status').then(setBilling).catch(() => setBilling({ plan: 'free', status: 'inactive' }))

  useEffect(() => {
    reloadBilling()
    api('/instagram/status').then(setIgStatus).catch(() => setIgStatus({ configured: false, connected: false }))
    // Surface ?ig=connected / ?ig=error&reason=... query strings from the OAuth callback redirect.
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      const ig = u.searchParams.get('ig')
      const reason = u.searchParams.get('reason')
      if (ig === 'connected') toast.success('Instagram connected!')
      else if (ig === 'error') toast.error(`Instagram connect failed${reason ? `: ${reason}` : ''}`)
      if (ig) {
        u.searchParams.delete('ig')
        u.searchParams.delete('reason')
        window.history.replaceState({}, '', u.toString())
      }
    }
  }, [])

  const connectIG = () => {
    if (igStatus && !igStatus.configured) {
      toast.error('Set META_APP_ID and META_APP_SECRET in .env first, then restart the dev server.')
      return
    }
    setIgBusy(true)
    window.location.href = '/api/instagram/connect'
  }
  const runIgCommentsProbe = async () => {
    setIgBusy(true)
    try {
      const r = await api('/instagram/probe-comments', { method: 'POST' })
      if (r.skipped === 'no_media') {
        toast.message(r.message || 'Post on Instagram first, then try again.')
      } else {
        const action = r.write_action?.type === 'reply' ? 'Posted test reply' : 'Posted test comment'
        toast.success(`${action} on your latest post. Delete it on IG. Meta Testing may take 24h.`)
      }
    } catch (e) {
      toast.error(e.message || 'Comments API check failed')
    } finally {
      setIgBusy(false)
    }
  }

  const runIgMessagesProbe = async () => {
    setIgBusy(true)
    try {
      const r = await api('/instagram/probe-messages', { method: 'POST' })
      toast.success(
        `Messages API OK (${r.conversation_count ?? 0} conversations). Meta Testing may take 24h.`,
      )
    } catch (e) {
      toast.error(e.message || 'Messages API check failed')
    } finally {
      setIgBusy(false)
    }
  }

  const disconnectIG = async () => {
    setIgBusy(true)
    try {
      await api('/instagram/disconnect', { method: 'POST' })
      const fresh = await api('/instagram/status')
      setIgStatus(fresh)
      toast.success('Instagram disconnected.')
    } catch (e) {
      toast.error('Disconnect failed')
    } finally {
      setIgBusy(false)
    }
  }

  const cancelSubscription = async () => {
    if (!confirm('Cancel your subscription? You\'ll keep access until the end of your current billing period, then move to the Free plan.')) return
    setBillingBusy(true)
    try {
      await api('/billing/cancel', { method: 'POST' })
      await reloadBilling()
      toast.success('Subscription cancelled. You\'ll keep Pro access until period end.')
    } catch (e) {
      toast.error(e.message === 'no_active_subscription' ? 'No active subscription to cancel.' : 'Cancel failed.')
    } finally {
      setBillingBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
      <PageHeader icon={Settings} title="Settings" subtitle="Account and integrations." />

      <Card className="border-violet-100 mb-4">
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium">{user.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium">{user.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Business</span><span className="font-medium">{user.business_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Workspace ID</span><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{user.workspace_id?.slice(0, 8)}…</code></div>
        </CardContent>
      </Card>

      {/* BILLING CARD */}
      <Card className="border-violet-200 mb-4 bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> Billing & Plan</CardTitle>
              <CardDescription>Your ReplyRocket subscription</CardDescription>
            </div>
            <Badge className={`border-0 ${billing?.plan === 'free' ? 'bg-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-700 hover:to-fuchsia-600'}`}>
              {billing?.plan_name || (billing ? billing.plan?.toUpperCase() : '…')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {billing === null ? (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading plan…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white border border-violet-100">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Status</div>
                  <div className="text-sm font-bold capitalize">{billing.status}{billing.cancel_at_period_end ? ' (cancels at period end)' : ''}</div>
                </div>
                <div className="p-3 rounded-lg bg-white border border-violet-100">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Monthly</div>
                  <div className="text-sm font-bold">{billing.price === 0 ? 'Free' : `₹${billing.price?.toLocaleString('en-IN')}`}</div>
                </div>
              </div>
              {billing.current_period_end && (
                <div className="text-xs text-slate-500">
                  Current period ends: <b>{new Date(billing.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
                </div>
              )}
              {billing.limits && (
                <div className="p-3 rounded-lg bg-white border border-violet-100">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Plan includes</div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>• {billing.limits.monthly_dms?.toLocaleString('en-IN')} DMs/month</div>
                    <div>• {billing.limits.social_accounts} social account{billing.limits.social_accounts > 1 ? 's' : ''}</div>
                    <div>• AI replies: {billing.limits.ai_replies ? 'Yes' : 'No'}</div>
                    {billing.limits.whatsapp && <div>• WhatsApp Cloud API</div>}
                    {billing.limits.white_label && <div>• White-label branding</div>}
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <a href="/pricing" className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                  <Sparkles className="w-4 h-4" /> {billing.plan === 'free' ? 'Upgrade' : 'Change plan'}
                </a>
                {billing.plan !== 'free' && billing.status === 'active' && !billing.cancel_at_period_end && (
                  <Button onClick={cancelSubscription} disabled={billingBusy} variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50">
                    {billingBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel subscription'}
                  </Button>
                )}
              </div>
              {!billing.platform_configured && billing.plan === 'free' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                  ⚠️ Platform Razorpay keys not set yet — paid upgrades won&apos;t work. (Admin: set <code>RAZORPAY_KEY_ID</code> + <code>RAZORPAY_KEY_SECRET</code> in env.)
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-violet-100 mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Instagram className="w-4 h-4 text-fuchsia-600" /> Instagram</CardTitle>
          <CardDescription>Connect your Instagram Business/Creator account so ReplyRocket can auto-reply to real comments and DMs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* CONNECTION STATE */}
          {igStatus === null ? (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Checking status…</div>
          ) : igStatus.connected ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-3">
                {igStatus.profile_picture_url ? (
                  <img src={igStatus.profile_picture_url} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center text-white"><Instagram className="w-4 h-4" /></div>
                )}
                <div>
                  <div className="font-semibold">@{igStatus.ig_username || '(unknown)'} <Badge className="ml-1 bg-emerald-200 text-emerald-800 border-0 hover:bg-emerald-200">Connected</Badge></div>
                  <div className="text-xs text-slate-500">{igStatus.account_type || 'Instagram'} · token expires {igStatus.token_expires_at ? new Date(igStatus.token_expires_at).toLocaleDateString() : 'unknown'}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" disabled={igBusy} onClick={runIgMessagesProbe}>
                  {igBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Meta messages test'}
                </Button>
                <Button variant="outline" size="sm" disabled={igBusy} onClick={runIgCommentsProbe}>
                  {igBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Meta comments test'}
                </Button>
                <Button variant="outline" disabled={igBusy} onClick={disconnectIG}>{igBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <div className="font-medium">Not connected</div>
                <div className="text-xs text-slate-500">
                  {igStatus.configured
                    ? 'Click Connect — Instagram will ask for permission, then redirect back here.'
                    : 'Add META_APP_ID + META_APP_SECRET to .env and restart the dev server.'}
                </div>
              </div>
              <Button disabled={igBusy} onClick={connectIG} className="bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700">
                {igBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Instagram className="w-4 h-4 mr-2" /> Connect Instagram</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-violet-100">
        <CardHeader><CardTitle className="text-base">Connected integrations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <IntegrationRow icon={Sparkles} label="Claude Sonnet 4.5 (AI Auto-Closer)" connected />
          <IntegrationRow
            icon={Instagram}
            label={`Instagram${igStatus?.connected ? ` (@${igStatus.ig_username})` : ''}`}
            connected={!!igStatus?.connected}
          />
          <IntegrationRow icon={MessageCircle} label="WhatsApp Cloud API" connected={false} />
        </CardContent>
      </Card>
    </div>
  )
}

function IntegrationRow({ icon: Icon, label, connected }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${connected ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 flex-shrink-0 ${connected ? 'text-emerald-600' : 'text-slate-500'}`} />
        <span className="text-sm font-medium truncate">{label}</span>
      </div>
      {connected
        ? <Badge className="bg-emerald-200 text-emerald-800 border-0 hover:bg-emerald-200 flex-shrink-0">Connected</Badge>
        : <Badge variant="outline" className="text-slate-500 flex-shrink-0">Not connected</Badge>}
    </div>
  )
}

function PageHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow shadow-violet-200">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      </div>
      <p className="text-slate-500 ml-11">{subtitle}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function Loading() {
  return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
}

export default App
