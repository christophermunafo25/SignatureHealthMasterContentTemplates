import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // Build-time guard (one of three, see stores/index.ts and App.tsx): a
  // production bundle without Supabase config would silently ship the
  // localStorage dev backend — an unauthenticated admin console.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error(
        'Refusing production build: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.',
      )
    }
  }
  return {
    // Honor the harness-assigned port (autoPort) so multiple sessions can run
    // their own dev servers side by side; falls back to Vite's default.
    server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
