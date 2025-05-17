import { useThemeValue, useThemeUpdater } from './ThemeContext'
import { FiSun, FiMoon } from 'react-icons/fi'
import { IconButton, Tooltip } from '@mui/material'

export default function ThemeToggle() {
	const { darkMode } = useThemeValue()
	const { toggleTheme } = useThemeUpdater()

	return (
		<Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
			<IconButton onClick={toggleTheme} color="primary">
				{darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
			</IconButton>
		</Tooltip>
	)
}