/**
 * Guardia de los comandos que borran la base.
 *
 *   npm run rehacer      reconstruye el esquema desde cero
 *   npm run db:reset     lo mismo, sin sembrar ni importar
 *
 * Los dos empiezan por "prisma db push --force-reset", que tira todas las
 * tablas. Una vez se perdio informacion real por correrlos sin pensar, asi que
 * ahora hay que pedirlo dos veces: con la variable CONFIRMO_BORRAR=SI.
 *
 * Y antes de borrar nada, este guardia hace un respaldo. Si el respaldo falla,
 * el borrado no ocurre.
 */
const { execFileSync } = require('child_process')
const path = require('path')

if (process.env.CONFIRMO_BORRAR !== 'SI') {
  console.error(
    [
      '',
      'ESTE COMANDO BORRA TODA LA BASE DE DATOS.',
      '',
      'Tira las tablas y las vuelve a crear vacias: proyectos, obra, jornadas,',
      'tareas, personal y precios. No hay deshacer.',
      '',
      'Si lo que quieres es aplicar un cambio de esquema sin perder datos:',
      '   npm run aplicar',
      '',
      'Si de verdad quieres empezar de cero, pidelo explicitamente:',
      '   CMD:         set CONFIRMO_BORRAR=SI && npm run rehacer',
      '   PowerShell:  $env:CONFIRMO_BORRAR="SI"; npm run rehacer',
      '',
      'Antes de borrar se hara un respaldo en respaldos/, que se recupera con:',
      '   npm run restaurar respaldos/<archivo>.json',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

console.log('Respaldando antes de borrar...\n')
try {
  execFileSync('node', [path.join(__dirname, 'respaldo.js')], { stdio: 'inherit' })
} catch {
  console.error('\nEl respaldo fallo, asi que no se borra nada. Revisa la conexion y reintenta.')
  process.exit(1)
}

console.log('\nRespaldo hecho. Sigue el borrado...\n')
