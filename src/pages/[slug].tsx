import { Content, getAllSlugs, getContent, getAllContents } from '../contents'
import { GetStaticPaths, GetStaticProps } from 'next'
import { ShowDate } from '../components/ShowDate'
import { MetaData } from '../components/MetaData'
import unified from 'unified'
import remarkParse from 'remark-parse'
import { wikiLinkPlugin } from 'remark-wiki-link'
import remarkReact from 'remark-react'

type Props = {
  content: Content
  contents: Content[]
}
type Params = {
  slug: string
}

export default function ShowContent({ content, contents }: Props) {
  return (
    <>
      <MetaData title={content.title} />

      <main>
        <h1>{content.title}</h1>
        {!content.isIntermediate && <ShowDate date={content.created} />}
        {
          unified()
            .use(remarkParse)
            .use(wikiLinkPlugin, {
              permalinks: contents.map((c) => c.slug),
              pageResolver: (name: string) =>
                contents.filter((c) => c.title === name).map((c) => c.slug),
              hrefTemplate: (slug: string) => `/${slug}`
            })
            .use(remarkReact)
            .processSync(content.body).result
        }
      </main>
      <h3>outgoing</h3>
      <ul>
        {content.outgoingLinks?.map(({ name, slug, oneHopLinks }) => (
          <li key={slug}>
            <a href={`/${slug}`}>{name}</a>
            {oneHopLinks != null && (
              <ul>
                {oneHopLinks.map(({ slug, name }) => (
                  <li key={slug}>
                    <a href={`/${slug}`}>{name}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <h3>incoming</h3>
      <ul>
        {content.incomingLinks?.map(({ name, slug }) => (
          <li key={slug}>
            <a href={`/${slug}`}>{name}</a>
          </li>
        ))}
      </ul>
    </>
  )
}

export const getStaticProps: GetStaticProps<Props, Params> = async (context) => {
  const { slug } = context.params!

  const content = getContent(slug)
  const contents = getAllContents()
  return { props: { content, contents } }
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  return {
    paths: getAllSlugs().map((slug) => ({ params: { slug } })),
    fallback: false
  }
}
