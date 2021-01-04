import { GetStaticProps } from 'next'
import { Content, getAllSlugs, getContent } from '../contents'
import Link from 'next/link'
import { ShowDate } from '../components/ShowDate'
import { MetaData } from '../components/MetaData'

type Props = { contents: Content[] }
type Params = {}

export default function Index({ contents }: Props) {
  return (
    <>
      <MetaData />

      <p>岩本海童の個人的なウェブサイトです。</p>

      <main>
        <ul>
          {contents.map(({ slug, title, created, isPinned }) => (
            <li key={slug}>
              {!isPinned && <ShowDate date={created} />}
              <Link href={`/${slug}`}>{title}</Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

export const getStaticProps: GetStaticProps<Props, Params> = async () => {
  const contents = getAllSlugs().map((slug) => getContent(slug))
  contents.sort(
    (a, b) =>
      -(
        (a.isPinned ? 1 : 0) - (b.isPinned ? 1 : 0) ||
        a.created.year - b.created.year ||
        a.created.month - b.created.month ||
        a.created.day - b.created.day
      )
  )

  return { props: { contents } }
}
