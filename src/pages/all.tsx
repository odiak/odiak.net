import React, { FC } from 'react'
import { GetStaticProps } from 'next'
import { Content, getAllContents } from '../contents'
import Link from 'next/link'
import { MetaData } from '../components/MetaData'

type Props = { contents: Content[] }
type Params = {}
const All: FC<Props> = ({ contents }) => (
  <>
    <MetaData title="ページ一覧" />
    <h2>ページ一覧</h2>
    <ul>
      {contents.map((c) => (
        <li key={c.slug}>
          <Link href={`/${c.slug}`}>{c.title}</Link>
          {c.isIntermediate && '* '}
        </li>
      ))}
    </ul>
  </>
)
export default All

export const getStaticProps: GetStaticProps<Props, Params> = async () => {
  const contents = await (await getAllContents()).map((c): Content => ({ ...c, rawData: null }))

  return { props: { contents } }
}
