import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'ReplyRocket — AI Revenue Engine for Creators',
  description: 'Turn every comment, DM, and reel into revenue. AI Auto-Closer for Instagram, WhatsApp & TikTok.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
