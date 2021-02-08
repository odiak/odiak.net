import { FC } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const websiteName = 'odiak.net'
const defaultImage = 'https://odiak.net/default-image.png'
const defaultDescription = '岩本海童(odiak)の個人的なウェブサイトです。'

export const MetaData: FC<{ title?: string; description?: string }> = ({
  title,
  description = defaultDescription
}) => {
  const { asPath: path } = useRouter()

  return (
    <Head>
      <title>
        {title != null && title !== '' ? `${title} - ` : ''}
        {websiteName}
      </title>
      <link rel="alternate" href="/atom-feed.xml" type="application/atom+xml" />
      <meta name="description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title || websiteName} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={defaultImage} />
      <meta property="og:url" content={`https://odiak.net${path}`} />
      <meta property="og:locale" content="ja_JP" />
      <meta property="og:site_name" content={websiteName} />
      <meta name="twitter:card" content="summary" />
    </Head>
  )
}
