import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

interface Notificacion {
  id: string
  tipo: 'pago' | 'lectura' | 'anuncio' | 'asamblea' | 'vencimiento' | 'mora'
  urgencia: 'alta' | 'media' | 'baja'
  mensaje: string
  link: string
  fecha: string
}

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const notis: Notificacion[] = []
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (sesion.rol === 'comite') {
    const [{ count: pagosLuz }, { count: pagosGC }, { count: countLecturas }] = await Promise.all([
      supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('estado', 'por_validar'),
      supabase.from('pagos_gc').select('*', { count: 'exact', head: true }).eq('estado', 'por_validar'),
      supabase.from('lecturas').select('*', { count: 'exact', head: true }).eq('estado_validacion', 'pendiente'),
    ])

    if ((pagosLuz ?? 0) > 0) {
      notis.push({ id: 'pagos-luz', tipo: 'pago', urgencia: 'alta', mensaje: `${pagosLuz} pago${pagosLuz !== 1 ? 's' : ''} de Luz por validar`, link: '/comite/pagos', fecha: hoy.toISOString() })
    }
    if ((pagosGC ?? 0) > 0) {
      notis.push({ id: 'pagos-gc', tipo: 'pago', urgencia: 'alta', mensaje: `${pagosGC} pago${pagosGC !== 1 ? 's' : ''} de Gastos Comunes por validar`, link: '/comite/pagos', fecha: hoy.toISOString() })
    }
    if ((countLecturas ?? 0) > 0) {
      notis.push({ id: 'lecturas', tipo: 'lectura', urgencia: 'media', mensaje: `${countLecturas} lectura${countLecturas !== 1 ? 's' : ''} por validar`, link: '/comite/lecturas', fecha: hoy.toISOString() })
    }

    const { data: asambleasProx } = await supabase
      .from('asambleas')
      .select('id, titulo, fecha, tipo')
      .eq('estado', 'planificada')
      .gte('fecha', hoy.toISOString().slice(0, 10))
      .order('fecha', { ascending: true })
      .limit(3)
    for (const a of asambleasProx ?? []) {
      const dias = Math.ceil((new Date(a.fecha).getTime() - hoy.getTime()) / 86400000)
      notis.push({
        id: `asamblea-${a.id}`, tipo: 'asamblea', urgencia: dias <= 3 ? 'alta' : 'baja',
        mensaje: `${a.tipo === 'directiva' ? '🔒 ' : ''}${a.titulo} — ${dias === 0 ? 'hoy' : `en ${dias} día${dias !== 1 ? 's' : ''}`}`,
        link: '/comite/asambleas', fecha: a.fecha,
      })
    }
  } else {
    if (!sesion.parcelaId) return NextResponse.json([])

    // Período de luz abierto sin lectura enviada todavía (nueva o recién creada,
    // aunque aún no tenga factura/prorrateo calculado)
    const [{ data: miParcela }, { data: periodoAbierto }] = await Promise.all([
      supabase.from('parcelas').select('tiene_empalme').eq('id', sesion.parcelaId).single(),
      supabase.from('periodos_facturacion').select('id, mes, anio').eq('estado', 'abierto').order('anio', { ascending: false }).order('mes', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (periodoAbierto && miParcela?.tiene_empalme !== false) {
      const [{ data: miLectura }, { data: config }] = await Promise.all([
        supabase.from('lecturas').select('id, estado_validacion').eq('periodo_id', periodoAbierto.id).eq('parcela_id', sesion.parcelaId).maybeSingle(),
        supabase.from('config_alertas').select('dia_tope_lectura').limit(1).maybeSingle(),
      ])
      if (!miLectura) {
        const diaTope = config?.dia_tope_lectura ?? 10
        const fechaTope = new Date(periodoAbierto.anio, periodoAbierto.mes - 1, diaTope)
        const diasTope = Math.ceil((fechaTope.getTime() - hoy.getTime()) / 86400000)
        notis.push({
          id: `lectura-pendiente-${periodoAbierto.id}`, tipo: 'lectura', urgencia: diasTope < 0 ? 'alta' : diasTope <= 3 ? 'alta' : 'media',
          mensaje: `📸 Nuevo período abierto: ${meses[periodoAbierto.mes - 1]} ${periodoAbierto.anio} — sube tu lectura de medidor`,
          link: '/parcelero/luz', fecha: hoy.toISOString(),
        })
      }
    }

    const [{ data: cuentasLuz }, { data: cuentasGC }, { data: morasPend }, { data: anunciosRecientes }, { data: lecturasRechazadas }, { data: asambleas }] = await Promise.all([
      supabase.from('cuentas_parcela').select('id, monto_prorrateado, monto_pagado, estado, periodo:periodos_facturacion(mes,anio,fecha_vencimiento)').eq('parcela_id', sesion.parcelaId).neq('estado', 'pagado'),
      supabase.from('cuentas_gc').select('id, monto, monto_pagado, estado, periodo:periodos_gc(mes,anio,fecha_vencimiento)').eq('parcela_id', sesion.parcelaId).neq('estado', 'pagado'),
      supabase.from('moras_anteriores').select('id, descripcion, monto, monto_pagado, tipo').eq('parcela_id', sesion.parcelaId).neq('estado', 'pagado'),
      supabase.from('anuncios').select('id, titulo, created_at').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false }),
      supabase.from('lecturas').select('id, motivo_rechazo, periodo:periodos_facturacion(mes,anio)').eq('parcela_id', sesion.parcelaId).eq('estado_validacion', 'rechazada'),
      supabase.from('asambleas').select('id, titulo, fecha, tipo').eq('estado', 'planificada').neq('tipo', 'directiva').gte('fecha', hoy.toISOString().slice(0, 10)).order('fecha', { ascending: true }).limit(3),
    ])

    type CLuz = { id: string; monto_prorrateado: number; monto_pagado: number; estado: string; periodo: { mes: number; anio: number; fecha_vencimiento: string } | null }
    for (const c of (cuentasLuz ?? []) as CLuz[]) {
      if (!c.periodo) continue
      const venc = new Date(c.periodo.fecha_vencimiento + 'T00:00:00')
      const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
      if (dias <= 10) {
        const saldo = c.monto_prorrateado - c.monto_pagado
        notis.push({
          id: `venc-luz-${c.id}`, tipo: 'vencimiento', urgencia: dias < 0 ? 'alta' : dias <= 3 ? 'alta' : 'media',
          mensaje: `⚡ Luz ${meses[c.periodo.mes - 1]} ${c.periodo.anio}: $${Math.round(saldo).toLocaleString('es-CL')} ${dias < 0 ? 'VENCIDO' : `vence en ${dias} día${dias !== 1 ? 's' : ''}`}`,
          link: '/parcelero', fecha: c.periodo.fecha_vencimiento,
        })
      }
    }
    type CGC = { id: string; monto: number; monto_pagado: number; estado: string; periodo: { mes: number; anio: number; fecha_vencimiento: string } | null }
    for (const c of (cuentasGC ?? []) as CGC[]) {
      if (!c.periodo) continue
      const venc = new Date(c.periodo.fecha_vencimiento + 'T00:00:00')
      const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
      if (dias <= 10) {
        const saldo = c.monto - c.monto_pagado
        notis.push({
          id: `venc-gc-${c.id}`, tipo: 'vencimiento', urgencia: dias < 0 ? 'alta' : dias <= 3 ? 'alta' : 'media',
          mensaje: `🏘️ GC ${meses[c.periodo.mes - 1]} ${c.periodo.anio}: $${Math.round(saldo).toLocaleString('es-CL')} ${dias < 0 ? 'VENCIDO' : `vence en ${dias} día${dias !== 1 ? 's' : ''}`}`,
          link: '/parcelero/gastos-comunes', fecha: c.periodo.fecha_vencimiento,
        })
      }
    }

    type Mora = { id: string; descripcion: string; monto: number; monto_pagado: number; tipo: string }
    for (const m of (morasPend ?? []) as Mora[]) {
      notis.push({
        id: `mora-${m.id}`, tipo: 'mora', urgencia: 'media',
        mensaje: `Deuda anterior (${m.tipo === 'luz' ? 'Luz' : m.tipo === 'gc' ? 'GC' : 'Otro'}): ${m.descripcion} — $${Math.round(m.monto - m.monto_pagado).toLocaleString('es-CL')}`,
        link: '/parcelero', fecha: hoy.toISOString(),
      })
    }

    for (const a of anunciosRecientes ?? []) {
      notis.push({ id: `anuncio-${a.id}`, tipo: 'anuncio', urgencia: 'baja', mensaje: `📢 Nuevo anuncio: ${a.titulo}`, link: '/parcelero', fecha: a.created_at })
    }

    type LecturaRechazada = { id: string; motivo_rechazo: string | null; periodo: { mes: number; anio: number } | null }
    for (const l of (lecturasRechazadas ?? []) as LecturaRechazada[]) {
      notis.push({
        id: `rechazo-${l.id}`, tipo: 'lectura', urgencia: 'alta',
        mensaje: `❌ Tu lectura ${l.periodo ? `de ${meses[l.periodo.mes - 1]} ${l.periodo.anio}` : ''} fue rechazada${l.motivo_rechazo ? `: ${l.motivo_rechazo}` : ''}. Vuelve a enviarla.`,
        link: '/parcelero', fecha: hoy.toISOString(),
      })
    }

    for (const a of asambleas ?? []) {
      const dias = Math.ceil((new Date(a.fecha).getTime() - hoy.getTime()) / 86400000)
      notis.push({
        id: `asamblea-${a.id}`, tipo: 'asamblea', urgencia: dias <= 3 ? 'media' : 'baja',
        mensaje: `🗓️ Estás citado: ${a.titulo} — ${dias === 0 ? 'hoy' : `en ${dias} día${dias !== 1 ? 's' : ''}`}`,
        link: '/parcelero/asambleas', fecha: a.fecha,
      })
    }

    // Votaciones abiertas donde el parcelero aún no ha votado
    const { data: votacionesAbiertas } = await supabase
      .from('votaciones')
      .select('id, titulo, fecha_cierre, created_at')
      .eq('estado', 'abierta')
      .gte('fecha_cierre', hoy.toISOString())

    if (votacionesAbiertas && votacionesAbiertas.length > 0) {
      const { data: misVotos } = await supabase
        .from('votos')
        .select('votacion_id')
        .eq('parcela_id', sesion.parcelaId)

      const idsVotados = new Set((misVotos ?? []).map((v: { votacion_id: string }) => v.votacion_id))

      for (const v of votacionesAbiertas) {
        if (idsVotados.has(v.id)) continue
        const diasCierre = Math.ceil((new Date(v.fecha_cierre).getTime() - hoy.getTime()) / 86400000)
        notis.push({
          id: `votacion-${v.id}`, tipo: 'asamblea', urgencia: diasCierre <= 2 ? 'alta' : 'media',
          mensaje: `🗳️ Nueva votación: ${v.titulo} — ${diasCierre === 0 ? 'cierra hoy' : `cierra en ${diasCierre} día${diasCierre !== 1 ? 's' : ''}`}`,
          link: '/parcelero/votaciones', fecha: v.created_at,
        })
      }
    }
  }

  const orden = { alta: 0, media: 1, baja: 2 }
  notis.sort((a, b) => orden[a.urgencia] - orden[b.urgencia])

  return NextResponse.json(notis)
}
