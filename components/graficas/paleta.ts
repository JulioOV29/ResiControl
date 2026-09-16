/**
 * Paleta de las graficas.
 *
 * Son los mismos colores del tema y no una paleta aparte: la serie principal es
 * marca-600 y la segunda acento-600, y todo el cromado sale de la rampa obra.
 * Antes los grises de aqui eran calidos y los de la aplicacion frios, asi que
 * las graficas se veian de otro juego que las tarjetas que las contienen.
 *
 * El par de series esta validado sobre superficie blanca: separacion 32,9 en
 * vision normal y 27,0 en el peor caso bajo daltonismo, muy por encima del
 * minimo de 8. Los grises son el cromado, que va por detras del dato y nunca
 * compite con el.
 */
export const paleta = {
  /** Serie principal: produccion, rendimiento, avance. Es marca-600. */
  serie1: '#2a78d6',
  /** Segunda serie: metas, referencias y comparaciones. Es acento-600. */
  serie2: '#d97706',
  /** Pista de los medidores: lo que falta por ejecutar. obra-100. */
  pista: '#eceef2',
  /** Lineas de rejilla, finas y solidas, un paso por encima del fondo. */
  rejilla: '#eceef2',
  /** Ejes y textos de los ticks: obra-200 y obra-500. */
  eje: '#d5dae3',
  ticks: '#657793',
  /** Superficie de la tarjeta: es la que separa las marcas entre si. */
  superficie: '#ffffff',
  textoPrincipal: '#0f172a',
  textoSecundario: '#505f79',
} as const

/** Grosor maximo de una barra: nunca llena la banda, el aire es parte del diseno. */
export const GROSOR_BARRA = 24
