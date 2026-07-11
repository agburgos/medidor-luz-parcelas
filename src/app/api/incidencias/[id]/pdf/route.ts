import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import PDFDocument from 'pdfkit'
import { CATEGORIAS_INCIDENCIA } from '@/lib/incidenciasNotificar'

const ESTADOS: Record<string, string> = {
  activa: 'Activa',
  investigando: 'Investigando',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado / Falsa alarma',
}

// Reporte PDF de una incidencia (comité) — para archivo o entrega a autoridades
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: inc, error } = await supabase
    .from('incidencias')
    .select('*, parcela:parcelas(numero, nombre_dueno, telefono, email), documentos:incidencia_documentos(archivo_url, tipo, fecha_subida)')
    .eq('id', id)
    .single()

  if (error || !inc) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const categoriaTxt = CATEGORIAS_INCIDENCIA[inc.categoria] ?? inc.categoria
  const fechaActivacion = new Date(inc.fecha_activacion).toLocaleString('es-CL')

  doc.fontSize(18).fillColor('#dc2626').text('🚨 Reporte de Incidencia — COPOSA')
  doc.moveDown(0.5)
  doc.fontSize(10).fillColor('#666').text(`Generado: ${new Date().toLocaleString('es-CL')}`)
  doc.moveDown(1)

  doc.fontSize(12).fillColor('#000')
  doc.text(`Parcela: #${inc.parcela.numero} — ${inc.parcela.nombre_dueno}`)
  doc.text(`Teléfono: ${inc.parcela.telefono || '—'}`)
  doc.text(`Categoría: ${categoriaTxt}`)
  doc.text(`Estado: ${ESTADOS[inc.estado] ?? inc.estado}`)
  doc.text(`Fecha/hora activación: ${fechaActivacion}`)
  if (inc.fecha_resolucion) {
    doc.text(`Fecha/hora resolución: ${new Date(inc.fecha_resolucion).toLocaleString('es-CL')}`)
  }
  if (inc.latitud != null && inc.longitud != null) {
    doc.text(`Ubicación: https://www.google.com/maps?q=${inc.latitud},${inc.longitud}`)
  }
  doc.moveDown(0.5)

  if (inc.descripcion) {
    doc.fontSize(11).fillColor('#000').text('Descripción del incidente:', { underline: true })
    doc.fontSize(10).text(inc.descripcion)
    doc.moveDown(0.5)
  }

  if (inc.notas_resolucion) {
    doc.fontSize(11).fillColor('#000').text('Notas de resolución:', { underline: true })
    doc.fontSize(10).text(inc.notas_resolucion)
    doc.moveDown(0.5)
  }

  const noti = inc.notificaciones_enviadas || {}
  doc.fontSize(11).fillColor('#000').text('Notificaciones enviadas:', { underline: true })
  doc.fontSize(10).text(`Email a parceleros: ${noti.email_parceleros ?? 0} · WhatsApp a parceleros: ${noti.whatsapp_parceleros ?? 0}`)
  doc.text(`Portería — Email: ${noti.email_porteria ? 'Sí' : 'No'} · WhatsApp: ${noti.whatsapp_porteria ? 'Sí' : 'No'}`)
  if (noti.modo_pruebas) {
    doc.fillColor('#b91c1c').text('⚠️ Se envió en modo de pruebas (solo al correo de pruebas)')
  }
  doc.moveDown(0.5)

  const docs = (inc.documentos ?? []) as { archivo_url: string; tipo: string; fecha_subida: string }[]
  doc.fillColor('#000').fontSize(11).text(`Documentos adjuntos (${docs.length}):`, { underline: true })
  if (docs.length === 0) {
    doc.fontSize(10).fillColor('#666').text('Sin documentos adjuntos')
  } else {
    doc.fontSize(9).fillColor('#2563eb')
    for (const d of docs) {
      doc.text(`${d.tipo} — ${d.archivo_url}`)
    }
  }

  doc.end()
  const pdfBuffer = await pdfPromise

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="incidencia-parcela${inc.parcela.numero}-${id.slice(0, 8)}.pdf"`,
    },
  })
}
