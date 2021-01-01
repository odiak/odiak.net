import React from 'react'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: { Component: React.FC; pageProps: any }) {
  return <Component {...pageProps} />
}

export default MyApp
