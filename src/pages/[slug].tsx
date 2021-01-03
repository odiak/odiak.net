import { Content, getAllSlugs, getContent } from '../contents'
import ReactMarkdown from 'react-markdown'
import { GetStaticPaths, GetStaticProps } from 'next'
import { Title } from '../components/Title'
import { ShowDate } from '../components/ShowDate'

type Props = {
  content: Content
}
type Params = {
  slug: string
}

export default function ShowContent({ content }: Props) {
  return (
    <>
      <Title>{content.title}</Title>

      <main>
        <h1>{content.title}</h1>
        <ShowDate date={content.created} />
        <ReactMarkdown>{content.body}</ReactMarkdown>
      </main>
    </>
  )
}

export const getStaticProps: GetStaticProps<Props, Params> = async (context) => {
  const { slug } = context.params!

  const content = getContent(slug)
  return { props: { content } }
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
  return {
    paths: getAllSlugs().map((slug) => ({ params: { slug } })),
    fallback: false
  }
}
