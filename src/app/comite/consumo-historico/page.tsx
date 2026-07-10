import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CargarConsumoHistorico from '@/components/comite/CargarConsumoHistorico'

export const metadata = { title: 'Consumo Histórico — COPOSA' }

export default async function ConsumoHistoricoPage() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') redirect('/login')

  const supabase = createServiceClient()
  const { data: historicos } = await supabase
    .from('consumo_historico')
    .select('mes, anio, COUNT(*) as cantidad')
    .group_by('mes,anio')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📊 Consumo Histórico</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CargarConsumoHistorico />

        <div>
          <h2 className="text-lg font-bold mb-4">Períodos Cargados</h2>
          {historicos && historicos.length > 0 ? (
            <div className="bg-white rounded-xl border divide-y">
              {(historicos as any[]).map(h => (
                <div key={`${h.anio}-${h.mes}`} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{meses[h.mes]} {h.anio}</p>
                    <p className="text-sm text-gray-500">{h.cantidad} parcelas</p>
                  </div>
                  <div className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-1">✓ Cargado</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border p-8 text-center text-gray-500">
              <p>No hay períodos cargados</p>
              <p className="text-sm mt-1">Carga uno desde la izquierda</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8">
        <h3 className="font-bold mb-2">📋 Instrucciones</h3>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>Extrae del PDF de consumo: número de parcela, lectura anterior y lectura actual</li>
          <li>Ingresa mes y año del período</li>
          <li>Pega los datos en formato: <code className="bg-white px-1 rounded">parcela anterior actual</code></li>
          <li>Haz clic en "Cargar Consumos"</li>
          <li>Los parceleros verán el consumo en su cuenta de luz</li>
        </ol>
      </div>
    </div>
  )
}
