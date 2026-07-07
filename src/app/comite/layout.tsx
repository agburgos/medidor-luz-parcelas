import NavBar from '@/components/ui/NavBar'
import TablasOrdenables from '@/components/ui/TablasOrdenables'
import { getSesion } from '@/lib/auth'

export default async function ComiteLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar rol="comite" tieneParcelaPropia={!!sesion?.parcelaId} />
      <TablasOrdenables />
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  )
}
