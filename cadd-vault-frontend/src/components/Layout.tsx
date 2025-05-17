import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, Drawer, useTheme, CssBaseline, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Header from './Header';
import FilterSidebar from './FilterSidebar';
import TableOfContentsSidebar from './TableOfContentsSidebar';
import { useFilterStore } from '../store/filterStore';

// Define sidebar widths as constants for easier management
const filterSidebarWidth = 250;
const navSidebarWidth = 250;

export default function Layout({ children }: { children?: React.ReactNode }) {
	const location = useLocation();
	const theme = useTheme();
	const isAboutPage = location.pathname === '/about';

	const isFilterSidebarVisible = useFilterStore((state) => state.isFilterSidebarVisible);
	const isNavSidebarVisible = useFilterStore((state) => state.isNavSidebarVisible);
	const toggleFilterSidebar = useFilterStore((state) => state.toggleFilterSidebar);
	const toggleNavSidebar = useFilterStore((state) => state.toggleNavSidebar);

	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

	useEffect(() => {
		if (isSmallScreen) {
			toggleFilterSidebar();
			toggleNavSidebar();
		}
	}, [isSmallScreen, toggleFilterSidebar, toggleNavSidebar]);

	// Common drawer paper styles
	const drawerPaperStyles = {
		boxSizing: 'border-box',
		top: '64px',
		height: 'calc(100vh - 64px)',
		backdropFilter: 'blur(8px)',
		background: theme.palette.mode === 'dark'
			? 'linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(23,23,23,0.95) 100%)'
			: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
		boxShadow: theme.palette.mode === 'dark'
			? `inset 0 0 30px ${alpha(theme.palette.background.default, 0.1)}`
			: `inset 0 0 30px ${alpha(theme.palette.primary.main, 0.03)}`,
	};

	return (
		<Box sx={{ display: 'flex', minHeight: '100vh' }}>
			<CssBaseline />
			<Header />

			{!isAboutPage && (
				<Drawer
					variant={isSmallScreen ? 'temporary' : 'persistent'}
					anchor="left"
					open={isFilterSidebarVisible}
					onClose={isSmallScreen ? toggleFilterSidebar : undefined}
					sx={{
						width: filterSidebarWidth,
						flexShrink: 0,
						'& .MuiDrawer-paper': {
							width: filterSidebarWidth,
							...drawerPaperStyles,
							borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
						},
					}}
				>
					<FilterSidebar />
				</Drawer>
			)}

			<Box
				component="main"
				sx={{
					transition: theme.transitions.create('width', {
						easing: theme.transitions.easing.sharp,
						duration: theme.transitions.duration.leavingScreen,
					}),
					width: isSmallScreen
						? '100%'
						: (!isAboutPage && isFilterSidebarVisible && isNavSidebarVisible)
							? `calc(100% - ${filterSidebarWidth + navSidebarWidth}px)`
							: (!isAboutPage && isFilterSidebarVisible)
								? `calc(100% - ${filterSidebarWidth}px)`
								: (!isAboutPage && isNavSidebarVisible)
									? `calc(100% - ${navSidebarWidth}px)`
									: '100%',
					flexGrow: 1,
					pt: '64px',
					height: '100vh',
					boxSizing: 'border-box',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				<Box
					sx={{
						flexGrow: 1,
						overflowY: 'auto',
						px: 1,
						pb: 3,
						'&::-webkit-scrollbar': { width: '8px' },
						'&::-webkit-scrollbar-track': { background: 'transparent' },
						'&::-webkit-scrollbar-thumb': {
							backgroundColor: 'transparent',
							borderRadius: '4px',
							transition: 'background-color 0.2s',
						},
						'&:hover::-webkit-scrollbar-thumb': {
							backgroundColor: theme.palette.mode === 'dark'
								? alpha(theme.palette.primary.main, 0.2)
								: alpha(theme.palette.primary.main, 0.1)
						},
						scrollbarWidth: 'thin',
						scrollbarColor: `${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)} transparent`,
					}}
				>
					{children || <Outlet />}
				</Box>
			</Box>

			{!isAboutPage && (
				<Drawer
					variant={isSmallScreen ? 'temporary' : 'persistent'}
					anchor="right"
					open={isNavSidebarVisible}
					onClose={isSmallScreen ? toggleNavSidebar : undefined}
					sx={{
						width: navSidebarWidth,
						flexShrink: 0,
						'& .MuiDrawer-paper': {
							width: navSidebarWidth,
							...drawerPaperStyles,
							borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
						},
						transition: theme.transitions.create('margin', {
							easing: theme.transitions.easing.sharp,
							duration: theme.transitions.duration.leavingScreen,
						}),
					}}
				>
					<TableOfContentsSidebar />
				</Drawer>
			)}
		</Box>
	);
}