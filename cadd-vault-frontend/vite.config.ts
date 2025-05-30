import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	base: '/CADD_Vault_v2/',
	plugins: [react()],
	css: {
	},
	server: {
		port: 5173,
		strictPort: true,
	}
})
