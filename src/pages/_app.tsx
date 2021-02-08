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

      <header className="main-header">
        <Link href="/">odiak.net</Link>
      </header>
      <Component {...pageProps} />
      <footer>
        &copy; 2021 Kaido Iwamoto; <a href="https://github.com/odiak/odiak.net">source code</a>
      </footer>
    </>
  )
}

export default MyApp
