import NavBar from '@/components/ui/NavBar'
import TablasOrdenables from '@/components/ui/TablasOrdenables'
import { getSesion } from '@/lib/auth'

export default async function ParceleroLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar rol="parcelero" esComiteViendoSuParcela={sesion?.rol === 'comite'} />
      <TablasOrdenables />
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  )
}
