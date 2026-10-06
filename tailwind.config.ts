import type { Config } from 'tailwindcss'

const config: Config = {
  /** Solo .tsx: incluir los .ts hacia que Tailwind vigilara las rutas de la API. */
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        /**
         * Neutros frios (gris azulado): fondos, bordes y textos.
         * 500 es el minimo para texto secundario (4,7 de contraste sobre blanco).
         */
        obra: {
          50: '#f6f7fb',
          100: '#eef0f6',
          200: '#e2e5ee',
          300: '#c8cddc',
          400: '#9ba2b8',
          500: '#6b7390',
          600: '#586079',
          700: '#3f4660',
          800: '#2a3048',
          900: '#191d30',
          950: '#0e1120',
        },
        /**
         * Color de accion (azul lavanda): botones, menu activo, enlaces,
         * barras de progreso y la serie principal de las graficas.
         * 600 para rellenos y botones (5,1 sobre blanco), 700 para texto.
         */
        marca: {
          50: '#f1f3ff',
          100: '#e4e8ff',
          200: '#cdd4fe',
          300: '#aab4fb',
          400: '#8591f6',
          500: '#6672ef',
          600: '#5260e3',
          700: '#4350c8',
          800: '#3943a2',
          900: '#333c80',
          950: '#1f234b',
        },
        /** Verde menta: lo terminado y la segunda serie de las graficas. */
        menta: {
          50: '#ecfbf4',
          100: '#d2f5e5',
          200: '#a8eacd',
          300: '#72d9b0',
          400: '#3fc392',
          500: '#22a979',
          600: '#178862',
          700: '#156c51',
          800: '#145641',
          900: '#124737',
        },
        /** Realce y aviso: subregistros, pendientes, alertas suaves. */
        acento: {
          50: '#fff8eb',
          100: '#ffedc8',
          200: '#ffd98c',
          300: '#fdc45a',
          400: '#f7ad34',
          500: '#ee921a',
          600: '#d27112',
          700: '#ae5213',
          800: '#8d4116',
          900: '#743615',
        },
      },
      /** Sombras suaves: las tarjetas casi flotan sobre el fondo. */
      boxShadow: {
        tarjeta: '0 1px 2px rgba(25, 29, 48, 0.04), 0 4px 16px -4px rgba(25, 29, 48, 0.06)',
        flotante: '0 8px 28px -6px rgba(25, 29, 48, 0.16)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
