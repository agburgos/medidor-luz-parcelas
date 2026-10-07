import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

type Fila = { texto: string; votos: number; porcentaje: number; propuestaPor: string }

// GET ?formato=pdf|csv — resultados de una votación para llevar a asamblea o compartir.
// El detalle "quién votó qué" solo se incluye si la votación no es secreta.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const formato = req.nextUrl.searchParams.get('formato') === 'csv' ? 'csv' : 'pdf'
  const supabase = createServiceClient()

  const { data: votacion } = await supabase.from('votaciones').select('*').eq('id', id).single()
  if (!votacion) return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })

  const [{ data: opciones }, { data: votos }, { count: totalParcelas }] = await Promise.all([
    supabase.from('opciones_votacion').select('id, texto, orden, propuesta_por_parcela_id').eq('votacion_id', id).order('orden'),
    supabase.from('votos').select('opcion_id, opcion_ids, parcela:parcelas(numero, nombre_dueno)').eq('votacion_id', id),
    supabase.from('parcelas').select('*', { count: 'exact', head: true }).eq('activa', true),
  ])

  const proponenteIds = [...new Set((opciones ?? []).map((o: { propuesta_por_parcela_id: string | null }) => o.propuesta_por_parcela_id).filter(Boolean))] as string[]
  const proponentes = new Map<string, string>()
  if (proponenteIds.length > 0) {
    const { data: ps } = await supabase.from('parcelas').select('id, numero, nombre_dueno').in('id', proponenteIds)
    for (const p of (ps ?? []) as { id: string; numero: number; nombre_dueno: string }[]) proponentes.set(p.id, `#${p.numero} ${p.nombre_dueno}`)
  }

  type VotoRow = { opcion_id: string | null; opcion_ids: string[] | null; parcela: { numero: number; nombre_dueno: string } | null }
  const filasVoto = (votos ?? []) as unknown as VotoRow[]
  const idsDe = (v: VotoRow) => (votacion.tipo_conteo === 'unica' ? (v.opcion_id ? [v.opcion_id] : []) : (v.opcion_ids ?? []))
  const conteo = new Map<string, number>()
  for (const v of filasVoto) for (const oid of idsDe(v)) conteo.set(oid, (conteo.get(oid) ?? 0) + 1)
  const totalVotantes = filasVoto.length

  const textoDe = new Map((opciones ?? []).map((o: { id: string; texto: string }) => [o.id, o.texto]))
  const ranking: Fila[] = (opciones ?? [])
    .map((o: { id: string; texto: string; propuesta_por_parcela_id: string | null }) => {
      const votosOp = conteo.get(o.id) ?? 0
      return {
        texto: o.texto,
        votos: votosOp,
        porcentaje: totalVotantes > 0 ? Math.round((votosOp / totalVotantes) * 100) : 0,
        propuestaPor: o.propuesta_por_parcela_id ? (proponentes.get(o.propuesta_por_parcela_id) ?? 'vecino') : '',
      }
    })
    .sort((a: Fila, b: Fila) => b.votos - a.votos)

  const detalle = votacion.es_secreta ? null : filasVoto
    .filter(v => v.parcela)
    .map(v => ({ numero: v.parcela!.numero, nombre: v.parcela!.nombre_dueno, votoPor: idsDe(v).map(oid => textoDe.get(oid) ?? '?').join(', ') }))
    .sort((a, b) => a.numero - b.numero)

  const base = `votacion-${String(votacion.titulo).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)}`
  const cierre = new Date(votacion.fecha_cierre).toLocaleString('es-CL')
  const participacion = `${totalVotantes} de ${totalParcelas ?? 80} parcelas`

  if (formato === 'csv') {
    const esc = (t: string | number) => `"${String(t).replace(/"/g, '""')}"`
    const lineas: string[] = [
      [esc('Votación'), esc(votacion.titulo)].join(';'),
      [esc('Cierre'), esc(cierre)].join(';'),
      [esc('Participación'), esc(participacion)].join(';'),
      [esc('Privacidad'), esc(votacion.es_secreta ? 'Secreta' : 'Nominativa')].join(';'),
      '',
      ['Opción', 'Votos', 'Porcentaje', 'Propuesta por'].map(esc).join(';'),
      ...ranking.map(r => [esc(r.texto), r.votos, `${r.porcentaje}%`, esc(r.propuestaPor)].join(';')),
    ]
    if (detalle) {
      lineas.push('', ['Parcela', 'Dueño', 'Votó por'].map(esc).join(';'))
      for (const d of detalle) lineas.push([d.numero, esc(d.nombre), esc(d.votoPor)].join(';'))
    }
    // BOM + ';' para que Excel en español lo abra con tildes y columnas bien
    return new NextResponse('﻿' + lineas.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"`,
      },
    })
  }

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const listo = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1d4ea8').text('Macrolote COPOSA')
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(votacion.titulo)
  if (votacion.descripcion) doc.font('Helvetica').fontSize(10).fillColor('#475569').text(votacion.descripcion)
  doc.moveDown(0.5).font('Helvetica').fontSize(10).fillColor('#475569')
    .text(`Cierre: ${cierre}  ·  Participación: ${participacion}  ·  ${votacion.es_secreta ? 'Votación secreta' : 'Votación nominativa'}`)
  doc.moveDown()

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Resultados')
  doc.moveDown(0.4)
  const ancho = doc.page.width - 80
  for (const r of ranking) {
    if (doc.y > doc.page.height - 90) doc.addPage()
    const y = doc.y
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(r.texto, 40, y, { width: ancho - 110 })
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1d4ea8').text(`${r.votos} votos (${r.porcentaje}%)`, 40, y, { width: ancho, align: 'right' })
    const yBarra = Math.max(doc.y, y + 14) + 2
    doc.rect(40, yBarra, ancho, 6).fill('#e2e8f0')
    doc.rect(40, yBarra, Math.max(1, (ancho * r.porcentaje) / 100), 6).fill('#1d4ea8')
    doc.y = yBarra + 10
    if (r.propuestaPor) doc.font('Helvetica').fontSize(8).fillColor('#6366f1').text(`Propuesta por ${r.propuestaPor}`, 40, doc.y)
    doc.y += 8
  }

  if (detalle) {
    doc.addPage()
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Quién votó qué')
    doc.moveDown(0.4)
    for (const d of detalle) {
      if (doc.y > doc.page.height - 60) doc.addPage()
      doc.font('Helvetica').fontSize(9).fillColor('#1f2937').text(`#${d.numero} ${d.nombre}  →  ${d.votoPor}`, 40)
    }
  }
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
    .text(`Generado ${new Date().toLocaleDateString('es-CL')} · Comité Macrolote COPOSA`, 40, doc.page.height - 40, { width: ancho, align: 'center', lineBreak: false })
  doc.end()

  return new NextResponse(new Uint8Array(await listo), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${base}.pdf"` },
  })
}
