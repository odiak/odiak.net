import type { LinksFunction } from 'react-router'
import type React from 'react'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  useRouteError
} from 'react-router'
import stylesheet from '../src/styles/globals.css?url'

export const links: LinksFunction = () => [
  { rel: 'icon', href: '/favicon.png' },
  { rel: 'stylesheet', href: stylesheet },
  { rel: 'alternate', href: '/atom-feed.xml', type: 'application/atom+xml' }
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="main-header">
          <Link to="/">odiak.net</Link>
        </header>
        {children}
        <footer>&copy; 2021 Kaido Iwamoto</footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? 'Not Found'
      : error.statusText
    : 'Server-side Error'

  return (
    <main>
      <h1>{message}</h1>
    </main>
  )
}
