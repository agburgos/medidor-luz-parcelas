'use client'

import { useState } from 'react'

interface Pregunta {
  q: string
  a: string
}

interface Seccion {
  titulo: string
  icon: string
  preguntas: Pregunta[]
}

const SECCIONES: Seccion[] = [
  {
    titulo: 'Cuenta de luz',
    icon: '⚡',
    preguntas: [
      {
        q: '¿Cómo subo mi lectura del medidor?',
        a: 'Entra a "Cuenta de luz" en el menú "Mi macrolote". Si hay un período abierto, verás un aviso arriba para subir tu lectura. Anota el número que marca tu medidor y sube una foto donde se vea claro. Puedes elegir la foto desde tu cámara o desde la galería.',
      },
      {
        q: '¿Qué pasa si mi lectura fue rechazada?',
        a: 'El comité te indicará el motivo (por ejemplo, foto poco clara o número ilegible). Vuelve a la sección "Cuenta de luz" y envía la lectura nuevamente con una foto más clara.',
      },
      {
        q: '¿Cómo se calcula lo que debo pagar?',
        a: 'El monto total de la factura eléctrica se reparte entre todas las parcelas según su consumo real (diferencia entre tu lectura actual y la anterior), más un cargo fijo igual para todos.',
      },
      {
        q: '¿Dónde veo mi historial de consumo?',
        a: 'En "Cuenta de luz" encontrarás un gráfico con tu consumo de los últimos períodos, además del detalle de cada cuenta (monto, estado de pago y vencimiento).',
      },
    ],
  },
  {
    titulo: 'Gastos comunes y pagos',
    icon: '🏘️',
    preguntas: [
      {
        q: '¿Cómo informo un pago?',
        a: 'Ve a "Cuenta de luz" o "Gasto Común COPOSA" y busca el botón "Informar un pago". Sube tu comprobante de transferencia; el comité lo validará y actualizará tu estado de cuenta.',
      },
      {
        q: '¿Qué significan los estados de mi cuenta?',
        a: 'Pendiente: aún no pagas. Pago parcial: pagaste una parte. Pagado: al día. Mora: la cuenta venció sin pago completo.',
      },
    ],
  },
  {
    titulo: 'Transparencia (Caja)',
    icon: '🏦',
    preguntas: [
      {
        q: '¿Puedo ver en qué se gasta el dinero de la comunidad?',
        a: 'Sí. En el menú "Caja y Tesorería" ves exactamente los mismos movimientos de ingresos y egresos que ve el comité, en modo solo lectura. También puedes revisar el Libro Contable con el detalle mes a mes.',
      },
      {
        q: '¿Por qué no veo la deuda de mis vecinos?',
        a: 'Por privacidad, el estado de cuenta consolidado muestra totales de la comunidad (cuántas parcelas están al día, deuda total), pero no expone la situación financiera individual de cada vecino.',
      },
    ],
  },
  {
    titulo: 'Votaciones',
    icon: '🗳️',
    preguntas: [
      {
        q: '¿Cómo voto?',
        a: 'Cuando hay una votación abierta, aparece un aviso en tu pantalla de inicio y en el menú "Votaciones". Entra, elige tu opción (o varias, si la votación lo permite) y confirma. Solo puedes votar una vez por parcela.',
      },
      {
        q: '¿Puedo ver los resultados?',
        a: 'Depende de cómo el comité configuró esa votación en particular: algunas muestran resultados en vivo, otras solo al cerrar.',
      },
    ],
  },
  {
    titulo: 'Asambleas y actas',
    icon: '🗓️',
    preguntas: [
      {
        q: '¿Dónde veo las asambleas citadas?',
        a: 'En el menú "Asambleas y actas" verás fecha, lugar y estado de cada una. Al hacer clic puedes ver acuerdos tomados y documentos asociados (como el acta).',
      },
      {
        q: '¿Puedo agregar la reunión a mi calendario?',
        a: 'Sí, cada asamblea tiene un link "📅 Agregar a Google Calendar" que prellena el evento con fecha, hora y lugar.',
      },
    ],
  },
  {
    titulo: 'Mensajería con el comité',
    icon: '💬',
    preguntas: [
      {
        q: '¿Cómo hago un reclamo o una sugerencia?',
        a: 'Ve a "Mensajería con el comité", elige el tipo (reclamo, denuncia, sugerencia o felicitación), escribe tu mensaje y puedes adjuntar una foto o archivo. El comité responderá dentro de la misma conversación.',
      },
      {
        q: '¿Puedo seguir la conversación después de la respuesta?',
        a: 'Sí, puedes responder (replicar) dentro del mismo hilo cuantas veces sea necesario, hasta que el comité marque el mensaje como cerrado.',
      },
    ],
  },
  {
    titulo: 'Documentos y mi registro',
    icon: '📎',
    preguntas: [
      {
        q: '¿Dónde encuentro el reglamento y otros documentos oficiales?',
        a: 'En el menú "Documentos" encuentras reglamentos, actas y documentos contables publicados por el comité.',
      },
      {
        q: '¿Qué es "Mi registro"?',
        a: 'Es donde mantienes actualizadas las personas que viven o trabajan en tu parcela y tus mascotas. Esta información la usa la directiva para control de acceso y seguridad.',
      },
    ],
  },
]

export default function AyudaPage() {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const q = busqueda.trim().toLowerCase()
  const seccionesFiltradas = SECCIONES
    .map(s => ({
      ...s,
      preguntas: s.preguntas.filter(p =>
        !q || p.q.toLowerCase().includes(q) || p.a.toLowerCase().includes(q)
      ),
    }))
    .filter(s => s.preguntas.length > 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">❓ Ayuda y preguntas frecuentes</h1>
      <p className="text-gray-500 text-sm mb-6">Manual de uso del sistema COPOSA para parceleros</p>

      <input
        type="text"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar una pregunta..."
        className="w-full border rounded-lg px-4 py-2.5 text-sm mb-6"
      />

      <div className="space-y-6">
        {seccionesFiltradas.map(seccion => (
          <div key={seccion.titulo}>
            <h2 className="text-lg font-semibold mb-3">{seccion.icon} {seccion.titulo}</h2>
            <div className="space-y-2">
              {seccion.preguntas.map(p => {
                const key = `${seccion.titulo}-${p.q}`
                const abiertaAhora = abierta === key
                return (
                  <div key={key} className="bg-white rounded-xl border overflow-hidden">
                    <button
                      onClick={() => setAbierta(abiertaAhora ? null : key)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <span className="font-medium text-sm">{p.q}</span>
                      <span className="text-gray-400 text-xs">{abiertaAhora ? '▲' : '▼'}</span>
                    </button>
                    {abiertaAhora && (
                      <div className="px-4 pb-4 text-sm text-gray-600 border-t pt-3">{p.a}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {seccionesFiltradas.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            Sin resultados para &quot;{busqueda}&quot;
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>¿No encontraste lo que buscabas?</strong> Escríbele al comité directamente desde{' '}
          <a href="/parcelero/mensajes" className="underline">Mensajería con el comité</a>.
        </p>
      </div>
    </div>
  )
}
