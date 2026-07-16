import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const config = {
  plugins: {
    '@tailwindcss/postcss': {
      base: dirname(fileURLToPath(import.meta.url)),
    },
  },
}

export default config
