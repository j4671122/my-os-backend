import './globals.css'

export const metadata = { title: 'My OS', description: '내 운영체제' }

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
