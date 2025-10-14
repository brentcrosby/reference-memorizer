import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/reference-memorizer/' // <-- if your repo name is different, change this to '/YourRepoName/'
})
