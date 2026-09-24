# ResiControl

Sistema de gestión y análisis de información de obra. Centraliza el registro de
la ejecución diaria y calcula automáticamente producción, tiempos, rendimiento,
cumplimiento y avance, para que el residente de obra deje de armar sus informes
a mano en Excel.

**Principio del sistema:** registrar una vez, calcular automáticamente y
reutilizar la información muchas veces.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| UI | React 19 + Tailwind CSS 3 + Lucide |
| Gráficas | Recharts |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (Neon) |
| Autenticación | NextAuth v4 (credenciales + JWT) |
| Validación | Zod |
| Deploy | Vercel |

Frontend y backend viven en el mismo proyecto: las páginas son React y las
API Routes hacen de capa REST, así que hay un solo repositorio y un solo deploy.

---

## Puesta en marcha

Requiere Node.js 20 o superior. En Windows, usar **CMD**, no PowerShell.

```cmd
npm install
```

Crear en la raíz un archivo `.env` con estas cuatro variables:

```env
DATABASE_URL="postgresql://usuario:clave@ep-xxxx-pooler.<región>.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://usuario:clave@ep-xxxx.<región>.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="cadena aleatoria larga, generable con: npx auth secret"
NEXTAUTH_URL="http://localhost:3000"
```

Las dos primeras son la misma base de Neon por dos caminos distintos, y se
diferencian por la palabra `-pooler` en el host. En el panel de Neon las da el
interruptor **Connection pooling**: activado entrega la de `DATABASE_URL` y
desactivado la de `DIRECT_URL`.

Hacen falta las dos porque Neon suspende el proyecto cuando lleva un rato sin
uso y cierra las conexiones abiertas: por el camino con pool, PgBouncer la
reabre por debajo y la aplicación no se entera, mientras que sin él aparece el
error `prisma:error ... kind: Closed`. El DDL, en cambio, no puede pasar por el
pool, y por eso las migraciones van por `DIRECT_URL`.

Opcionalmente, para cambiarle las credenciales al administrador que crea el
seed: `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.

En producción, `NEXTAUTH_URL` tiene que ser la URL exacta del despliegue, por
ejemplo `https://resicontrol.vercel.app`. Si no coincide, el inicio de sesión
redirige mal.

Luego preparar la base de datos y arrancar:

```cmd
npm run setup
npm run dev
```

`npm run setup` hace tres cosas: sincroniza el esquema con la base
(`prisma db push`), aplica las reglas de integridad que Prisma no expresa
(`prisma/constraints.sql`) y carga los datos iniciales (usuario administrador,
cargos y actividades).

La aplicación queda en http://localhost:3000 y las credenciales iniciales las
imprime el seed en la consola.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run db:push` | Sincroniza el esquema con la base |
| `npm run db:constraints` | Aplica los CHECK y los índices parciales |
| `npm run db:studio` | Explorador visual de la base en el puerto 5555 |
| `npm run seed` | Carga o refresca los datos iniciales |

> Después de cada `db:push` hay que volver a correr `db:constraints`, porque
> `db push` puede reconstruir tablas y perder las restricciones creadas a mano.

---

## Estructura

```
app/
  (app)/            módulos protegidos, comparten el layout con sidebar
    dashboard/      panel de indicadores
    proyectos/      jerarquía de obra
    ejecucion/      registros diarios
    informes/
    ...
  login/            página pública de acceso
  api/              capa REST
components/
  ui/               primitivos de interfaz
  AppShell.tsx      sidebar y cabecera
lib/
  prisma.ts         cliente Prisma singleton
  auth.ts           configuración de NextAuth y permisos por rol
  calculos.ts       motor de indicadores
  api.ts            helpers de respuesta, errores y permisos
prisma/
  schema.prisma     modelo relacional
  constraints.sql   reglas de integridad
scripts/
  seed.js           datos iniciales (fuera de Git)
proxy.ts            protección de rutas
```

---

## Modelo de datos

La jerarquía física es `Proyecto > Torre > Piso > Zona > Elemento constructivo`.
El personal se organiza en `Cuadrilla` con un histórico de asignaciones en
`cuadrilla_trabajador`, y cada `Trabajador` tiene un `Cargo`.

El centro de todo es **`registros_ejecucion`**, que conecta la dimensión física
(elemento), la humana (cuadrilla y trabajador), la temporal (fecha y horas) y la
productiva (cantidades y meta).

### Usuario y Trabajador son entidades distintas

`Usuario` es quien entra al sistema y tiene credenciales y rol. `Trabajador` es
quien ejecuta la actividad en obra y no necesita cuenta. Separarlos evita crear
accesos innecesarios y permite llevar el desempeño del personal sin mezclarlo
con la administración del software.

### Roles

| Rol | Puede |
|---|---|
| `ADMIN` | Todo, incluida la gestión de usuarios |
| `RESIDENTE` | Gestionar obra y personal, registrar ejecución, consultar |
| `SUPERVISOR` | Solo consultar el panel y generar informes |

---

## Indicadores

Ningún indicador se guarda como columna. Todos se derivan en `lib/calculos.ts`,
que es la única definición de cada fórmula, de modo que el panel y los informes
no puedan discrepar.

```
m2_totales       = largo × alto
m2_pendientes    = m2_totales − m2_ejecutados
tiempo_efectivo  = hora_final − hora_inicio − tiempo_receso
rendimiento      = m2_ejecutados / horas_efectivas
cumplimiento     = m2_ejecutados / m2_meta
avance           = m2_ejecutados / m2_totales
```

**Regla de agregación.** Un indicador global nunca se obtiene sumando ni
promediando indicadores individuales. Siempre se suman primero numeradores y
denominadores:

```
rendimiento global = SUM(m2_ejecutados) / SUM(horas_efectivas)
avance global      = SUM(m2_ejecutados) / SUM(m2_totales)
cumplimiento       = SUM(m2_ejecutados) / SUM(m2_meta)
```

Este es exactamente el error que arrastraban las tablas dinámicas del Excel
original, donde algunos porcentajes se estaban sumando.

---

## Deploy en Vercel

1. Subir el repositorio a GitHub.
2. Importarlo en vercel.com.
3. Cargar `DATABASE_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL` **antes** del
   primer deploy. `NEXTAUTH_URL` debe ser la URL exacta que genera Vercel,
   incluido el sufijo, o el login falla con "Server error".

Cada `git push` a `main` dispara un redeploy automático.
