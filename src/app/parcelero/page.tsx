import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeedAnuncios from '@/components/parcelero/FeedAnuncios'
import AvisoLectura from '@/components/parcelero/AvisoLectura'

export default async function ParceleroDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!parcela) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-2">Bienvenido</h1>
        <p className="text-gray-500">Tu cuenta aún no está vinculada a ninguna parcela. Contacta al comité.</p>
      </div>
    )
  }

  const [{ data: cuentas }, { data: cuentaGC }, { data: moras }, { data: infoFija }, { data: documentos }] = await Promise.all([
    supabase
      .from('cuentas_parcela')
      .select('monto_prorrateado, monto_pagado')
      .eq('parcela_id', parcela.id),
    supabase
      .from('cuentas_gc')
      .select('monto, monto_pagado')
      .eq('parcela_id', parcela.id),
    supabase
      .from('moras_anteriores')
      .select('monto, monto_pagado, estado')
      .eq('parcela_id', parcela.id),
    supabase
      .from('informacion_fija')
      .select('id, titulo, contenido')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('documentos')
      .select('id, nombre, categoria, archivo_url, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  const deudaLuz = (cuentas ?? []).reduce((s: number, c: { monto_prorrateado: number; monto_pagado: number }) => s + Math.max(c.monto_prorrateado - c.monto_pagado, 0), 0)
  const deudaGC = (cuentaGC ?? []).reduce((s: number, c: { monto: number; monto_pagado: number }) => s + Math.max(c.monto - c.monto_pagado, 0), 0)
  const morasPendientes = (moras ?? []).filter((m: { estado: string }) => m.estado !== 'pagado')
  const deudaMoras = morasPendientes.reduce((s: number, m: { monto: number; monto_pagado: number }) => s + Math.max(Number(m.monto) - Number(m.monto_pagado), 0), 0)
  const deudaTotal = deudaLuz + deudaGC + deudaMoras

  const CATEGORIAS: Record<string, string> = { acta: '📋 Acta', contable: '💰 Contable', reglamento: '📜 Reglamento', general: '📄 General' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Hola, {parcela.nombre_dueno}</h1>
      <p className="text-gray-500 mb-6">Parcela #{parcela.numero}</p>

      <AvisoLectura />

      {/* Grandes números */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className={`rounded-xl border p-4 ${deudaTotal > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-xs text-gray-500">Deuda total</p>
          <p className={`text-2xl font-bold ${deudaTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {deudaTotal > 0 ? $(deudaTotal) : 'Al día ✓'}
          </p>
        </div>
        <Link href="/parcelero/luz" className="rounded-xl border p-4 bg-white hover:bg-gray-50 transition-colors">
          <p className="text-xs text-gray-500">⚡ Deuda Luz</p>
          <p className={`text-2xl font-bold ${deudaLuz > 0 ? 'text-red-600' : 'text-green-600'}`}>{deudaLuz > 0 ? $(deudaLuz) : 'Al día ✓'}</p>
        </Link>
        <Link href="/parcelero/gastos-comunes" className="rounded-xl border p-4 bg-white hover:bg-gray-50 transition-colors">
          <p className="text-xs text-gray-500">🏘️ Deuda Gastos Comunes</p>
          <p className={`text-2xl font-bold ${deudaGC > 0 ? 'text-red-600' : 'text-green-600'}`}>{deudaGC > 0 ? $(deudaGC) : 'Al día ✓'}</p>
        </Link>
      </div>

      <FeedAnuncios />

      {/* Información fija */}
      <h2 className="text-lg font-semibold mb-3 mt-8">ℹ️ Información importante</h2>
      <div className="space-y-3 mb-6">
        {(infoFija ?? []).map((i: { id: string; titulo: string; contenido: string }) => (
          <div key={i.id} className="bg-white rounded-xl border p-5">
            <h3 className="font-bold mb-2">{i.titulo}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{i.contenido}</p>
          </div>
        ))}
        {(!infoFija || infoFija.length === 0) && (
          <div className="bg-white rounded-xl border p-5 text-gray-400 text-sm">Sin información publicada aún</div>
        )}
        <Link href="/parcelero/informacion" className="inline-block text-sm text-blue-700 hover:underline font-medium">
          Ver toda la información →
        </Link>
      </div>

      {/* Documentos */}
      <h2 className="text-lg font-semibold mb-3 mt-8">📎 Documentos</h2>
      <div className="bg-white rounded-xl border overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Documento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(documentos ?? []).map((d: { id: string; nombre: string; categoria: string; archivo_url: string; created_at: string }) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.nombre}</td>
                <td className="px-4 py-2">{CATEGORIAS[d.categoria] ?? d.categoria}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(d.created_at).toLocaleDateString('es-CL')}</td>
                <td className="px-4 py-2"><a href={d.archivo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver</a></td>
              </tr>
            ))}
            {(!documentos || documentos.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aún no hay documentos publicados</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Link href="/parcelero/documentos" className="inline-block text-sm text-blue-700 hover:underline font-medium">
        Ver todos los documentos →
      </Link>
    </div>
  )
}
