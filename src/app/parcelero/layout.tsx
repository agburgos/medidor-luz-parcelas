import NavBar from '@/components/ui/NavBar'
import TablasOrdenables from '@/components/ui/TablasOrdenables'
import BotonPanico from '@/components/parcelero/BotonPanico'
import { getSesion } from '@/lib/auth'

export default async function ParceleroLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        rol="parcelero"
        esComiteViendoSuParcela={!!sesion?.suplantando || sesion?.rol === 'comite'}
        suplantando={sesion?.suplantando ?? null}
      />
      <TablasOrdenables />
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">{children}</main>
      <BotonPanico />
    </div>
  )
}
