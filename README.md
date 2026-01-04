# GHL CRUD

Aplicacion Full-Stack con operaciones CRUD, Dashboard y Autenticacion.

## Stack Tecnologico

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript 5.x
- **Base de Datos**: Supabase (PostgreSQL)
- **Estilos**: Tailwind CSS
- **Autenticacion**: Supabase Auth

## Inicio Rapido

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Copia `.env.example` a `.env.local`
3. Agrega tus credenciales de Supabase

```bash
cp .env.example .env.local
```

### 3. Iniciar desarrollo

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
ghl-crud/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── auth/         # Paginas de autenticacion
│   │   └── dashboard/    # Dashboard principal
│   ├── components/       # Componentes React
│   ├── lib/              # Utilidades y configuracion
│   │   └── supabase/     # Cliente Supabase
│   └── types/            # Tipos TypeScript
├── .moai/                # Configuracion MoAI-ADK
└── tests/                # Tests
```

## Comandos Disponibles

```bash
pnpm dev        # Servidor de desarrollo
pnpm build      # Build de produccion
pnpm start      # Servidor de produccion
pnpm lint       # Ejecutar ESLint
pnpm test       # Tests unitarios
pnpm test:e2e   # Tests E2E
```

## Proximos Pasos

1. Configurar tu proyecto Supabase
2. Crear tablas en la base de datos
3. Implementar operaciones CRUD
4. Personalizar el dashboard

---

*Generado con MoAI-ADK*
