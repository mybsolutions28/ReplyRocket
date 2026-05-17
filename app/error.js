'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-violet-100 p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-rose-100">!</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-4">
          We hit an unexpected error. Your data is safe — just try again. If this keeps happening, contact support.
        </p>
        {error?.digest && (
          <p className="text-[10px] text-slate-400 font-mono mb-4">ref: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-medium text-sm hover:opacity-90 transition"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}
