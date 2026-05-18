import type { AppLoadContext, EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'
import { renderToReadableStream } from 'react-dom/server.browser'

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  return renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      responseStatusCode = 500
      console.error(error)
    }
  }).then((body) => {
    responseHeaders.set('Content-Type', 'text/html')
    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode
    })
  })
}
