// generate XML file of feeds

import fs from 'fs/promises'
import { Feed } from 'feed'
import remarkParse from 'remark-parse'
import wikiLinkPlugin from 'remark-wiki-link'
import { unified } from 'unified'
import remarkHtml from 'remark-html'
import { compareDateLike, getAllContents } from './contents'
import remarkBreaks from 'remark-breaks'
import { makeDescription } from './utils/makeDescription'

async function generateFeed() {
  const feed = new Feed({
    title: 'odiak.net',
    id: 'https://odiak.net/',
    link: 'https://odiak.net/',
    language: 'ja',
    description: '岩本海童の個人的なウェブサイトです。',
    copyright: 'All rights reserved 2020, Kaido Iwamoto',
    image: 'https://odiak.net/default-image.png',
    favicon: 'https://odiak.net/favicon.png',
    feedLinks: {
      atom: '/atom-feed.xml'
    },
    author: {
      name: 'Kaido Iwamoto',
      email: 'kaido@odiak.net',
      link: 'https://odiak.net/aboutme'
    }
  })

  const contents = await getAllContents()

  contents
    .filter((c) => !c.isIntermediate && !c.isRandom && !c.isArchived)
    .sort((a, b) => -compareDateLike(a.created!, b.created!))
    .forEach((c) => {
      const htmlContent = unified()
        .use(remarkParse)
        .use(remarkBreaks)
        .use(wikiLinkPlugin, {
          permalinks: contents.map((c) => c.slug),
          pageResolver: (name: string) =>
            contents.filter((c) => c.title.toLowerCase() === name.toLowerCase()).map((c) => c.slug),
          hrefTemplate: (slug: string) => `/${slug}`
        })
        .use(remarkHtml)
        .processSync(c.body)
        .toString()

      feed.addItem({
        title: c.title,
        description: makeDescription(c.body),
        id: `https://odiak.net/${c.slug}`,
        link: `https://odiak.net/${c.slug}`,
        date: new Date(`${c.created!.year}-${c.created!.month}-${c.created!.day} 00:00+9:00`),
        content: htmlContent
      })
    })

  const f = await fs.open('./public/atom-feed.xml', 'w')
  await f.write(feed.atom1())
  await f.close()
}

generateFeed()
