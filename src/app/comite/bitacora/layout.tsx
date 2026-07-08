import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Bitácora — COPOSA' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
