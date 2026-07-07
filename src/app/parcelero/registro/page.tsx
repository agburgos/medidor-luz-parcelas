import RegistroParcela from '@/components/registro/RegistroParcela'

export default function RegistroParceleroPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Registro de mi parcela</h1>
      <p className="text-gray-500 text-sm mb-6">
        Mantén al día las personas que viven o trabajan en tu parcela y tus mascotas.
        Esta información es visible para la directiva del macrolote.
      </p>
      <RegistroParcela parcelaId={null} />
    </div>
  )
}
