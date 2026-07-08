import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Bienvenida — COPOSA' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
