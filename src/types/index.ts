export type Rol = 'comite' | 'parcelero'

export interface Parcela {
  id: string
  numero: number
  nombre_dueno: string
  email: string
  telefono?: string
  user_id?: string
  created_at: string
}

export interface PeriodoFacturacion {
  id: string
  mes: number
  anio: number
  monto_total_factura: number
  fecha_emision?: string
  fecha_vencimiento: string
  fecha_corte?: string
  archivo_factura_url?: string
  estado: 'abierto' | 'cerrado'
  created_at: string
}

export interface Lectura {
  id: string
  periodo_id: string
  parcela_id: string
  lectura_anterior: number
  lectura_actual: number
  consumo_kwh: number
  foto_url?: string
  confirmado: boolean
  created_at: string
  parcela?: Parcela
}

export type EstadoCuenta = 'pendiente' | 'pagado' | 'pago_parcial' | 'mora' | 'desconectado'

export interface CuentaParcela {
  id: string
  periodo_id: string
  parcela_id: string
  monto_prorrateado: number
  monto_pagado: number
  estado: EstadoCuenta
  fecha_pago?: string
  observaciones?: string
  actualizado_por?: string
  created_at: string
  parcela?: Parcela
  periodo?: PeriodoFacturacion
}

export interface AlertaEnviada {
  id: string
  tipo: 'vencimiento' | 'corte'
  periodo_id: string
  parcela_id: string
  enviado_en: string
}
