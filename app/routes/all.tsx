import type { MetaFunction } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import { Content, getAllContents } from '../../src/contents'
import { defaultMeta } from '../seo'

export const meta: MetaFunction = () => defaultMeta({ title: 'ページ一覧', path: '/all' })

export async function loader(): Promise<{ contents: Content[] }> {
  return { contents: await getAllContents() }
}

export default function All() {
  const { contents } = useLoaderData<typeof loader>()

  return (
    <>
      <h2>ページ一覧</h2>
      <ul>
        {contents.map((content) => (
          <li key={content.slug}>
            <Link to={`/${content.slug}`}>{content.title}</Link>
            {content.isIntermediate && '* '}
          </li>
        ))}
      </ul>
    </>
  )
}
