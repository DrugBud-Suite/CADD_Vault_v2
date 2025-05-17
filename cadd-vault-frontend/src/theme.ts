import { createTheme, alpha } from '@mui/material/styles';

// It's good practice to define your palette colors as constants first
const PALETTE = {
	// Primary
	primaryBlue: '#3B82F6', // Main primary
	primaryBlueDark: '#2563EB', // Darker shade for hover/active

	// Accent
	accentOrange: '#F59E0B',
	accentOrangeDark: '#D97706',

	// Neutrals
	white: '#FFFFFF',
	black: '#000000',
	neutralBg: '#F3F4F6',      // Lightest gray for app background
	neutralSurface: '#FFFFFF', // For cards, modals etc.
	neutralTextDark: '#1F2937',  // Main text color
	neutralTextMedium: '#4B5563', // Secondary text
	neutralTextLight: '#6B7280',  // Tertiary text, placeholders
	neutralBorder: '#D1D5DB',   // Borders, dividers

	// Semantic
	success: '#10B981',
	error: '#EF4444',
	warning: '#FBBF24',
};

// Gradient definitions
const LIGHT_GRADIENTS = {
	sidebar: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
	card: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
	activeCard: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(37,99,235,0.05) 100%)',
	highlight: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%)',
};

const DARK_GRADIENTS = {
	sidebar: 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(23,23,23,0.95) 100%)',
	card: 'linear-gradient(135deg, rgba(30,30,30,0.8) 0%, rgba(23,23,23,0.8) 100%)',
	activeCard: 'linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(59,130,246,0.1) 100%)',
	highlight: 'linear-gradient(135deg, rgba(96,165,250,0.15) 0%, rgba(59,130,246,0.15) 100%)',
};

// Base theme options shared between light and dark
const baseThemeOptions = {
	typography: {
		fontFamily: [
			'Inter',
			'-apple-system',
			'BlinkMacSystemFont',
			'"Segoe UI"',
			'Roboto',
			'"Helvetica Neue"',
			'Arial',
			'sans-serif',
			'"Apple Color Emoji"',
			'"Segoe UI Emoji"',
			'"Segoe UI Symbol"',
		].join(','),
		h1: { fontFamily: '"Inter", sans-serif', fontWeight: 700 },
		h2: { fontFamily: '"Inter", sans-serif', fontWeight: 700 },
		h3: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
		h4: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
		h5: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
		h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
	},
	shape: {
		borderRadius: 8, // Slightly more rounded corners
	},
};

// Define dark mode specific colors
const DARK_PALETTE = {
	background: '#121212', // Material Design dark theme background
	surface: '#1E1E1E',   // Slightly lighter than background
	textPrimary: '#FFFFFF',
	textSecondary: '#B3B3B3',
	divider: 'rgba(255, 255, 255, 0.12)',
	// Lighter versions of primary colors for dark mode
	primaryBlue: '#60A5FA', // Much lighter blue for dark mode
	primaryBlueDark: '#93C5FD', // Even lighter for hover states
};

export const lightTheme = createTheme({
	...baseThemeOptions,
	palette: {
		mode: 'light',
		primary: {
			main: PALETTE.primaryBlue,
			dark: PALETTE.primaryBlueDark,
			contrastText: PALETTE.white,
		},
		secondary: {
			main: PALETTE.accentOrange,
			dark: PALETTE.accentOrangeDark,
			contrastText: PALETTE.neutralTextDark,
		},
		error: {
			main: PALETTE.error,
		},
		warning: {
			main: PALETTE.warning,
		},
		success: {
			main: PALETTE.success,
		},
		background: {
			default: PALETTE.neutralBg,
			paper: PALETTE.neutralSurface,
		},
		text: {
			primary: PALETTE.neutralTextDark,
			secondary: PALETTE.neutralTextMedium,
			disabled: PALETTE.neutralTextLight,
		},
		divider: PALETTE.neutralBorder,
	},
	components: {
		MuiCssBaseline: {
			styleOverrides: (theme) => ({
				':root': {
					'--chip-border-color': theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.light,
					'--chip-text-color': theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
				},
			}),
		},
		MuiDrawer: {
			styleOverrides: {
				paper: {
					background: LIGHT_GRADIENTS.sidebar,
					backdropFilter: 'blur(8px)',
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					backgroundColor: '#ffffff',
					boxShadow: 'none',
					borderBottom: `1px solid ${alpha('#212529', 0.12)}`,
				},
			},
		},
		MuiCard: {
			defaultProps: {
				variant: 'outlined',
			},
			styleOverrides: {
				root: ({ theme }) => ({
					border: 'none',
					background: LIGHT_GRADIENTS.card,
					backdropFilter: 'blur(8px)',
					boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}`,
					'&:hover': {
						background: LIGHT_GRADIENTS.activeCard,
						boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
					},
				}),
			},
		},
	},
});

export const darkTheme = createTheme({
	...baseThemeOptions,
	palette: {
		mode: 'dark',
		primary: {
			main: DARK_PALETTE.primaryBlue,
			dark: DARK_PALETTE.primaryBlueDark,
			light: '#60A5FA',
			contrastText: PALETTE.white,
		},
		secondary: {
			main: PALETTE.accentOrange,
			dark: PALETTE.accentOrangeDark,
			light: '#FCD34D',
			contrastText: PALETTE.black,
		},
		error: {
			main: PALETTE.error,
			light: '#F87171',
		},
		warning: {
			main: PALETTE.warning,
			light: '#FCD34D',
		},
		success: {
			main: PALETTE.success,
			light: '#34D399',
		},
		background: {
			default: DARK_PALETTE.background,
			paper: DARK_PALETTE.surface,
		},
		text: {
			primary: DARK_PALETTE.textPrimary,
			secondary: DARK_PALETTE.textSecondary,
			disabled: 'rgba(255, 255, 255, 0.5)',
		},
		divider: DARK_PALETTE.divider,
	},
	components: {
		MuiCssBaseline: {
			styleOverrides: (theme) => ({
				':root': {
					'--chip-border-color': theme.palette.primary.light,
					'--chip-text-color': theme.palette.primary.light,
					'--chip-bg-color': alpha(theme.palette.primary.main, 0.2),
				},
			}),
		},
		MuiDrawer: {
			styleOverrides: {
				paper: {
					background: DARK_GRADIENTS.sidebar,
					backdropFilter: 'blur(8px)',
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: ({ theme }) => ({
					backgroundColor: alpha(DARK_PALETTE.surface, 0.8),
					backdropFilter: 'blur(8px)',
					borderBottom: `1px solid ${theme.palette.divider}`,
				}),
			},
		},
		MuiCard: {
			defaultProps: {
				variant: 'outlined',
			},
			styleOverrides: {
				root: ({ theme }) => ({
					border: 'none',
					background: DARK_GRADIENTS.card,
					backdropFilter: 'blur(8px)',
					boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
					'&:hover': {
						background: DARK_GRADIENTS.activeCard,
						boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
					},
				}),
			},
		},
	},
});