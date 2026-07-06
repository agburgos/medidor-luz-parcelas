import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function PeriodoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('*')
    .eq('id', id)
    .single()

  if (!periodo) notFound()

  const [{ data: lecturas, count: totalLecturas }, { data: cuentas }] = await Promise.all([
    supabase
      .from('lecturas')
      .select('*, parcela:parcelas(numero,nombre_dueno)', { count: 'exact' })
      .eq('periodo_id', id)
      .order('parcela(numero)', { ascending: true }),
    supabase
      .from('cuentas_parcela')
      .select('estado')
      .eq('periodo_id', id),
  ])

  const resumen = {
    pagado: cuentas?.filter(c => c.estado === 'pagado').length ?? 0,
    mora: cuentas?.filter(c => c.estado === 'mora').length ?? 0,
    pendiente: cuentas?.filter(c => ['pendiente','pago_parcial'].includes(c.estado)).length ?? 0,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{meses[periodo.mes - 1]} {periodo.anio}</h1>
          <p className="text-gray-500 text-sm">Vencimiento: {new Date(periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL')}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${periodo.estado === 'abierto' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {periodo.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Monto total</p>
          <p className="text-xl font-bold text-blue-700">${periodo.monto_total_factura?.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Lecturas cargadas</p>
          <p className="text-xl font-bold">{totalLecturas ?? 0}/80</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Pagados</p>
          <p className="text-xl font-bold text-green-600">{resumen.pagado}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">En mora</p>
          <p className="text-xl font-bold text-red-600">{resumen.mora}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap mb-8">
        <Link href={`/comite/periodos/${id}/lecturas`} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700">
          Cargar / revisar lecturas
        </Link>
        <Link href={`/comite/periodos/${id}/cuentas`} className="border border-blue-600 text-blue-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-50">
          Gestionar cuentas y pagos
        </Link>
        <Link href={`/comite/periodos/${id}/reporte`} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700">
          📄 Reporte de consumo
        </Link>
        {periodo.archivo_factura_url && (
          <a href={periodo.archivo_factura_url} target="_blank" rel="noreferrer" className="text-gray-600 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Ver factura
          </a>
        )}
      </div>

      {lecturas && lecturas.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Lecturas registradas</h2>
          <div className="bg-white rounded-xl border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Parcela</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dueño</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. anterior</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Lect. actual</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Consumo kWh</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Confirmado</th>
                </tr>
              </thead>
              <tbody>
                {lecturas.map(l => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2">#{(l.parcela as { numero: number })?.numero}</td>
                    <td className="px-4 py-2">{(l.parcela as { nombre_dueno: string })?.nombre_dueno}</td>
                    <td className="px-4 py-2 text-right">{l.lectura_anterior}</td>
                    <td className="px-4 py-2 text-right">{l.lectura_actual}</td>
                    <td className="px-4 py-2 text-right font-medium">{l.consumo_kwh}</td>
                    <td className="px-4 py-2 text-center">{l.confirmado ? '✅' : '⏳'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
