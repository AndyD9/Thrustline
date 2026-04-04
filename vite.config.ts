import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          define: {
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Externalize all node_modules — they're available at runtime in Electron
              external: (id: string) =>
                !id.startsWith('.') &&
                !id.startsWith('/') &&
                !id.startsWith('\0') &&
                !path.isAbsolute(id) &&
                !id.includes('electron/main'),
            },
          },
        },
      },
      // NOTE: preload is NOT compiled by Vite — it lives as a static CJS file
      // at electron/preload.cjs and is referenced directly. Vite-plugin-electron
      // cannot reliably produce a CJS-only output when "type":"module" is set.
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  }
})
