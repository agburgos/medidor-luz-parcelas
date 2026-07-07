'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface LecturaPendiente {
  id: string
  lectura_actual: number
  lectura_anterior: number
  foto_url: string | null
  created_at: string
  parcela: { numero: number; nombre_dueno: string }
}

interface Resumen {
  total_parcelas: number
  aprobadas: number
  pendientes: number
  sin_enviar: { numero: number; nombre: string }[]
}

export default function ValidarLecturasPage() {
  const [periodo, setPeriodo] = useState<{ id: string; mes: number; anio: number } | null>(null)
  const [pendientes, setPendientes] = useState<LecturaPendiente[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [procesando, setProcesando] = useState<string | null>(null)
  const [correcciones, setCorrecciones] = useState<Record<string, string>>({})

  const cargar = useCallback(async () => {
    const res = await fetch('/api/lecturas/pendientes')
    const data = await res.json()
    setPeriodo(data.periodo)
    setPendientes(data.pendientes ?? [])
    setResumen(data.resumen)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function validar(l: LecturaPendiente, accion: 'aprobar' | 'rechazar') {
    let motivo: string | null = null
    if (accion === 'rechazar') {
      motivo = window.prompt('Motivo del rechazo (el parcelero lo verá y podrá reenviar):', 'Foto ilegible')
      if (motivo === null) return
    }
    setProcesando(l.id)
    const correccion = correcciones[l.id]
    const res = await fetch(`/api/lecturas/${l.id}/validar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion,
        motivo,
        lectura_corregida: correccion !== undefined && correccion !== '' ? Number(correccion) : null,
      }),
    })
    const data = await res.json()
    setMensaje(res.ok
      ? accion === 'aprobar' ? `✅ Lectura de #${l.parcela.numero} aprobada` : `🚫 Lectura de #${l.parcela.numero} rechazada`
      : `❌ ${data.error}`)
    setProcesando(null)
    await cargar()
  }

  if (loading) return <div className="p-8 text-gray-500">Cargando lecturas...</div>
  if (!periodo) return <div className="p-8 text-gray-400">No hay período abierto. Crea uno en Períodos.</div>

  const todasListas = resumen && resumen.aprobadas === resumen.total_parcelas

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Validación de lecturas</h1>
          <p className="text-gray-500 text-sm">{meses[periodo.mes - 1]} {periodo.anio}</p>
        </div>
        {todasListas ? (
          <Link
            href={`/comite/periodos/${periodo.id}/lecturas`}
            className="bg-green-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-green-700"
          >
            ✅ Todas validadas — Ir a calcular prorrateo →
          </Link>
        ) : (
          <Link
            href={`/comite/periodos/${periodo.id}/lecturas`}
            className="text-sm text-blue-600 hover:underline"
          >
            Ingresar lecturas manualmente →
          </Link>
        )}
      </div>

      {resumen && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Aprobadas</p>
            <p className="text-2xl font-bold text-green-600">{resumen.aprobadas}/{resumen.total_parcelas}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Por validar</p>
            <p className="text-2xl font-bold text-orange-600">{resumen.pendientes}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Sin enviar</p>
            <p className="text-2xl font-bold text-red-600">{resumen.sin_enviar.length}</p>
          </div>
        </div>
      )}

      {mensaje && <p className="mb-4 text-sm bg-blue-50 text-blue-800 rounded p-2">{mensaje}</p>}

      <h2 className="text-lg font-semibold mb-3">📸 Lecturas por validar</h2>
      {pendientes.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 mb-8">
          No hay lecturas esperando validación
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {pendientes.map(l => {
            const consumo = l.lectura_actual - l.lectura_anterior
            return (
              <div key={l.id} className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-44">
                  <p className="font-medium">#{l.parcela.numero} — {l.parcela.nombre_dueno}</p>
                  <p className="text-sm text-gray-500">
                    Anterior: {l.lectura_anterior} → Informada: <strong>{l.lectura_actual}</strong>
                    {' '}(consumo {consumo >= 0 ? consumo : <span className="text-red-500">{consumo} ⚠️</span>} kWh)
                  </p>
                </div>
                {l.foto_url ? (
                  <a href={l.foto_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.foto_url} alt="Foto medidor" className="h-20 rounded-lg border object-cover hover:opacity-80" />
                  </a>
                ) : (
                  <span className="text-xs text-red-500">Sin foto</span>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={String(l.lectura_actual)}
                    value={correcciones[l.id] ?? ''}
                    onChange={e => setCorrecciones(c => ({ ...c, [l.id]: e.target.value }))}
                    title="Corregir lectura según la foto (opcional)"
                    className="border rounded-lg px-2 py-2 text-sm w-24 text-right"
                  />
                  <button
                    onClick={() => validar(l, 'aprobar')}
                    disabled={procesando === l.id}
                    className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ OK
                  </button>
                  <button
                    onClick={() => validar(l, 'rechazar')}
                    disabled={procesando === l.id}
                    className="border border-red-300 text-red-600 rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resumen && resumen.sin_enviar.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">⏳ Aún no envían su lectura ({resumen.sin_enviar.length})</h2>
          <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-2">
            {resumen.sin_enviar.map(p => (
              <span key={p.numero} className="text-xs bg-red-50 text-red-700 rounded-full px-3 py-1">
                #{p.numero} {p.nombre}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Estas parcelas reciben recordatorios automáticos según la fecha tope configurada en Configuración.
            También puedes ingresar sus lecturas manualmente desde el período.
          </p>
        </>
      )}
    </div>
  )
}
