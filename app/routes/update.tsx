import type {
  ActionFunctionArgs,
  AppLoadContext,
  LoaderFunctionArgs,
  MetaFunction
} from 'react-router'
import { Form, useActionData } from 'react-router'
import { verifyAccessRequest } from '../../src/cloudflare-access'
import { defaultMeta } from '../seo'

type ActionResult = { ok: boolean; message: string }

export const meta: MetaFunction = () => [
  ...defaultMeta({ title: 'サイトの再デプロイ', path: '/update' }),
  { name: 'robots', content: 'noindex' }
]

async function requireAccess(request: Request, context: AppLoadContext) {
  // vite dev では Access を通らないので検証を省く
  if (import.meta.env.DEV) return

  const env = context.cloudflare.env
  const isAuthorized = await verifyAccessRequest(request, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD
  })
  if (!isAuthorized) {
    throw new Response(null, { status: 403, statusText: 'Forbidden' })
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAccess(request, context)
  return null
}

export async function action({ request, context }: ActionFunctionArgs): Promise<ActionResult> {
  await requireAccess(request, context)
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new Response(null, { status: 403, statusText: 'Forbidden' })
  }

  const deployHookUrl = context.cloudflare.env.DEPLOY_HOOK_URL
  if (!deployHookUrl) {
    return { ok: false, message: 'DEPLOY_HOOK_URL が設定されていません。' }
  }

  const response = await fetch(deployHookUrl, { method: 'POST' })
  if (!response.ok) {
    console.error('Deploy hook failed', response.status, await response.text())
    return { ok: false, message: `再デプロイを開始できませんでした（HTTP ${response.status}）。` }
  }

  return { ok: true, message: '再デプロイを開始しました。反映まで数分かかります。' }
}

export default function Update() {
  const result = useActionData<typeof action>()

  return (
    <main>
      <h2>サイトの再デプロイ</h2>
      <p>Kuro の最新の内容でサイトをビルドし直します。</p>
      {/* /update.data へのリクエストを作らないよう、通常のフォーム送信にする */}
      <Form method="post" reloadDocument>
        <button type="submit">再デプロイする</button>
      </Form>
      {result != null && <p role="status">{result.message}</p>}
    </main>
  )
}
