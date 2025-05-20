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
import HomeIcon from '@mui/icons-material/Home';
import InfoIcon from '@mui/icons-material/Info';
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
	const { currentUser, logout, isAdmin } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const isAboutPage = location.pathname === '/about';
	const [inputValue, setInputValue] = useState(searchTerm);
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
	const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
	const [anchorElUserMenu, setAnchorElUserMenu] = useState<null | HTMLElement>(null);

	const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));

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

	// Tooltip text for user icon
	const userTooltipTitle = currentUser
		? `User ID: ${currentUser.id || 'N/A'}, Email: ${currentUser.email}`
		: "User Menu";


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

				{/* Home and About Links - Responsive */}
				{isSmallScreen ? (
					<Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mr: 1 }}>
						{!isAboutPage && (
							<Tooltip title="Home">
								<IconButton component={RouterLink} to="/" color="inherit" size="small">
									<HomeIcon />
								</IconButton>
							</Tooltip>
						)}
						<Tooltip title="About">
							<IconButton component={RouterLink} to="/about" color="inherit" size="small">
								<InfoIcon />
							</IconButton>
						</Tooltip>
					</Box>
				) : (
					<Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
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
						</Box>
				)}

				{/* Search bar (if not on About page) or Spacer (if on About page) */}
				{!isAboutPage ? (
					<Box sx={{
						flexGrow: 1,
						mx: { xs: 1, sm: 1.5, md: 2 }, // Adjusted horizontal margins for responsiveness
						minWidth: isSmallScreen ? 120 : 'auto', // Ensure some minWidth on small screens
					}}>
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Search..."
							value={inputValue}
							onChange={handleInputChange}
							InputProps={{
								startAdornment: (
									<SearchIcon sx={{ mr: 1, color: 'action.active' }} />
								),
							}}
							sx={{
								'& .MuiOutlinedInput-root': {
									borderRadius: '20px',
								},
								// Apply maxWidth on larger screens, allow flexibility on smaller ones
								maxWidth: !isSmallScreen ? 500 : undefined,
							}}
						/>
					</Box>
				) : (
					<Box sx={{ flexGrow: 1 }} /> // Spacer only when on About page
				)}


				{/* User Action Text Buttons for Large Screens */}
				{!isSmallScreen && (
					<Box sx={{ display: 'flex', gap: 1, mr: 2, alignItems: 'center' }}>
						{currentUser && (
							<>
								<Button
									component={RouterLink}
									to="/suggest-package"
									variant="outlined"
									color="primary"
									size="small"
									sx={{
										fontWeight: location.pathname === '/suggest-package' ? 'bold' : 'normal',
										textTransform: 'none',
										lineHeight: 1.2,
										textAlign: 'center'
									}}
								>
									Suggest<br />Package
								</Button>
								<Button
									component={RouterLink}
									to="/my-suggestions"
									variant="outlined"
									color="primary"
									size="small"
									sx={{
										fontWeight: location.pathname === '/my-suggestions' ? 'bold' : 'normal',
										textTransform: 'none',
										lineHeight: 1.2,
										textAlign: 'center'
									}}
								>
									My<br />Suggestions
								</Button>
							</>
						)}
						{currentUser && isAdmin && (
							<>
								<Button
									component={RouterLink}
									to="/add-package"
									variant="contained" // More distinct for admin
									color="secondary"
									size="small"
									sx={{
										fontWeight: location.pathname === '/add-package' ? 'bold' : 'normal',
										textTransform: 'none',
										lineHeight: 1.2,
										textAlign: 'center'
									}}
								>
									Add<br />Package
								</Button>
								<Button
									component={RouterLink}
									to="/admin/review-suggestions"
									variant="contained" // More distinct for admin
									color="secondary"
									size="small"
									sx={{
										fontWeight: location.pathname === '/admin/review-suggestions' ? 'bold' : 'normal',
										textTransform: 'none',
										lineHeight: 1.2,
										textAlign: 'center'
									}}
								>
									Review<br />Suggestions
								</Button>
							</>
						)}
					</Box>
				)}

				<Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
					{/* User Action Icons for Small Screens */}
					{isSmallScreen && currentUser && (
						<>
							<Tooltip title="Suggest Package">
								<IconButton component={RouterLink} to="/suggest-package" color="inherit" size="small">
									<AddIcon />
								</IconButton>
							</Tooltip>
							<Tooltip title="My Suggestions">
								<IconButton component={RouterLink} to="/my-suggestions" color="inherit" size="small">
									<ListAltIcon />
								</IconButton>
							</Tooltip>
							{isAdmin && (
								<>
									<Tooltip title="Add Package (Admin)">
										<IconButton component={RouterLink} to="/add-package" color="secondary" size="small">
											<AddIcon />
										</IconButton>
									</Tooltip>
									<Tooltip title="Review Suggestions (Admin)">
										<IconButton component={RouterLink} to="/admin/review-suggestions" color="secondary" size="small">
											<AdminPanelSettingsIcon />
										</IconButton>
									</Tooltip>
								</>
							)}
						</>
					)}
					<ThemeToggle />

					{currentUser ? (
						<>
							<Tooltip title={userTooltipTitle}>
								<IconButton onClick={handleOpenUserMenu} size="small" sx={{ p: 0.5 }}>
									<AccountCircleIcon sx={{ color: 'primary.main', fontSize: 30 }} />
								</IconButton>
							</Tooltip>
							<Menu
								sx={{
									mt: '45px',
									'& .MuiPaper-root': {
										borderRadius: '8px',
										boxShadow: '0px 4px 20px rgba(0,0,0,0.1)',
										minWidth: 220,
									},
								}}
								id="menu-appbar"
								anchorEl={anchorElUserMenu}
								anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
								keepMounted
								transformOrigin={{ vertical: 'top', horizontal: 'right' }}
								open={Boolean(anchorElUserMenu)}
								onClose={handleCloseUserMenu}
							>
								<Box sx={{ px: 2, py: 1.5 }}>
									<Typography variant="subtitle1" fontWeight="bold">
										{/* Assuming User type might not have displayName, fallback to email part or 'User' */}
										{(currentUser as any).displayName || currentUser.email?.split('@')[0] || 'User'}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{currentUser.email}
									</Typography>
								</Box>
								<Divider sx={{ my: 0.5 }} />
								<MenuItem onClick={handleLogout} sx={{ borderRadius: '6px', mx: 1, color: 'error.main' }}>
									<ExitToAppIcon sx={{ mr: 1.5 }} /> Logout
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
