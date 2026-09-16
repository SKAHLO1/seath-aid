import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Courier_Prime } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

const TITLE = 'Seath Aid — Prove a medical fact without revealing the record'
const DESCRIPTION =
  'Patients hold medical facts privately and generate zero-knowledge proofs of specific claims via a Midnight Compact smart contract. Verifiers see pass or fail, never the underlying data.'

export const metadata: Metadata = {
  // Resolves the relative icon and OG URLs below into absolute ones, which is
  // what crawlers and link unfurlers require. Set NEXT_PUBLIC_SITE_URL to the
  // deployed origin on Vercel; localhost is only a sensible dev default.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'Midnight Network',
    'zero-knowledge proofs',
    'Compact',
    'verifiable credentials',
    'health records',
    'selective disclosure',
  ],
  authors: [{ name: 'Seath Aid' }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    siteName: 'Seath Aid',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Seath Aid — proof without exposure',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
