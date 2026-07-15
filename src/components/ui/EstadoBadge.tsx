import { EstadoCuenta } from '@/types'

const estilos: Record<EstadoCuenta, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  pagado: 'bg-green-100 text-green-800',
  pago_parcial: 'bg-blue-100 text-blue-800',
  mora: 'bg-red-100 text-red-800',
  desconectado: 'bg-gray-100 text-gray-600',
}

const etiquetas: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  pago_parcial: 'Pago parcial',
  mora: 'Mora',
  desconectado: 'Desconectado',
}

export default function EstadoBadge({ estado }: { estado: EstadoCuenta }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estilos[estado]}`}>
      {etiquetas[estado]}
    </span>
  )
}
