import { GetStaticProps } from 'next'
import { compareDateLike, Content, getAllContents } from '../contents'
import Link from 'next/link'
import { ShowDate } from '../components/ShowDate'
import { MetaData } from '../components/MetaData'

type Props = { mainContents: Content[]; subContents: Content[] }
type Params = {}

export default function Index({ mainContents, subContents }: Props) {
  return (
    <>
      <MetaData />

      <p>岩本海童の個人的なウェブサイトです。</p>

      <main>
        <ul className="main-contents-list">
          {mainContents.map(({ slug, title, created, isPinned }) => (
            <li key={slug}>
              {!isPinned && <ShowDate date={created} />}
              <Link href={`/${slug}`}>{title}</Link>
            </li>
          ))}
        </ul>

        {
          <>
            <h2 className="h-other">その他</h2>
            <ul className="sub-contents-list">
              {subContents.map(({ slug, title }) => (
                <li key={slug}>
                  <Link href={`/${slug}`}>{title}</Link>
                </li>
              ))}
            </ul>
          </>
        }
      </main>
    </>
  )
}

export const getStaticProps: GetStaticProps<Props, Params> = async () => {
  const contents = (await getAllContents()).filter((c) => !c.isIntermediate && !c.isArchived)
  const mainContents = contents.filter((c) => !c.isRandom)
  mainContents.sort(
    (a, b) =>
      -((a.isPinned ? 1 : 0) - (b.isPinned ? 1 : 0) || compareDateLike(a.created!, b.created!))
  )

  const subContents = contents.filter((c) => c.isRandom)
  subContents.sort((a, b) => compareDateLike(a.modified!, b.modified!))

  return { props: { mainContents, subContents } }
}
