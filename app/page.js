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
  CalendarDays, IndianRupee, MessageCircle, Heart, Hash, CheckCircle2, Flame, Snowflake, Zap, Instagram, Loader2, ArrowRight, LogOut, Settings, Copy, ExternalLink
} from 'lucide-react'

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
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login'
      const body = mode === 'signup'
        ? { email, password, name, business_name: businessName }
        : { email, password }
      const u = await api(path, { method: 'POST', body: JSON.stringify(body) })
      toast.success(mode === 'signup' ? 'Welcome to ReplyRocket! 🚀' : 'Welcome back!')
      onAuthed(u)
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl text-slate-900">ReplyRocket</div>
              <div className="text-xs text-slate-500 -mt-0.5">AI Revenue Engine</div>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-slate-500 text-sm mb-6">{mode === 'signup' ? 'Spin up your AI sales agent in 30 seconds.' : 'Log in to your dashboard.'}</p>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <Field label="Your name"><Input value={name} onChange={e => setName(e.target.value)} required /></Field>
                <Field label="Business name"><Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Pawsome Pet Salon" required /></Field>
              </>
            )}
            <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></Field>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {mode === 'signup' ? 'Create account' : 'Log in'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-500">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-violet-600 font-semibold hover:underline">
              {mode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
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

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null))
  }, [])

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-violet-100 bg-white/70 backdrop-blur sticky top-0 h-screen flex flex-col">
          <div className="p-5 border-b border-violet-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-slate-900 leading-tight">ReplyRocket</div>
                <div className="text-[10px] text-slate-500 font-medium">AI REVENUE ENGINE</div>
              </div>
            </div>
          </div>
          <nav className="p-3 flex-1 space-y-1">
            {NAV.map(n => {
              const Icon = n.icon
              const active = tab === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
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
          <div className="p-4 border-t border-violet-100 space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{user.name}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
              <Button onClick={logout} size="icon" variant="ghost" title="Log out" className="h-7 w-7 text-slate-500 hover:text-rose-600 flex-shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white p-4 shadow-lg shadow-violet-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Powered by Claude 4.5
              </div>
              <p className="text-xs text-violet-100">Real Razorpay payments + AI auto-close, 24/7.</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          {tab === 'dashboard' && <Dashboard go={setTab} />}
          {tab === 'agent' && <AgentPage />}
          {tab === 'campaigns' && <CampaignsPage />}
          {tab === 'simulator' && <SimulatorPage onTriggered={switchToInbox} />}
          {tab === 'inbox' && <InboxPage activeId={activeConvoId} setActiveId={setActiveConvoId} />}
          {tab === 'leads' && <LeadsPage />}
          {tab === 'settings' && <SettingsPage user={user} />}
        </main>
      </div>
    </div>
  )
}

function Dashboard({ go }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { api('/analytics').then(setStats).catch(() => {}) }, [])

  const cards = [
    { label: 'Total Leads', value: stats?.total_leads ?? '—', icon: Users, tint: 'from-violet-500 to-fuchsia-500' },
    { label: 'Conversations', value: stats?.total_conversations ?? '—', icon: MessageCircle, tint: 'from-blue-500 to-violet-500' },
    { label: 'Conversion Rate', value: `${stats?.conversion_rate ?? 0}%`, icon: Zap, tint: 'from-amber-500 to-pink-500' },
    { label: 'Revenue (₹)', value: stats?.revenue ?? 0, icon: IndianRupee, tint: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div className="p-8 max-w-7xl">
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
    <div className="p-8 max-w-5xl">
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
  const [form, setForm] = useState({ post_caption: '', keyword: '', dm_template: '', post_image_url: '' })

  const reload = () => api('/campaigns').then(l => { setList(l); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { reload() }, [])

  const create = async () => {
    if (!form.keyword || !form.dm_template) return toast.error('Keyword + DM template required')
    setCreating(true)
    try {
      await api('/campaigns', { method: 'POST', body: JSON.stringify(form) })
      setForm({ post_caption: '', keyword: '', dm_template: '', post_image_url: '' })
      reload()
      toast.success('Campaign live 🚀')
    } catch (e) { toast.error(e.message) } finally { setCreating(false) }
  }
  const del = async (id) => { await api(`/campaigns/${id}`, { method: 'DELETE' }); reload() }

  return (
    <div className="p-8 max-w-6xl">
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
              <p className="text-sm text-slate-700 line-clamp-2 mb-2">{c.post_caption}</p>
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
    <div className="p-8 max-w-6xl">
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
    <div className="h-screen flex">
      <div className="w-80 border-r border-violet-100 bg-white/60 flex flex-col">
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

      <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 to-violet-50/30">
        {active ? <Chat key={active.id} convo={active} onChange={reload} /> : (
          <div className="flex-1 flex items-center justify-center text-slate-400">Select a conversation</div>
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

function Chat({ convo, onChange }) {
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
      <div className="border-b bg-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10"><AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">{data.lead?.handle?.replace('@', '').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div>
            <div className="font-semibold flex items-center gap-2">{data.lead?.handle} <ScoreBadge score={data.lead?.score} /></div>
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
  if (a.type === 'share_payment_link') {
    if (a.link?.short_url) {
      return (
        <a href={a.link.short_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-medium">
          <IndianRupee className="w-3.5 h-3.5" /> Pay ₹{a.amount} • {a.label} <ExternalLink className="w-3 h-3" />
        </a>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
        <IndianRupee className="w-3.5 h-3.5" /> Payment link unavailable
      </span>
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
    <div className="p-8 max-w-6xl">
      <PageHeader icon={Users} title="Leads (CRM)" subtitle="Every prospect captured from comments, scored & staged by your AI." />
      <Card className="border-violet-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-violet-50 text-slate-700">
            <tr>
              <th className="text-left p-3 font-semibold">Handle</th>
              <th className="text-left p-3 font-semibold">Source</th>
              <th className="text-left p-3 font-semibold">Stage</th>
              <th className="text-left p-3 font-semibold">Score</th>
              <th className="text-right p-3 font-semibold">Revenue</th>
              <th className="text-left p-3 font-semibold">Updated</th>
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
      </Card>
    </div>
  )
}

function SettingsPage({ user }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${baseUrl}/api/webhooks/razorpay`
  const copy = (text, label) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }
  return (
    <div className="p-8 max-w-4xl">
      <PageHeader icon={Settings} title="Settings" subtitle="Account, integrations, and webhook configuration." />

      <Card className="border-violet-100 mb-4">
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-medium">{user.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium">{user.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Business</span><span className="font-medium">{user.business_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Workspace ID</span><code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{user.workspace_id?.slice(0, 8)}…</code></div>
        </CardContent>
      </Card>

      <Card className="border-violet-100 mb-4">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><IndianRupee className="w-4 h-4 text-emerald-600" /> Razorpay Webhook (REQUIRED for auto-conversion)</CardTitle>
          <CardDescription>Configure this webhook in your Razorpay Dashboard so payments mark leads as converted automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">Webhook URL</label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button onClick={() => copy(webhookUrl, 'Webhook URL')} variant="outline" size="icon"><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">Webhook Secret</label>
            <div className="flex gap-2">
              <Input readOnly value="(set RAZORPAY_WEBHOOK_SECRET in your deployment env — see README)" className="font-mono text-xs" />
            </div>
            <p className="text-xs text-slate-500 mt-1">In dev, this is auto-generated in your <code>.env</code>. In Razorpay Dashboard → Account & Settings → Webhooks → Add New Webhook → paste the URL above and the same secret value.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">Events to subscribe</label>
            <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">payment_link.paid</Badge>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <b>Test mode active.</b> Use Razorpay test cards (e.g. 4111 1111 1111 1111) on the payment link. Once paid, your dashboard will auto-mark the lead as <b>Converted</b> and log revenue.
          </div>
        </CardContent>
      </Card>

      <Card className="border-violet-100">
        <CardHeader><CardTitle className="text-base">Connected integrations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium">Claude Sonnet 4.5 (AI Auto-Closer)</span></div>
            <Badge className="bg-emerald-200 text-emerald-800 border-0 hover:bg-emerald-200">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-emerald-600" /><span className="text-sm font-medium">Razorpay Payments (Test Mode)</span></div>
            <Badge className="bg-emerald-200 text-emerald-800 border-0 hover:bg-emerald-200">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2"><Instagram className="w-4 h-4 text-slate-500" /><span className="text-sm font-medium">Instagram Graph API</span></div>
            <Badge variant="outline" className="text-slate-500">Simulator only — Meta approval required</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-slate-500" /><span className="text-sm font-medium">WhatsApp Cloud API</span></div>
            <Badge variant="outline" className="text-slate-500">Not connected</Badge>
          </div>
        </CardContent>
      </Card>
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
