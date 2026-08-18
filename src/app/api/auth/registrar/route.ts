import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Auto-registro de parceleros: solo permite crear la cuenta si el correo
// ingresado coincide EXACTO con uno que el comité ya cargó previamente en
// la ficha de una parcela (y que esa parcela todavía no tiene usuario
// vinculado). Evita que cualquiera se registre sin estar en el padrón.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Ingresa tu correo' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const correo = email.trim().toLowerCase()
  const supabase = createServiceClient()

  const { data: parcela, error: errParcela } = await supabase
    .from('parcelas')
    .select('id, numero, nombre_dueno, email, user_id')
    .ilike('email', correo)
    .maybeSingle()

  if (errParcela) return NextResponse.json({ error: errParcela.message }, { status: 400 })

  if (!parcela) {
    return NextResponse.json({
      error: 'Ese correo no está registrado por el comité en ninguna parcela. Pide a la directiva que lo agregue primero.',
    }, { status: 404 })
  }

  if (parcela.user_id) {
    return NextResponse.json({
      error: 'Esta parcela ya tiene una cuenta activada. Si es tuya, usa "¿Olvidaste tu contraseña?" para recuperarla.',
    }, { status: 400 })
  }

  const { data: nuevoUsuario, error: errCrear } = await supabase.auth.admin.createUser({
    email: parcela.email,
    password,
    email_confirm: true,
  })

  if (errCrear || !nuevoUsuario?.user) {
    return NextResponse.json({ error: errCrear?.message || 'No se pudo crear la cuenta' }, { status: 400 })
  }

  const { error: errVincular } = await supabase
    .from('parcelas')
    .update({ user_id: nuevoUsuario.user.id })
    .eq('id', parcela.id)

  if (errVincular) {
    return NextResponse.json({ error: 'Cuenta creada pero falló la vinculación con tu parcela: ' + errVincular.message }, { status: 400 })
  }

  await supabase.from('bitacora').insert({
    usuario_id: nuevoUsuario.user.id,
    usuario_nombre: parcela.nombre_dueno,
    accion: 'auto_registro_parcela',
    entidad: 'parcela',
    entidad_id: parcela.id,
    detalle: { numero: parcela.numero, email: parcela.email },
  })

  return NextResponse.json({ ok: true, email: parcela.email })
}
