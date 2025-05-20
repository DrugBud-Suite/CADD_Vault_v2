import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { lightTheme, darkTheme } from '../theme';
import { Theme } from '@mui/material/styles'; // Import Theme type

// Context for theme values (read-only)
type ThemeValueContextType = {
	darkMode: boolean;
	theme: Theme; // Use the imported Theme type
};

const ThemeValueContext = createContext<ThemeValueContextType>({
	darkMode: false,
	theme: lightTheme,
});

// Context for the theme update function
type ThemeUpdateContextType = {
	toggleTheme: () => void;
};

const ThemeUpdateContext = createContext<ThemeUpdateContextType>({
	toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [darkMode, setDarkMode] = useState(false);

	useEffect(() => {
		const isDark = localStorage.getItem('darkMode') === 'true';
		setDarkMode(isDark);
	}, []);

	const toggleTheme = useCallback(() => {
		const newMode = !darkMode;
		setDarkMode(newMode);
		localStorage.setItem('darkMode', newMode.toString());
	}, [darkMode]);

	// Memoize the theme object itself based on darkMode
	const theme = useMemo(() => (darkMode ? darkTheme : lightTheme), [darkMode]);

	// Memoize the value for the ThemeValueContext
	const themeValue = useMemo(() => ({
		darkMode,
		theme,
	}), [darkMode, theme]);

	// Memoize the value for the ThemeUpdateContext
	// toggleTheme is already memoized with useCallback, so its reference is stable
	const updateValue = useMemo(() => ({
		toggleTheme,
	}), [toggleTheme]);

	return (
		<ThemeUpdateContext.Provider value={updateValue}>
			<ThemeValueContext.Provider value={themeValue}>
				{children}
			</ThemeValueContext.Provider>
		</ThemeUpdateContext.Provider>
	);
}

// Hook to consume theme values
export const useThemeValue = () => useContext(ThemeValueContext);

// Hook to consume theme update function
export const useThemeUpdater = () => useContext(ThemeUpdateContext);

// Optional: Keep the old hook for compatibility or refactor its usage later
// This combines both contexts, potentially causing re-renders if only the updater is needed.
// It's generally better to use the specific hooks above.
export const useTheme = () => {
	const themeValue = useThemeValue();
	const themeUpdater = useThemeUpdater();
	return { ...themeValue, ...themeUpdater };
};