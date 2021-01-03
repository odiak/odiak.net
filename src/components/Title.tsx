import { FC } from 'react'
import Head from 'next/head'

export const Title: FC<{ children?: string }> = ({ children }) => (
  <Head>
    <title>{children != null && children !== '' ? `${children} - ` : ''}岩本海童のWebサイト</title>
  </Head>
)
