import { createRequestHandler } from 'react-router'

type Env = Record<string, unknown>

declare module 'react-router' {
  export interface AppLoadContext {
    cloudflare: {
      env: Env
      ctx: ExecutionContext
    }
  }
}

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build') as Promise<any>,
  import.meta.env.MODE
)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/reversi/' || url.pathname === '/reversi') {
      return Response.redirect('https://reversi.odiak.net', 308)
    }

    return requestHandler(request, {
      cloudflare: { env, ctx }
    })
  }
} satisfies ExportedHandler<Env>
