const websiteName = 'odiak.net'
const defaultImage = 'https://odiak.net/default-image.png'
const defaultDescription = '岩本海童(odiak)の個人的なウェブサイトです。'

export function defaultMeta({
  title,
  description = defaultDescription,
  image = defaultImage,
  path
}: {
  title?: string
  description?: string
  image?: string
  path: string
}) {
  const pageTitle = title != null && title !== '' ? `${title} - ${websiteName}` : websiteName
  const displayTitle = title || websiteName

  return [
    { title: pageTitle },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: displayTitle },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: `https://odiak.net${path}` },
    { property: 'og:locale', content: 'ja_JP' },
    { property: 'og:site_name', content: websiteName },
    { name: 'twitter:card', content: 'summary' }
  ]
}
