import { NavigationBar } from '@/components/NavigationBar'
import { RUMProvider } from '@/components/RUMProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { I18nProvider } from '@/i18n/client'
import { getLocale, getMessages, getTranslator } from '@/i18n/server'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator()

  return {
    title: t('layout.metadata.title'),
    description: t('layout.metadata.description'),
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages(locale)

  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <AuthProvider>
            <RUMProvider>
              <NavigationBar />
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#4caf50',
                      secondary: 'white',
                    },
                    style: {
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      border: '1px solid #81c784',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#f44336',
                      secondary: 'white',
                    },
                    style: {
                      background: '#ffebee',
                      color: '#c62828',
                      border: '1px solid #ef9a9a',
                    },
                  },
                }}
              />
            </RUMProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
