import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// El parcelero informa un pago: queda "por_validar" y NO afecta su saldo
// hasta que el comité lo valide.
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const fd = await req.formData()

  const cuenta_id = fd.get('cuenta_id') as string
  const monto = Number(fd.get('monto'))
  const fecha = (fd.get('fecha') as string) || new Date().toISOString().slice(0, 10)
  const metodo = (fd.get('metodo') as string) || 'transferencia'
  const observacion = (fd.get('observacion') as string) || null
  const comprobante = fd.get('comprobante') as File | null

  if (!cuenta_id || !monto || monto <= 0) {
    return NextResponse.json({ error: 'Cuenta y monto son requeridos' }, { status: 400 })
  }

  // Verificar que la cuenta pertenece a la parcela del usuario
  const { data: cuenta } = await supabase
    .from('cuentas_parcela')
    .select('id, parcela:parcelas(user_id, numero)')
    .eq('id', cuenta_id)
    .single()

  const parcela = cuenta?.parcela as { user_id: string; numero: number } | undefined
  if (!cuenta || parcela?.user_id !== user.id) {
    return NextResponse.json({ error: 'Cuenta no válida' }, { status: 403 })
  }

  let comprobante_url = null
  if (comprobante && comprobante.size > 0) {
    const ext = comprobante.name.split('.').pop()
    const path = `comprobantes/${cuenta_id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await comprobante.arrayBuffer()), { contentType: comprobante.type })
    if (!upErr) {
      comprobante_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl
    }
  }

  const { error } = await supabase.from('pagos').insert({
    cuenta_id,
    monto,
    fecha,
    metodo,
    observacion,
    comprobante_url,
    estado: 'por_validar',
    reportado_por: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, mensaje: 'Pago informado. El comité lo validará y se reflejará en tu saldo.' })
}
