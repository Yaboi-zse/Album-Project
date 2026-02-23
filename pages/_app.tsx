// pages/_app.tsx
import type { AppProps } from 'next/app'
import { Analytics } from '@vercel/analytics/next'
import Header from '../src/components/Header'
import '../styles/globals.css'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Header />
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}