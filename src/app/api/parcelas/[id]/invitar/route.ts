import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: parcela } = await supabase
    .from('parcelas')
    .select('id, email, nombre_dueno, user_id')
    .eq('id', id)
    .single()

  if (!parcela) return NextResponse.json({ error: 'Parcela no encontrada' }, { status: 404 })
  if (parcela.user_id) return NextResponse.json({ error: 'Esta parcela ya tiene un usuario vinculado' }, { status: 400 })

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/bienvenida`

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    parcela.email,
    { redirectTo }
  )

  if (inviteError) {
    // Si el usuario ya existe en Auth, solo vincularlo
    if (inviteError.message.includes('already been registered')) {
      const { data: usersData } = await supabase.auth.admin.listUsers()
      const existente = usersData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === parcela.email.toLowerCase()
      )
      if (existente) {
        await supabase.from('parcelas').update({ user_id: existente.id }).eq('id', id)
        return NextResponse.json({ vinculado: true, mensaje: 'El usuario ya existía y fue vinculado a la parcela' })
      }
    }
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  // Vincular el nuevo usuario a la parcela
  await supabase.from('parcelas').update({ user_id: inviteData.user.id }).eq('id', id)

  return NextResponse.json({ invitado: true, email: parcela.email })
}
