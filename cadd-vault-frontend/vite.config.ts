import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	// Build the CSP from the active environment so dev (local Supabase on
	// 127.0.0.1:54321) and prod (hosted Supabase) each get only the origins
	// they actually need. Single source of truth: VITE_SUPABASE_URL.
	const env = loadEnv(mode, process.cwd(), '')
	const supabaseUrl = env.VITE_SUPABASE_URL ?? ''
	const supabaseWsUrl = supabaseUrl.replace(/^http/, 'ws') // http->ws, https->wss

	const csp = [
		"default-src 'self'",
		'frame-src https://challenges.cloudflare.com',
		// No 'unsafe-inline' in script-src: the production build emits only
		// external <script src> tags (verified). style-src keeps it because
		// MUI/emotion inject inline <style> at runtime.
		"script-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com",
		"style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data: https:",
		`connect-src 'self' ${supabaseUrl} ${supabaseWsUrl}`.replace(/\s+/g, ' ').trim(),
	].join('; ') + ';'

	return {
		base: '/CADD_Vault_v2/',
		plugins: [
			react(),
			{
				name: 'inject-csp-meta',
				enforce: 'pre' as const,
				transformIndexHtml(html: string) {
					return html.replace('%CSP%', csp)
				},
			},
		],
		css: {
		},
		server: {
			port: 5173,
			strictPort: true,
		}
	}
})
