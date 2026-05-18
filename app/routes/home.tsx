import type { MetaFunction } from 'react-router'
import { Link, useLoaderData } from 'react-router'
import { compareDateLike, Content, getAllContents } from '../../src/contents'
import { ShowDate } from '../../src/components/ShowDate'
import { defaultMeta } from '../seo'

type LoaderData = { mainContents: Content[]; subContents: Content[] }

export const meta: MetaFunction = () => defaultMeta({ path: '/' })

export async function loader(): Promise<LoaderData> {
  const contents = (await getAllContents()).filter((c) => !c.isIntermediate && !c.isArchived)
  const mainContents = contents.filter((c) => !c.isRandom)
  mainContents.sort(
    (a, b) =>
      -((a.isPinned ? 1 : 0) - (b.isPinned ? 1 : 0) || compareDateLike(a.created!, b.created!))
  )

  const subContents = contents.filter((c) => c.isRandom)
  subContents.sort((a, b) => -compareDateLike(a.modified!, b.modified!))

  return { mainContents, subContents }
}

export default function Home() {
  const { mainContents, subContents } = useLoaderData<typeof loader>()

  return (
    <>
      <p>岩本海童の個人的なウェブサイトです。</p>

      <main>
        <ul className="main-contents-list">
          {mainContents.map(({ slug, title, created, isPinned }) => (
            <li key={slug}>
              {!isPinned && <ShowDate date={created} />}
              <Link to={`/${slug}`}>{title}</Link>
            </li>
          ))}
        </ul>

        <h2 className="h-other">その他</h2>
        <ul className="sub-contents-list">
          {subContents.map(({ slug, title }) => (
            <li key={slug}>
              <Link to={`/${slug}`}>{title}</Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
