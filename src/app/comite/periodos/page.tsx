import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function PeriodosPage() {
  const supabase = await createClient()
  const { data: periodos } = await supabase
    .from('periodos_facturacion')
    .select('*')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Períodos de facturación</h1>
        <Link href="/comite/periodos/nuevo" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
          + Nuevo período
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Monto factura</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vencimiento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Corte</th>
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
                <td className="px-4 py-3">{p.fecha_corte ? new Date(p.fecha_corte + 'T00:00:00').toLocaleDateString('es-CL') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-3">
                  <Link href={`/comite/periodos/${p.id}`} className="text-blue-600 hover:underline">Ver</Link>
                  <Link href={`/comite/periodos/${p.id}/cuentas`} className="text-gray-600 hover:underline">Cuentas</Link>
                </td>
              </tr>
            ))}
            {(!periodos || periodos.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin períodos registrados. Crea el primero.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
