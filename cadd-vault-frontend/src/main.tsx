import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { AuthProvider } from './context/AuthContext';
import { queryClient } from './lib/react-query/queryClient'
import './index.css'

// Wrapper component to access theme context
function AppWrapper() {
	const { theme } = useTheme();
	return (
		<MuiThemeProvider theme={theme}>
			<CssBaseline /> {/* Apply baseline styles */}
			<App />
		</MuiThemeProvider>
	);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<BrowserRouter basename="/CADD_Vault_v2/">
				<AuthProvider>
					<ThemeProvider> {/* Our context provider */}
						<AppWrapper /> {/* Wrapper that consumes context and applies MUI theme */}
					</ThemeProvider>
				</AuthProvider>
			</BrowserRouter>
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	</React.StrictMode>,
)
