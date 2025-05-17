import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import App from './App'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { AuthProvider } from './context/AuthContext';
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
		<BrowserRouter basename="/CADD_Vault_v2/">
			<AuthProvider>
				<ThemeProvider> {/* Our context provider */}
					<AppWrapper /> {/* Wrapper that consumes context and applies MUI theme */}
				</ThemeProvider>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>,
)
