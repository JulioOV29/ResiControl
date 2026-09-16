import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obra: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0bacb',
          400: '#8595ad',
          500: '#657793',
          600: '#505f79',
          700: '#424d63',
          800: '#3a4253',
          900: '#0f172a',
          950: '#080d18',
        },
        /**
         * Color de accion: item activo del menu, barras de progreso, enlaces,
         * numeros destacados y la serie principal de las graficas.
         *
         * No es un color nuevo. El 600 es el mismo azul que ya usaban las
         * graficas, solo que antes no salia de ahi. Regla de uso: el 600 para
         * marcas y rellenos, el 700 para texto, porque el 600 sobre blanco se
         * queda en 4,42 de contraste y el minimo para texto normal es 4,5.
         */
        marca: {
          50: '#f0f7ff',
          100: '#dcebfe',
          200: '#bad8fd',
          300: '#8cbcf8',
          400: '#5b9ef1',
          500: '#3784e1',
          600: '#2a78d6',
          700: '#1f61b2',
          800: '#1b4e8d',
          900: '#1a4170',
          950: '#112945',
        },
        /** Realce y aviso: subregistros, foco de los campos, segunda serie. */
        acento: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
