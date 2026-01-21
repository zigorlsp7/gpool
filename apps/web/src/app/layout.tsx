import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Football Pool Management',
  description: 'Real-time football pool management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
