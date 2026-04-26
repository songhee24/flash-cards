import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Relative base works with GitHub Pages project sites when using HashRouter.
export default defineConfig({
  base: './',
  plugins: [react()],
})
