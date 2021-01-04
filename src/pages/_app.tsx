import Head from 'next/head'
import Link from 'next/link'
import { FC } from 'react'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: { Component: FC; pageProps: any }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.png" />
      </Head>

      <header>
        <Link href="/">odiak.net</Link>
      </header>
      <Component {...pageProps} />
      <footer>&copy; 2021 Kaido Iwamoto</footer>
    </>
  )
}

export default MyApp
