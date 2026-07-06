import NavBar from '@/components/ui/NavBar'

export default function ComiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar rol="comite" />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  )
}
