'use client'

interface Consumo {
  mes: number
  anio: number
  kwh: number
  periodo_descripcion: string | null
}

export default function GraficoConsumoHistorico({ consumos }: { consumos: Consumo[] }) {
  if (!consumos || consumos.length === 0) return null

  const ordenados = [...consumos].sort((a, b) => a.anio * 12 + a.mes - (b.anio * 12 + b.mes))
  const maxKwh = Math.max(...ordenados.map(c => c.kwh), 100)
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-bold mb-4">📊 Consumo Histórico (kWh)</h2>

      <div className="space-y-6">
        {/* Gráfico de barras */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-end justify-between gap-1 h-48">
            {ordenados.map(c => {
              const altura = (c.kwh / maxKwh) * 100
              return (
                <div key={`${c.anio}-${c.mes}`} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-32">
                    <div
                      className="bg-blue-500 rounded-t-lg w-full hover:bg-blue-600 transition-colors cursor-pointer relative group"
                      style={{ height: `${Math.max(altura, 5)}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 mb-1 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                        {c.kwh} kWh
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">
                    {meses[c.mes]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.anio}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabla de detalle */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Detalles</h3>
          <div className="bg-gray-50 rounded-lg divide-y text-sm">
            {ordenados.map(c => (
              <div key={`${c.anio}-${c.mes}`} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">
                    {meses[c.mes]} {c.anio}
                    {c.periodo_descripcion && <span className="text-xs text-gray-500 ml-2">({c.periodo_descripcion})</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{c.kwh} kWh</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-gray-600">Promedio</p>
            <p className="text-lg font-bold text-blue-600">
              {Math.round(ordenados.reduce((s, c) => s + c.kwh, 0) / ordenados.length)} kWh
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-gray-600">Mínimo</p>
            <p className="text-lg font-bold text-green-600">
              {Math.min(...ordenados.map(c => c.kwh))} kWh
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-gray-600">Máximo</p>
            <p className="text-lg font-bold text-orange-600">
              {Math.max(...ordenados.map(c => c.kwh))} kWh
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
