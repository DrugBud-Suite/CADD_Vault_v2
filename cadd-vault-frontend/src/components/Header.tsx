import React, { useState, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Link, TextField, Button, Typography, IconButton, useMediaQuery } from '@mui/material'; // Add useMediaQuery
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search'; // Import SearchIcon
import { useTheme } from '@mui/material/styles';
import { useFilterStore } from '../store/filterStore';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { debounce } from 'lodash-es';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';

import caddVaultDarkLogo from '../assets/caddvault_dark.png';
import caddVaultWhiteLogo from '../assets/caddvault_white.png';

export default function Header() {
	const theme = useTheme();
	const {
		searchTerm,
		setSearchTerm,
		toggleFilterSidebar,
		toggleNavSidebar,
		isFilterSidebarVisible,
		isNavSidebarVisible
	} = useFilterStore();
	const { currentUser, logout, isAdmin, signInWithEmail } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const isAboutPage = location.pathname === '/about';
	const [inputValue, setInputValue] = useState(searchTerm);
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

	// Add media query check
	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));

	const debouncedUpdate = useCallback(
		debounce((value: string) => {
			setSearchTerm(value);
		}, 300),
		[setSearchTerm]
	);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = event.target.value;
		setInputValue(newValue);
		debouncedUpdate(newValue);
	};

	const handleLogout = async () => {
		try {
			await logout();
			navigate('/');
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	const handleLogin = () => {
		setIsLoginModalOpen(true);
	};

	const handleCloseLoginModal = () => {
		setIsLoginModalOpen(false);
	};

	const handleOpenSignupModal = () => {
		setIsLoginModalOpen(false); // Close login modal
		setIsSignupModalOpen(true); // Open signup modal
	};

	const handleCloseSignupModal = () => {
		setIsSignupModalOpen(false);
	};

	const handleAddPackage = () => {
		navigate('/add-package');
	};

	const handleFilterToggle = () => {
		toggleFilterSidebar();
	};

	const handleNavToggle = () => {
		toggleNavSidebar();
	};

	return (
		<AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: 'background.paper', color: 'text.primary' }}>
			<Toolbar>
				{/* Show appropriate toggle based on screen size */}
				{!isAboutPage && isSmallScreen && (
					<IconButton
						color="inherit"
						aria-label="toggle filter sidebar"
						edge="start"
						onClick={handleFilterToggle}
						sx={{ mr: 2 }}
					>
						<MenuIcon />
					</IconButton>
				)}
				{!isAboutPage && !isSmallScreen && (
					<IconButton
						color="inherit"
						aria-label="toggle filter sidebar"
						edge="start"
						onClick={handleFilterToggle}
						sx={{ mr: 2 }}
					>
						{isFilterSidebarVisible ? <ChevronLeftIcon /> : <MenuIcon />}
					</IconButton>
				)}

				<Link component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', mr: 2, textDecoration: 'none' }}>
					<Box
						component="img"
						src={theme.palette.mode === 'dark' ? caddVaultWhiteLogo : caddVaultDarkLogo}
						alt="CADD Vault Logo"
						sx={{
							height: isSmallScreen ? '30px' : '40px', // Adjust logo size based on screen size
							marginRight: '10px',
						}}
					/>
				</Link>

				<Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
					<Button
						component={RouterLink}
						to="/"
						color="inherit"
						size="small"
						sx={{
							fontWeight: location.pathname === '/' ? 'bold' : 'normal',
							textTransform: 'none'
						}}
					>
						Home
					</Button>
					<Button
						component={RouterLink}
						to="/about"
						color="inherit"
						size="small"
						sx={{
							fontWeight: location.pathname === '/about' ? 'bold' : 'normal',
							textTransform: 'none'
						}}
					>
						About
					</Button>
				</Box>

				<Box sx={{ flexGrow: 1, mx: 2 }}>
					{!isAboutPage && (
						isSmallScreen ? (
							// Show search icon on small screens
							<IconButton color="inherit" aria-label="open search">
								<SearchIcon />
							</IconButton>
						) : (
							// Show search bar on larger screens
							<TextField
								fullWidth
								variant="outlined"
								size="small"
								placeholder="Search packages..."
								value={inputValue}
								onChange={handleInputChange}
								sx={{
									'& .MuiOutlinedInput-root': {
										borderRadius: '20px',
									},
								}}
							/>
						)
					)}
				</Box>

				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<ThemeToggle />

					{isAdmin && (
						<Button
							variant="contained"
							color="primary"
							size="small"
							onClick={handleAddPackage}
							sx={{ ml: 1, mr: 1 }}
						>
							Add Package
						</Button>
					)}

					{currentUser ? (
						<Button color="inherit" onClick={handleLogout} size="small">Logout</Button>
					) : (
						<Button color="inherit" onClick={handleLogin} size="small">Login</Button>
					)}

					{/* Show appropriate toggle based on screen size */}
					{!isAboutPage && isSmallScreen && (
						<IconButton
							color="inherit"
							aria-label="toggle navigation sidebar"
							edge="end"
							onClick={handleNavToggle}
							sx={{ ml: 1 }}
						>
							<MenuIcon />
						</IconButton>
					)}
					{!isAboutPage && !isSmallScreen && (
						<IconButton
							color="inherit"
							aria-label="toggle navigation sidebar"
							edge="end"
							onClick={handleNavToggle}
							sx={{ ml: 1 }}
						>
							{isNavSidebarVisible ? <ChevronRightIcon /> : <MenuIcon />}
						</IconButton>
					)}
				</Box>
			</Toolbar>
			<LoginModal open={isLoginModalOpen} onClose={handleCloseLoginModal} onOpenSignup={handleOpenSignupModal} />
			<SignupModal open={isSignupModalOpen} onClose={handleCloseSignupModal} />
		</AppBar>
	);
}