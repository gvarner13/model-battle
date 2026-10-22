import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Model Battle — One photo. Four perspectives.' },
      {
        name: 'description',
        content:
          'See how GPT-6 Luna, Claude Haiku 5.5, Gemini 3.8 Flash and Cloudflare Clairic see your photo.',
      },
      { name: 'theme-color', content: '#f7f6f2' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <main className="not-found">
      <h1>Nothing to see here.</h1>
      <a href="/">Back to Model Battle</a>
    </main>
  ),
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
