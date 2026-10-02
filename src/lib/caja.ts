import { createServiceClient } from '@/lib/supabase/server'

export type CuentaCaja = { id: string; nombre: string; tipo: string; orden: number }
export type CuentaConSaldo = CuentaCaja & { saldo: number }

// Saldos por cuenta de caja. El saldo inicial (caja_saldos) pertenece a la
// cuenta de tipo "diaria". Las transferencias internas son dos movimientos
// (egreso en origen + ingreso en destino) que suman cero en el total.
export async function cargarCuentasConSaldo(): Promise<{ cuentas: CuentaConSaldo[]; total: number }> {
  const supabase = createServiceClient()
  const [{ data: cuentas }, { data: movs }, { data: saldoIni }] = await Promise.all([
    supabase.from('caja_cuentas').select('id, nombre, tipo, orden').eq('activa', true).order('orden'),
    supabase.from('caja_movimientos').select('cuenta_id, tipo, monto'),
    supabase.from('caja_saldos').select('saldo_final').order('fecha', { ascending: true }).limit(1).maybeSingle(),
  ])
  const saldos = new Map<string, number>()
  for (const m of (movs ?? []) as { cuenta_id: string; tipo: string; monto: number }[]) {
    saldos.set(m.cuenta_id, (saldos.get(m.cuenta_id) ?? 0) + (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)))
  }
  const lista = ((cuentas ?? []) as CuentaCaja[]).map(c => ({
    ...c,
    saldo: (saldos.get(c.id) ?? 0) + (c.tipo === 'diaria' ? Number(saldoIni?.saldo_final ?? 0) : 0),
  }))
  return { cuentas: lista, total: lista.reduce((s, c) => s + c.saldo, 0) }
}
