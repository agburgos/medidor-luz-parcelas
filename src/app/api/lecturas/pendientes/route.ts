import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()

  // Período abierto más reciente
  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, mes, anio')
    .eq('estado', 'abierto')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!periodo) return NextResponse.json({ periodo: null, pendientes: [], resumen: null })

  const [{ data: lecturas }, { data: parcelas }] = await Promise.all([
    supabase
      .from('lecturas')
      .select('*, parcela:parcelas(id,numero,nombre_dueno,email)')
      .eq('periodo_id', periodo.id),
    supabase.from('parcelas').select('id, numero, nombre_dueno').eq('activa', true),
  ])

  type Lect = NonNullable<typeof lecturas>[number]
  const todas = (lecturas ?? []) as Lect[]
  const pendientes = todas.filter(l => l.estado_validacion === 'pendiente')
  const aprobadas = todas.filter(l => l.estado_validacion === 'aprobada')
  const conLectura = new Set(todas.filter(l => l.estado_validacion !== 'rechazada').map(l => l.parcela_id))
  type Parc = { id: string; numero: number; nombre_dueno: string }
  const sinEnviar = ((parcelas ?? []) as Parc[]).filter(p => !conLectura.has(p.id))

  return NextResponse.json({
    periodo,
    pendientes,
    resumen: {
      total_parcelas: parcelas?.length ?? 0,
      aprobadas: aprobadas.length,
      pendientes: pendientes.length,
      sin_enviar: sinEnviar.map(p => ({ numero: p.numero, nombre: p.nombre_dueno })),
    },
  })
}
