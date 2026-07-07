'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

interface Fila {
  mora_anterior: number
  total_con_mora: number
  numero: number
  nombre: string
  email: string | null
  lectura_anterior: number
  lectura_actual: number
  consumo_kwh: number
  consumo_acumulado: number
  estado_lectura: string
  monto_consumo: number
  monto_cargo_fijo: number
  total_pagar: number
  estado_pago: string
}

interface Reporte {
  periodo: {
    mes: number; anio: number; fecha_vencimiento: string; fecha_corte: string | null
    costo_unitario_kwh: number; cargo_fijo: number; monto_total_factura: number
    lectura_general_anterior: number | null; lectura_general_actual: number | null
  }
  filas: Fila[]
  resumen: {
    total_kwh: number; total_cobrado: number; excedente: number
    consumo_general_kwh: number | null; perdida_kwh: number | null
    parcelas_con_consumo: number; parcelas_total: number
  }
}

export default function ReportePage() {
  const { id } = useParams() as { id: string }
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    fetch(`/api/periodos/${id}/reporte`)
      .then(r => r.json())
      .then(data => data.error ? setError(data.error) : setReporte(data))
  }, [id])

  async function enviarInforme() {
    if (!confirm('¿Enviar el informe de consumo por correo a todos los parceleros con email?')) return
    setEnviando(true)
    setMensaje('')
    const res = await fetch(`/api/periodos/${id}/enviar-informe`, { method: 'POST' })
    const data = await res.json()
    setMensaje(res.ok ? `✅ Informe enviado a ${data.enviados} parceleros` : `❌ ${data.error}`)
    setEnviando(false)
  }

  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!reporte) return <div className="p-8 text-gray-500">Generando reporte...</div>

  const { periodo, filas, resumen } = reporte
  return <ReporteContenido periodo={periodo} filas={filas} resumen={resumen} onEnviar={enviarInforme} enviando={enviando} mensaje={mensaje} />
}

function ReporteContenido({ periodo, filas, resumen, onEnviar, enviando, mensaje }: Reporte & { onEnviar: () => void; enviando: boolean; mensaje: string }) {
  const $ = (n: number) => '$' + Math.round(n).toLocaleString('es-CL')

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-2xl font-bold">Reporte de consumo</h1>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            🖨 Imprimir / PDF
          </button>
          <button
            onClick={onEnviar}
            disabled={enviando}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : '📧 Enviar informe a todos'}
          </button>
        </div>
      </div>

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2 print:hidden">{mensaje}</p>}

      <div className="bg-white rounded-xl border p-6 print:border-0 print:p-0">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">MACROLOTE COPOSA</h2>
          <p className="font-medium">REPORTE CONSUMO ELÉCTRICO — {meses[periodo.mes - 1]} {periodo.anio}</p>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1.5">PARCELA</th>
              <th className="border px-2 py-1.5">PROPIETARIO</th>
              <th className="border px-2 py-1.5">LECT. ANTERIOR</th>
              <th className="border px-2 py-1.5">LECT. ACTUAL</th>
              <th className="border px-2 py-1.5">CONSUMO KWh</th>
              <th className="border px-2 py-1.5 bg-yellow-50">CONSUMO ACUMULADO</th>
              <th className="border px-2 py-1.5">COSTO CONSUMO</th>
              <th className="border px-2 py-1.5">CARGO FIJO</th>
              <th className="border px-2 py-1.5">TOTAL MES</th>
              <th className="border px-2 py-1.5 bg-red-50">MORA ANTERIOR</th>
              <th className="border px-2 py-1.5">TOTAL A PAGAR</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.numero} className={f.estado_lectura ? 'bg-yellow-50' : ''}>
                <td className="border px-2 py-1 text-center font-medium">{f.numero}</td>
                <td className="border px-2 py-1">{f.nombre}</td>
                <td className="border px-2 py-1 text-right">{f.estado_lectura === 'NUEVO' ? 'NUEVO' : f.lectura_anterior}</td>
                <td className="border px-2 py-1 text-right">{f.estado_lectura === 'S/INFO' ? 'S/INFO' : f.estado_lectura === 'DESCONECTADO' ? 'DESCONECT.' : f.lectura_actual}</td>
                <td className="border px-2 py-1 text-right">{f.estado_lectura === 'SALDO A FAVOR' ? 'SALDO AF' : f.consumo_kwh}</td>
                <td className="border px-2 py-1 text-right font-medium bg-yellow-50">{f.consumo_acumulado}</td>
                <td className="border px-2 py-1 text-right">{$(f.monto_consumo)}</td>
                <td className="border px-2 py-1 text-right">{$(f.monto_cargo_fijo)}</td>
                <td className="border px-2 py-1 text-right">{f.estado_lectura === 'DESCONECTADO' ? '—' : $(f.total_pagar)}</td>
                <td className={`border px-2 py-1 text-right ${f.mora_anterior > 0 ? 'text-red-600 font-medium bg-red-50' : 'text-gray-300'}`}>
                  {f.mora_anterior > 0 ? $(f.mora_anterior) : '—'}
                </td>
                <td className="border px-2 py-1 text-right font-bold">
                  {f.estado_lectura === 'DESCONECTADO' ? 'DESCONECTADO' : $(f.total_con_mora)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div className="border rounded-lg p-4">
            <h3 className="font-bold mb-2">RESUMEN DEL MES</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr><td className="py-0.5">Total KWh consumidos parcelas</td><td className="text-right font-medium">{resumen.total_kwh}</td></tr>
                {periodo.lectura_general_anterior != null && (
                  <tr><td className="py-0.5">Lect. medidor COPOSA anterior</td><td className="text-right">{periodo.lectura_general_anterior}</td></tr>
                )}
                {periodo.lectura_general_actual != null && (
                  <tr><td className="py-0.5">Lect. medidor COPOSA actual</td><td className="text-right">{periodo.lectura_general_actual}</td></tr>
                )}
                {resumen.consumo_general_kwh != null && (
                  <tr><td className="py-0.5">Consumo KWh medidor general</td><td className="text-right">{resumen.consumo_general_kwh}</td></tr>
                )}
                {resumen.perdida_kwh != null && (
                  <tr><td className="py-0.5">Pérdida KWh mes (transformador)</td><td className="text-right">{resumen.perdida_kwh}</td></tr>
                )}
                <tr><td className="py-0.5">Costo unitario KWh</td><td className="text-right">{$(periodo.costo_unitario_kwh)}</td></tr>
                <tr><td className="py-0.5">Cargo fijo × {resumen.parcelas_total} parcelas</td><td className="text-right">{$(periodo.cargo_fijo * resumen.parcelas_total)}</td></tr>
                <tr className="border-t"><td className="py-0.5 font-bold">Factura a pagar (IEL S.A.)</td><td className="text-right font-bold">{$(periodo.monto_total_factura)}</td></tr>
                <tr><td className="py-0.5 font-bold">Total cobrado a parcelas</td><td className="text-right font-bold">{$(resumen.total_cobrado)}</td></tr>
                <tr><td className="py-0.5">Excedente</td><td className="text-right">{$(resumen.excedente)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="border rounded-lg p-4 text-xs space-y-2">
            <h3 className="font-bold text-sm mb-2">NOTAS</h3>
            <p>1. S/INFO: no se recibió la lectura en el mes que corresponde; se cobra solo el cargo fijo.</p>
            <p>2. El cargo fijo permite absorber el costo de la energía que se pierde en el transformador de la red BT de COPOSA y el cargo de transmisión.</p>
            <p className="font-bold">
              3. Plazo para pagar: {periodo.fecha_vencimiento ? new Date(periodo.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-CL') : '—'}.
            </p>
            {periodo.fecha_corte && (
              <p className="text-red-600 font-medium">4. Fecha de corte por no pago: {new Date(periodo.fecha_corte + 'T00:00:00').toLocaleDateString('es-CL')}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
