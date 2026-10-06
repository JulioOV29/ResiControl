/** Colores de las graficas, tomados del tema (marca, acento y obra). */
export const paleta = {
  /** Serie principal (marca-500). */
  serie1: '#6672ef',
  /** Segunda serie: metas y referencias (menta-400). */
  serie2: '#3fc392',
  /** Fondo de las barras de progreso (obra-100). */
  pista: '#eef0f6',
  /** Lineas de rejilla (casi invisibles). */
  rejilla: '#eef0f6',
  /** Ejes y textos (obra-200 y obra-500). */
  eje: '#e2e5ee',
  ticks: '#6b7390',
  /** Fondo de la tarjeta. */
  superficie: '#ffffff',
  textoPrincipal: '#191d30',
  textoSecundario: '#586079',
} as const

/** Ancho maximo de una barra. */
export const GROSOR_BARRA = 24
