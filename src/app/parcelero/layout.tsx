import NavBar from '@/components/ui/NavBar'
import TablasOrdenables from '@/components/ui/TablasOrdenables'

export default function ParceleroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar rol="parcelero" />
      <TablasOrdenables />
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  )
}
