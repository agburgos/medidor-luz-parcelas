'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface Estado {
  periodo: { id: string; mes: number; anio: number } | null
  sin_empalme?: boolean
  fecha_tope?: string
  mi_lectura?: { estado_validacion: string } | null
}

// Aviso breve en la página principal cuando hay un período abierto sin lectura
// enviada (o rechazada), con link directo al formulario de autolectura.
export default function AvisoLectura() {
  const [estado, setEstado] = useState<Estado | null>(null)

  useEffect(() => {
    fetch('/api/lecturas/informar').then(r => r.json()).then(setEstado).catch(() => {})
  }, [])

  if (!estado || estado.sin_empalme || !estado.periodo) return null
  if (estado.mi_lectura && ['pendiente', 'aprobada'].includes(estado.mi_lectura.estado_validacion)) return null

  const rechazada = estado.mi_lectura?.estado_validacion === 'rechazada'
  const nombrePeriodo = `${meses[estado.periodo.mes - 1]} ${estado.periodo.anio}`
  const tope = estado.fecha_tope ? new Date(estado.fecha_tope + 'T23:59:59') : null
  const vencido = tope ? tope.getTime() < Date.now() : false

  return (
    <Link
      href="/parcelero/luz"
      className={`block rounded-xl border p-4 mb-6 hover:opacity-90 transition-opacity ${
        rechazada || vencido ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'
      }`}
    >
      <p className={`font-medium ${rechazada || vencido ? 'text-red-800' : 'text-blue-800'}`}>
        {rechazada
          ? `❌ Tu lectura de ${nombrePeriodo} fue rechazada — vuelve a enviarla`
          : `📸 Nuevo período abierto: ${nombrePeriodo} — sube tu lectura de medidor`}
      </p>
      <p className="text-sm text-gray-600 mt-0.5">
        {tope && `Plazo: hasta el ${tope.toLocaleDateString('es-CL')}. `}Haz clic aquí para subirla →
      </p>
    </Link>
  )
}
