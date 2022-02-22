import { Content, getAllSlugs, getContent, getMetaData } from '../contents'
import { GetStaticPaths, GetStaticProps } from 'next'
import { ShowDate } from '../components/ShowDate'
import { MetaData } from '../components/MetaData'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import remarkReact from 'remark-react'
import { schema } from '../markdown-sanitization-schema'
import remarkGfm from 'remark-gfm'
import { createElement } from 'react'
import remarkBreaks from 'remark-breaks'

type Props = {
  content: Content
  linksInfo: {
    incoming: Array<{ slug: string; title: string; name: string }>
    outgoing: Array<{
      slug: string
      title: string
      name: string
      oneHopLinks: Array<{ slug: string; title: string; name: string }>
    }>
  }
}
type Params = {
  slug: string
}

export default function ShowContent({ content, linksInfo }: Props) {
  return (
    <>
      <MetaData title={content.title} />

      <main>
        <h1>{content.title}</h1>
        {!content.isIntermediate && content.created && <ShowDate date={content.created} />}
        {
          unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkBreaks)
            .use(wikiLinkPlugin, {
              permalinks: linksInfo.outgoing.map((li) => `/${li.slug}`),
              pageResolver: (name: string) =>
                linksInfo.outgoing
                  .filter((li) => li.name.toLowerCase() === name.toLowerCase())
                  .map((li) => li.slug),
              hrefTemplate: (slug: string) => `/${slug}`
            })
            .use(remarkReact, { sanitize: schema, createElement })
            .processSync(content.body).result
        }
      </main>
      {(linksInfo.incoming.length > 0 || linksInfo.outgoing.length > 0) && (
        <aside className="related-contents">
          <header>関連ページ</header>
          <ul>
            {linksInfo.outgoing.map(({ title, slug, oneHopLinks }) => (
              <li key={slug}>
                <a href={`/${slug}`}>{title}</a>
                {oneHopLinks != null && (
                  <ul>
                    {oneHopLinks.map(({ slug, title }) => (
                      <li key={slug}>
                        <a href={`/${slug}`}>{title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {linksInfo.incoming.map(({ title, slug }) => (
              <li key={slug}>
                <a href={`/${slug}`}>{title}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  )
}

export const getStaticProps: GetStaticProps<Props, Params> = async (context) => {
  const { slug } = context.params!

  const content = await getContent(slug)
  const metaData = await getMetaData()
  const rawLinksInfo = metaData.nameToLinksMap[content.name]

  function convert({ name }: { name: string }) {
    const slug = metaData.nameToSlugMap[name]
    const title = metaData.slugToTitleMap[slug]
    return { name, slug, title }
  }

  const linksInfo = {
    incoming: rawLinksInfo.incoming.map(convert),
    outgoing: rawLinksInfo.outgoing.map((li) => ({
      ...convert(li),
      oneHopLinks: li.oneHopLinks.map(convert)
    }))
  }
  return { props: { content, linksInfo } }
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  return {
    paths: (await getAllSlugs()).map((slug) => ({ params: { slug } })),
    fallback: false
  }
}
