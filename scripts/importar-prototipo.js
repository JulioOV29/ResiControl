/**
 * Carga el juego de datos del Excel "Dashboard Residente de obra" en la base.
 *
 *   npm run importar
 *
 * Es idempotente: reconstruye la jerarquia buscando antes de crear, asi que se
 * puede correr varias veces sin duplicar nada. Al terminar recalcula los
 * indicadores desde la base y los compara contra los del Excel, que es la
 * prueba de que el modelo relacional reproduce el prototipo.
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// El juego de datos no se versiona: es informacion de la obra, no codigo. En un
// clon nuevo no existe, y conviene decirlo con todas las letras en vez de
// fallar con un ENOENT de Node.
const RUTA_DATOS = path.join(__dirname, 'datos-prototipo.json')
if (!fs.existsSync(RUTA_DATOS)) {
  console.error(
    'No se encontro scripts/datos-prototipo.json.\n' +
      'Ese archivo no se sube al repositorio: pidelo o exportalo del Excel prototipo.\n' +
      'Sin el, "npm run setup" deja el sistema listo pero vacio.',
  )
  process.exit(1)
}

const datos = JSON.parse(fs.readFileSync(RUTA_DATOS, 'utf8'))

const fecha = (texto) => new Date(`${texto}T00:00:00.000Z`)
const hora = (texto) => {
  const [h, m] = texto.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, h, m, 0))
}
const numero = (v, d = 2) =>
  v === null || v === undefined ? '-' : Number(v).toLocaleString('es-CO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })

const conteo = { creados: 0, existentes: 0 }
const marcar = (creado) => (creado ? conteo.creados++ : conteo.existentes++)

async function main() {
  const usuario = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' }, orderBy: { id: 'asc' } })
  if (!usuario) {
    throw new Error('No hay ningun usuario ADMIN. Corre "npm run seed" antes de importar.')
  }

  // --- Proyecto -------------------------------------------------------------
  const proyecto = await prisma.proyecto.upsert({
    where: { codigo: datos.proyecto.codigo },
    update: {},
    create: {
      codigo: datos.proyecto.codigo,
      nombre: datos.proyecto.nombre,
      descripcion: datos.proyecto.descripcion,
      estado: datos.proyecto.estado,
      fechaInicio: fecha(datos.proyecto.fechaInicio),
    },
  })

  // --- Catalogos ------------------------------------------------------------
  const cargos = {}
  for (const nombre of datos.cargos) {
    cargos[nombre] = await prisma.cargo.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    })
  }

  const actividades = {}
  for (const nombre of datos.actividades) {
    actividades[nombre] = await prisma.actividad.upsert({
      where: { nombre },
      update: {},
      create: { nombre, unidadMedida: 'm2' },
    })
  }

  // --- Personal -------------------------------------------------------------
  const trabajadores = {}
  for (const t of datos.trabajadores) {
    let registro = await prisma.trabajador.findFirst({
      where: { nombre: t.nombre, apellido: t.apellido },
    })
    marcar(!registro)
    if (!registro) {
      registro = await prisma.trabajador.create({
        data: { nombre: t.nombre, apellido: t.apellido, cargoId: cargos[t.cargo].id },
      })
    }
    trabajadores[t.completo] = registro
  }

  const cuadrillas = {}
  for (const nombre of datos.cuadrillas) {
    cuadrillas[nombre] = await prisma.cuadrilla.upsert({
      where: { proyectoId_nombre: { proyectoId: proyecto.id, nombre } },
      update: {},
      create: { proyectoId: proyecto.id, nombre },
    })
  }

  for (const a of datos.asignaciones) {
    const trabajadorId = trabajadores[a.trabajador].id
    const existente = await prisma.cuadrillaTrabajador.findFirst({
      where: { trabajadorId, activo: true },
    })
    if (existente) continue
    await prisma.cuadrillaTrabajador.create({
      data: {
        cuadrillaId: cuadrillas[a.cuadrilla].id,
        trabajadorId,
        fechaInicio: fecha(a.fechaInicio),
        // Explicito a proposito: la busqueda de arriba filtra por activo, y
        // depender del valor por defecto haria que en una segunda corrida el
        // chequeo no encontrara la asignacion y la volviera a crear.
        activo: true,
      },
    })
  }

  // --- Metas derivadas ------------------------------------------------------
  for (const m of datos.metas) {
    const existente = await prisma.meta.findFirst({
      where: {
        proyectoId: proyecto.id,
        actividadId: actividades[m.actividad].id,
        cargoId: cargos[m.cargo].id,
      },
    })
    if (existente) continue
    await prisma.meta.create({
      data: {
        proyectoId: proyecto.id,
        actividadId: actividades[m.actividad].id,
        cargoId: cargos[m.cargo].id,
        m2Objetivo: m.m2Objetivo,
        vigenciaDesde: fecha(datos.proyecto.fechaInicio),
      },
    })
  }

  // --- Jerarquia y registros ------------------------------------------------
  const cache = { torres: {}, pisos: {}, zonas: {}, frentes: {} }

  for (const r of datos.registros) {
    // Torre
    const claveTorre = r.torre
    if (!cache.torres[claveTorre]) {
      cache.torres[claveTorre] = await prisma.torre.upsert({
        where: { proyectoId_codigo: { proyectoId: proyecto.id, codigo: r.torre } },
        update: {},
        create: {
          proyectoId: proyecto.id,
          codigo: r.torre,
          nombre: `Torre ${r.torre}`,
          estado: 'EN_PROCESO',
        },
      })
    }
    const torre = cache.torres[claveTorre]

    // Piso
    const clavePiso = `${torre.id}|${r.piso}`
    if (!cache.pisos[clavePiso]) {
      cache.pisos[clavePiso] = await prisma.piso.upsert({
        where: { torreId_numero: { torreId: torre.id, numero: r.piso } },
        update: {},
        create: { torreId: torre.id, numero: r.piso, nombre: `Piso ${r.piso}` },
      })
    }
    const piso = cache.pisos[clavePiso]

    // Zona
    const claveZona = `${piso.id}|${r.zonaCodigo}`
    if (!cache.zonas[claveZona]) {
      cache.zonas[claveZona] = await prisma.zona.upsert({
        where: { pisoId_codigo: { pisoId: piso.id, codigo: r.zonaCodigo } },
        update: {},
        create: {
          pisoId: piso.id,
          codigo: r.zonaCodigo,
          nombre: r.zonaNombre,
          tipo: 'Apartamento',
        },
      })
    }
    const zona = cache.zonas[claveZona]

    // Frente de trabajo
    const claveFrente = `${zona.id}|${r.codigoDwg}|${r.descripcion}`
    if (!cache.frentes[claveFrente]) {
      cache.frentes[claveFrente] = await prisma.frenteTrabajo.upsert({
        where: {
          zonaId_codigoDwg_descripcion: {
            zonaId: zona.id,
            codigoDwg: r.codigoDwg,
            descripcion: r.descripcion,
          },
        },
        update: {},
        create: {
          zonaId: zona.id,
          codigoDwg: r.codigoDwg,
          descripcion: r.descripcion,
          unidad: 'm2',
          estado: 'EN_PROCESO',
        },
      })
    }
    const frente = cache.frentes[claveFrente]

    // Registro de ejecucion
    const existente = await prisma.registroEjecucion.findUnique({
      where: { codigoRegistro: r.codigo },
    })
    marcar(!existente)
    if (existente) continue

    await prisma.registroEjecucion.create({
      data: {
        codigoRegistro: r.codigo,
        fechaEjecucion: fecha(r.fecha),
        frenteId: frente.id,
        actividadId: actividades[r.actividad].id,
        cuadrillaId: cuadrillas[r.cuadrilla].id,
        trabajadorId: trabajadores[r.trabajador].id,
        usuarioRegistraId: usuario.id,
        // Cada fila del Excel abre su propia obra: lleva las medidas y no
        // continua ninguna cadena.
        largo: r.largo,
        alto: r.alto,
        m2Ejecutados: r.m2Ejecutados,
        horaInicio: hora(r.horaInicio),
        horaFinal: hora(r.horaFinal),
        tiempoRecesoMin: r.recesoMin,
        m2Meta: r.m2Meta,
      },
    })
  }

  await verificar()
}

/**
 * Recalcula los indicadores desde la base y los compara con los del Excel.
 * Si algo no cuadra, el problema esta en los datos importados, no en la app.
 */
async function verificar() {
  const registros = await prisma.registroEjecucion.findMany({
    select: {
      id: true,
      registroOrigenId: true,
      largo: true,
      alto: true,
      m2Ejecutados: true,
      m2Meta: true,
      horaInicio: true,
      horaFinal: true,
      tiempoRecesoMin: true,
      registroOrigen: { select: { largo: true, alto: true } },
    },
  })

  const n = (v) => (v === null || v === undefined ? 0 : Number(v.toString()))
  const areaPorObra = new Map()
  let m2Ejecutados = 0
  let m2Meta = 0
  let horas = 0

  for (const r of registros) {
    m2Ejecutados += n(r.m2Ejecutados)
    m2Meta += n(r.m2Meta)
    const minutos =
      (r.horaFinal.getTime() - r.horaInicio.getTime()) / 60000 - r.tiempoRecesoMin
    horas += minutos / 60
    // El area de cada obra cuenta una sola vez, aunque tenga varios registros.
    const clave = r.registroOrigenId ?? r.id
    if (!areaPorObra.has(clave)) {
      const medidas = r.registroOrigen ?? r
      areaPorObra.set(clave, n(medidas.largo) * n(medidas.alto))
    }
  }

  const m2Totales = Array.from(areaPorObra.values()).reduce((a, b) => a + b, 0)

  // SUM(numerador) / SUM(denominador). Nunca el promedio de los indicadores.
  const calculado = {
    m2Ejecutados,
    m2Totales,
    m2Pendientes: m2Totales - m2Ejecutados,
    avance: m2Ejecutados / m2Totales,
    cumplimiento: m2Ejecutados / m2Meta,
    rendimiento: m2Ejecutados / horas,
    horasEfectivas: horas,
  }

  const esperado = datos.esperado
  const lineas = [
    ['Produccion (m2)', calculado.m2Ejecutados, esperado.m2Ejecutados, 2],
    ['m2 totales', calculado.m2Totales, esperado.m2Totales, 2],
    ['Pendiente (m2)', calculado.m2Pendientes, esperado.m2Pendientes, 2],
    ['Avance (%)', calculado.avance * 100, esperado.avance * 100, 2],
    ['Cumplimiento (%)', calculado.cumplimiento * 100, esperado.cumplimiento * 100, 2],
    ['Rendimiento (m2/h)', calculado.rendimiento, esperado.rendimiento, 2],
    ['Horas efectivas', calculado.horasEfectivas, esperado.horasEfectivas, 2],
  ]

  console.log('')
  console.log(`  Registros en la base: ${registros.length} sobre ${areaPorObra.size} obras`)
  console.log(`  Creados en esta corrida: ${conteo.creados} | ya existian: ${conteo.existentes}`)
  console.log('')
  console.log('  Indicador              Sistema        Excel     Coincide')
  console.log('  ----------------------------------------------------------')

  let todoBien = true
  for (const [etiqueta, valor, referencia, dec] of lineas) {
    const coincide = Math.abs(valor - referencia) < 0.01
    if (!coincide) todoBien = false
    console.log(
      `  ${etiqueta.padEnd(20)} ${numero(valor, dec).padStart(10)} ${numero(referencia, dec).padStart(12)}     ${coincide ? 'si' : 'NO'}`,
    )
  }

  console.log('  ----------------------------------------------------------')
  console.log(
    todoBien
      ? '  Los indicadores del sistema reproducen exactamente el Excel.'
      : '  Hay diferencias: revisa los registros marcados arriba.',
  )
  console.log('')
}

main()
  .catch((error) => {
    console.error('\n  ' + error.message + '\n')
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
