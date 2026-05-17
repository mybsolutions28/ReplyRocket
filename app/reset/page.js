'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Rocket, Loader2, CheckCircle2 } from 'lucide-react'

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

export default function ResetPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = new URL(window.location.href).searchParams.get('token') || ''
      setToken(t)
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!token) return toast.error('Missing reset token in URL.')
    if (password !== confirmPassword) return toast.error('Passwords do not match.')
    if (password.length < 6) return toast.error('Password must be at least 6 characters.')
    setLoading(true)
    try {
      await api('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) })
      setDone(true)
    } catch (e) {
      toast.error(e.message === 'invalid_or_expired' ? 'This reset link is invalid or has expired. Request a new one.' : 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 p-4">
      <Card className="w-full max-w-md border-violet-100 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div className="font-bold text-slate-900 text-lg">ReplyRocket</div>
          </div>

          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-slate-900 mb-1">Password reset!</h1>
              <p className="text-sm text-slate-600 mb-6">You can now log in with your new password.</p>
              <a href="/" className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-medium text-sm">Go to log in</a>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Reset your password</h1>
              <p className="text-slate-500 text-sm mb-6">Pick a new password and you&apos;re back in.</p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">New password</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block uppercase tracking-wide">Confirm password</label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset password'}
                </Button>
              </form>
              <div className="text-xs text-slate-500 mt-4 text-center">
                <a href="/" className="text-violet-600 hover:underline">Back to log in</a>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
