'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 420, background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>Critical error</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b' }}>The application crashed at the root level. Try refreshing.</p>
          {error?.digest && (<p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>ref: {error.digest}</p>)}
          <button onClick={reset} style={{ padding: '8px 16px', background: 'linear-gradient(90deg,#7c3aed,#d946ef)', color: 'white', border: 0, borderRadius: 8, fontWeight: 500, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  )
}
