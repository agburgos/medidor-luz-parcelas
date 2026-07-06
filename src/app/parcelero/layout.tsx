import NavBar from '@/components/ui/NavBar'

export default function ParceleroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar rol="parcelero" />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  )
}
