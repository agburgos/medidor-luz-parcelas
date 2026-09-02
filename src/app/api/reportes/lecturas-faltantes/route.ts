import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import PDFDocument from 'pdfkit'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Parcela = { id: string; numero: number; nombre_dueno: string; email: string | null; telefono: string | null }

// PDF: parcelas conectadas que aún no suben su lectura del período abierto más reciente.
// ?publico=1 → solo números de parcela, sin nombre/correo/teléfono (para publicar en el grupo).
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const publico = req.nextUrl.searchParams.get('publico') === '1'
  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, mes, anio')
    .eq('estado', 'abierto')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!periodo) {
    return NextResponse.json({ error: 'No hay ningún período abierto' }, { status: 400 })
  }

  const [{ data: parcelas }, { data: lecturas }] = await Promise.all([
    supabase.from('parcelas').select('id, numero, nombre_dueno, email, telefono').eq('activa', true).eq('tiene_empalme', true).order('numero'),
    supabase.from('lecturas').select('parcela_id').eq('periodo_id', periodo.id),
  ])

  const conLectura = new Set((lecturas ?? []).map((l: { parcela_id: string }) => l.parcela_id))

  const faltantes = ((parcelas ?? []) as Parcela[])
    .filter(p => !conLectura.has(p.id))
    .map(p => ({
      numero: p.numero,
      nombre: p.nombre_dueno,
      email: p.email || '—',
      telefono: p.telefono || '—',
    }))

  const nombrePeriodo = `${meses[periodo.mes - 1]} ${periodo.anio}`

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  doc.fontSize(16).text('COPOSA — Lecturas faltantes', { align: 'left' })
  doc.fontSize(10).fillColor('#666').text(`Período: ${nombrePeriodo}  ·  Generado: ${new Date().toLocaleDateString('es-CL')}`)
  doc.fontSize(10).fillColor('#666').text(`${faltantes.length} de ${(parcelas ?? []).length} parcelas conectadas aún no suben su lectura`)
  doc.moveDown(1)

  if (publico) {
    // Solo lista de números de parcela, sin datos personales — para publicar en el grupo.
    doc.fontSize(12).fillColor('#000')
    const texto = faltantes.map(f => `#${f.numero}`).join('   ')
    doc.text(texto || '—', { width: 515 })
  } else {
    const colX = [40, 90, 300, 440]
    const colW = [50, 200, 130, 110]
    const headerY = doc.y
    doc.fontSize(9).fillColor('#000')
    const headers = ['Parcela', 'Propietario', 'Correo', 'Teléfono']
    headers.forEach((h, i) => doc.text(h, colX[i], headerY, { width: colW[i] }))
    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke()
    doc.moveDown(0.3)

    for (const f of faltantes) {
      if (doc.y > 760) {
        doc.addPage()
        doc.y = 40
      }
      const y = doc.y
      doc.fontSize(9).fillColor('#000')
      doc.text(`#${f.numero}`, colX[0], y, { width: colW[0] })
      doc.text(f.nombre, colX[1], y, { width: colW[1] })
      const sinContacto = f.email === '—' && f.telefono === '—'
      doc.fillColor(sinContacto ? '#b91c1c' : '#000').text(f.email, colX[2], y, { width: colW[2] })
      doc.text(f.telefono, colX[3], y, { width: colW[3] })
      doc.moveDown(0.6)
    }
  }

  if (faltantes.length === 0) {
    doc.fontSize(10).fillColor('#666').text('🎉 Todas las parcelas conectadas ya subieron su lectura.')
  }

  doc.end()
  const pdfBuffer = await pdfPromise

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lecturas-faltantes${publico ? '-publico' : ''}-${nombrePeriodo.replace(' ', '-')}.pdf"`,
    },
  })
}
