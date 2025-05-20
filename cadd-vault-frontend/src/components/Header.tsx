// src/components/Header.tsx
import React, { useState, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Link, TextField, Button, Typography, IconButton, Tooltip, useMediaQuery, Menu, MenuItem, Divider } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddIcon from '@mui/icons-material/Add';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
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
	const { currentUser, logout, isAdmin } = useAuth(); // Removed signInWithEmail as it's not directly used here
	const navigate = useNavigate();
	const location = useLocation();
	const isAboutPage = location.pathname === '/about';
	const [inputValue, setInputValue] = useState(searchTerm);
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
	const [anchorElUserMenu, setAnchorElUserMenu] = useState<null | HTMLElement>(null);

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

	const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorElUserMenu(event.currentTarget);
	};
	const handleCloseUserMenu = () => {
		setAnchorElUserMenu(null);
	};

	const handleLogout = async () => {
		handleCloseUserMenu();
		try {
			await logout();
			navigate('/');
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	const handleLogin = () => {
		handleCloseUserMenu();
		setIsLoginModalOpen(true);
	};

	const handleCloseLoginModal = () => {
		setIsLoginModalOpen(false);
	};

	const handleOpenSignupModal = () => {
		handleCloseUserMenu();
		setIsLoginModalOpen(false);
		setIsSignupModalOpen(true);
	};

	const handleCloseSignupModal = () => {
		setIsSignupModalOpen(false);
	};

	const handleNavigate = (path: string) => {
		handleCloseUserMenu();
		navigate(path);
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
				{!isAboutPage && isSmallScreen && (
					<IconButton
						color="inherit"
						aria-label="toggle filter sidebar"
						edge="start"
						onClick={handleFilterToggle}
						sx={{ mr: 1 }} // Reduced margin for small screens
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
							height: isSmallScreen ? '28px' : '36px', // Adjusted logo size
							marginRight: isSmallScreen ? '4px' : '8px',
						}}
					/>
				</Link>

				<Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, mr: 2 }}>
					<Button
						component={RouterLink}
						to="/"
						color="inherit"
						size="small"
						sx={{ fontWeight: location.pathname === '/' ? 'bold' : 'normal', textTransform: 'none' }}
					>
						Home
					</Button>
					<Button
						component={RouterLink}
						to="/about"
						color="inherit"
						size="small"
						sx={{ fontWeight: location.pathname === '/about' ? 'bold' : 'normal', textTransform: 'none' }}
					>
						About
					</Button>
					{currentUser && (
						<Button
							component={RouterLink}
							to="/suggest-package"
							color="inherit"
							size="small"
							sx={{ fontWeight: location.pathname === '/suggest-package' ? 'bold' : 'normal', textTransform: 'none' }}
						>
							Suggest Package
						</Button>
					)}
				</Box>

				<Box sx={{ flexGrow: 1, mx: { xs: 0, md: 2 } }}>
					{!isAboutPage && !isSmallScreen && (
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Search packages..."
							value={inputValue}
							onChange={handleInputChange}
							InputProps={{
								startAdornment: (
									<SearchIcon sx={{ mr: 1, color: 'action.active' }} />
								),
							}}
							sx={{
								'& .MuiOutlinedInput-root': {
									borderRadius: '20px', // Keep rounded search bar
								},
								maxWidth: 500, // Limit search bar width
							}}
						/>
					)}
				</Box>

				<Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
					<ThemeToggle />

					{currentUser ? (
						<>
							<Tooltip title="User Menu">
								<IconButton onClick={handleOpenUserMenu} size="small" sx={{ p: 0.5 }}>
									<AccountCircleIcon sx={{ color: 'primary.main' }} />
								</IconButton>
							</Tooltip>
							<Menu
								sx={{ mt: '45px' }}
								id="menu-appbar"
								anchorEl={anchorElUserMenu}
								anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
								keepMounted
								transformOrigin={{ vertical: 'top', horizontal: 'right' }}
								open={Boolean(anchorElUserMenu)}
								onClose={handleCloseUserMenu}
							>
								<MenuItem disabled>
									<Typography variant="caption" color="textSecondary">
										{currentUser.email}
									</Typography>
								</MenuItem>
								<Divider />
								{isSmallScreen && ( // Show Suggest Package in menu for small screens if logged in
									<MenuItem onClick={() => handleNavigate('/suggest-package')}>
										<AddIcon sx={{ mr: 1 }} /> Suggest Package
									</MenuItem>
								)}
								<MenuItem onClick={() => handleNavigate('/my-suggestions')}>
									<ListAltIcon sx={{ mr: 1 }} /> My Suggestions
								</MenuItem>
								{isAdmin && (
									<MenuItem onClick={() => handleNavigate('/add-package')}>
										<AddIcon sx={{ mr: 1 }} /> Add Package (Admin)
									</MenuItem>
								)}
								{isAdmin && (
									<MenuItem onClick={() => handleNavigate('/admin/review-suggestions')}>
										<AdminPanelSettingsIcon sx={{ mr: 1 }} /> Review Suggestions
									</MenuItem>
								)}
								<Divider />
								<MenuItem onClick={handleLogout}>
									<ExitToAppIcon sx={{ mr: 1 }} /> Logout
								</MenuItem>
							</Menu>
						</>
					) : (
						<Button color="inherit" onClick={handleLogin} size="small">Login</Button>
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
					{!isAboutPage && isSmallScreen && ( // Right menu toggle for small screens
						<IconButton
							color="inherit"
							aria-label="toggle navigation sidebar"
							edge="end"
							onClick={handleNavToggle}
							sx={{ ml: 0.5 }}
						>
							<MenuIcon />
						</IconButton>
					)}
				</Box>
			</Toolbar>
			<LoginModal open={isLoginModalOpen} onClose={handleCloseLoginModal} onOpenSignup={handleOpenSignupModal} />
			<SignupModal open={isSignupModalOpen} onClose={handleCloseSignupModal} />
		</AppBar>
	);
}
