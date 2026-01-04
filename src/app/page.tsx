import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">GHL CRUD</h1>
        <p className="text-gray-600 mb-8">
          Aplicacion Full-Stack con Dashboard y Autenticacion
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Iniciar Sesion
          </Link>
          <Link
            href="/auth/register"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Registrarse
          </Link>
        </div>
      </div>
    </main>
  )
}
