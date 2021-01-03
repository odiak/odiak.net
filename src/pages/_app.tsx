import Link from 'next/link'
import React from 'react'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: { Component: React.FC; pageProps: any }) {
  return (
    <>
      <header>
        <Link href="/">岩本海童のWebサイト</Link>
      </header>
      <Component {...pageProps} />
      <footer>&copy; 2021 Kaido Iwamoto</footer>
    </>
  )
}

export default MyApp
