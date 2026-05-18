import type { MetaFunction } from 'react-router'
import { useLoaderData } from 'react-router'
import { createElement } from 'react'
import type React from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import remarkReact from 'remark-react'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Content, getAllSlugs, getContent, getMetaData } from '../../src/contents'
import { ShowDate } from '../../src/components/ShowDate'
import { schema } from '../../src/markdown-sanitization-schema'
import { makeDescription } from '../../src/utils/makeDescription'
import { defaultMeta } from '../seo'

type LoaderData = {
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
  nameToSlugMap: Record<string, { slug: string; isIntermediate: boolean }>
}

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) return defaultMeta({ path: location.pathname })

  return defaultMeta({
    title: data.content.title,
    description: makeDescription(data.content.body),
    path: location.pathname
  })
}

export async function loader({ params }: { params: { slug?: string } }): Promise<LoaderData> {
  const slug = params.slug
  if (slug == null || !(await getAllSlugs()).includes(slug)) {
    throw new Response('Not Found', { status: 404 })
  }

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
  const nameToSlugMap = Object.fromEntries(
    Object.entries(metaData.nameToSlugMap).map(([name, slug]) => [
      name,
      { slug, isIntermediate: metaData.nameToLinksMap[name].isIntermediate }
    ])
  )

  return { content, linksInfo, nameToSlugMap }
}

export default function ShowContent() {
  const { content, linksInfo, nameToSlugMap } = useLoaderData<typeof loader>()
  const bodyElements = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(wikiLinkPlugin, {
      permalinks: Object.values(nameToSlugMap)
        .filter(({ isIntermediate }) => !isIntermediate)
        .map(({ slug }) => `/${slug}`),
      pageResolver: (name: string) =>
        name in nameToSlugMap ? [`/${nameToSlugMap[name].slug}`] : [],
      hrefTemplate: (href: string) => href
    })
    .use(remarkReact as any, { sanitize: schema, createElement })
    .processSync(content.body).result as React.ReactNode

  return (
    <>
      <main>
        <h1>{content.title}</h1>
        {!content.isIntermediate && !content.isRandom && <ShowDate date={content.created!} />}
        {content.isRandom && (
          <>
            <div>
              作成: <ShowDate date={content.created} />
            </div>
            <div>
              更新: <ShowDate date={content.modified} />
            </div>
          </>
        )}
        {bodyElements}
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
