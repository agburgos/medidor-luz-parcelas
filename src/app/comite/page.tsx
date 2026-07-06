import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ComiteDashboard() {
  const supabase = await createClient()

  const [{ count: totalParcelas }, { data: periodos }] = await Promise.all([
    supabase.from('parcelas').select('*', { count: 'exact', head: true }),
    supabase
      .from('periodos_facturacion')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .limit(5),
  ])

  const periodoActivo = periodos?.find(p => p.estado === 'abierto')

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Comité</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total parcelas</p>
          <p className="text-3xl font-bold text-blue-700">{totalParcelas ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Período activo</p>
          <p className="text-xl font-semibold">
            {periodoActivo
              ? `${meses[periodoActivo.mes - 1]} ${periodoActivo.anio}`
              : 'Sin período activo'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Vencimiento</p>
          <p className="text-xl font-semibold text-orange-600">
            {periodoActivo?.fecha_vencimiento
              ? new Date(periodoActivo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')
              : '—'}
          </p>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap mb-8">
        <Link href="/comite/periodos/nuevo" className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
          + Nuevo período
        </Link>
        {periodoActivo && (
          <Link href={`/comite/periodos/${periodoActivo.id}`} className="border border-blue-600 text-blue-600 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-50 transition-colors">
            Ver período activo
          </Link>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-3">Últimos períodos</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Monto factura</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {periodos?.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{meses[p.mes - 1]} {p.anio}</td>
                <td className="px-4 py-3">${p.monto_total_factura?.toLocaleString('es-CL')}</td>
                <td className="px-4 py-3">{p.fecha_vencimiento ? new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/comite/periodos/${p.id}`} className="text-blue-600 hover:underline">Ver</Link>
                </td>
              </tr>
            ))}
            {(!periodos || periodos.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Sin períodos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
