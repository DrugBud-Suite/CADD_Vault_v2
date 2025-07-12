// src/pages/HomePage.tsx
import React, { useEffect, lazy, Suspense, ChangeEvent, Fragment } from 'react';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../context/AuthContext';
import { usePackages } from '../hooks/queries/usePackages';
import { useFilterMetadata } from '../hooks/queries/useMetadata';
import {
	Container, Box, Typography, CircularProgress, Alert, Select, MenuItem, IconButton,
	ToggleButtonGroup, ToggleButton, Grid, Pagination, FormControl, SelectChangeEvent
} from '@mui/material';
import { ViewList as ViewListIcon, ViewModule as ViewModuleIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

// Lazy load components
const PackageCard = lazy(() => import('../components/PackageCard'));
const PackageList = lazy(() => import('../components/PackageList'));

const HomePage: React.FC = () => {
	// --- Authentication context ---
	const { currentUser } = useAuth();
	const userId = currentUser?.id || null;

	// --- Zustand Store Selectors using useShallow ---
	const {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minCitations, minRating, folder1, category1, selectedLicenses, sortBy, sortDirection, viewMode, currentPage,
	} = useFilterStore(useShallow(state => ({
		searchTerm: state.searchTerm,
		selectedTags: state.selectedTags,
		minStars: state.minStars,
		hasGithub: state.hasGithub,
		hasWebserver: state.hasWebserver,
		hasPublication: state.hasPublication,
		minCitations: state.minCitations,
		minRating: state.minRating,
		folder1: state.folder1,
		category1: state.category1,
		selectedLicenses: state.selectedLicenses,
		sortBy: state.sortBy,
		sortDirection: state.sortDirection,
		viewMode: state.viewMode,
		currentPage: state.currentPage,
	})));

	// Actions from store (these are stable references)
	const {
		setSort, setViewMode, setCurrentPage,
	} = useFilterStore(useShallow(state => ({
		setSort: state.setSort,
		setViewMode: state.setViewMode,
		setCurrentPage: state.setCurrentPage,
	})));

	const itemsPerPage = 24;

	// --- React Query hooks for data fetching ---
	const { data: metadata, isLoading: metadataLoading, error: metadataError } = useFilterMetadata();

	const packageFilters = {
		searchTerm,
		selectedTags,
		minStars,
		hasGithub,
		hasWebserver,
		hasPublication,
		minCitations,
		minRating,
		folder1,
		category1,
		selectedLicenses,
		sortBy,
		sortDirection,
		page: currentPage,
		pageSize: itemsPerPage,
		includeUserRatings: !!userId,
		currentUserId: userId,
	};

	const { data: packageResult, isLoading: packagesLoading, error: packagesError } = usePackages(packageFilters);

	// --- Update filter store with metadata when it loads ---
	useEffect(() => {
		if (metadata) {
			useFilterStore.setState({
				allAvailableTags: metadata.allAvailableTags,
				allAvailableLicenses: metadata.allAvailableLicenses,
				allAvailableFolders: metadata.allAvailableFolders,
				allAvailableCategories: metadata.allAvailableCategories,
				datasetMaxStars: metadata.datasetMaxStars,
				datasetMaxCitations: metadata.datasetMaxCitations,
			});
		}
	}, [metadata]);

	// --- Derived state ---
	const displayedPackagesInComponent = packageResult?.packages || [];
	const totalFilteredCount = packageResult?.totalCount || 0;
	const loading = metadataLoading || packagesLoading;
	const error = metadataError || packagesError;

	// Determine loading state for UI
	const loadingState = metadataLoading ? 'metadata' : packagesLoading ? 'packages' : 'none';

	// --- Event Handlers ---
	const handlePageChange = (_event: ChangeEvent<unknown>, value: number) => {
		setCurrentPage(value);
		window.scrollTo(0, 0);
	};

	const handleSortChange = (event: SelectChangeEvent<string>) => {
		const value = event.target.value;
		setCurrentPage(1);
		setSort(value === '' ? null : value, sortDirection);
	};

	const handleSortDirectionToggle = () => {
		setCurrentPage(1);
		setSort(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
	};

	const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newViewMode: 'card' | 'list' | null) => {
		if (newViewMode !== null) {
			setViewMode(newViewMode);
		}
	};

	// --- Render Logic ---
	const suspenseFallback = (
		<Box display="flex" justifyContent="center" py={4}>
			<CircularProgress />
		</Box>
	);

	const pageCount = Math.ceil(totalFilteredCount / itemsPerPage);

	return (
		<Container maxWidth="lg" sx={{ pt: 2, px: { xs: 1, sm: 2 }, pb: 0 }}>
			{error && !loading && (
				<Box py={4}>
					<Alert
						severity="error"
						sx={{ mb: 2 }}
					>
						<Typography variant="body1" fontWeight="medium">
							{error?.message || 'An error occurred'}
						</Typography>
						<Typography variant="body2" sx={{ mt: 1 }}>
							Please try again or refresh the page. If the problem persists, contact support.
						</Typography>
					</Alert>
				</Box>
			)}

			{/* Show full loading state only for initial metadata load */}
			{loading && loadingState === 'metadata' && (
				<Box display="flex" flexDirection="column" alignItems="center" py={6} gap={2}>
					<CircularProgress />
					<Typography variant="body1" color="text.secondary" align="center">
						Loading filter options...
					</Typography>
					<Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
						Loading filter options for the best browsing experience.
					</Typography>
				</Box>
			)}

			{/* Header with loading state integration */}
			{loadingState !== 'metadata' && (
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
						{loading && loadingState === 'packages' ? (
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
								<CircularProgress size={24} />
								<Typography variant="h4" component="h1" sx={{
									color: 'text.secondary',
									fontWeight: 500,
									letterSpacing: '-0.01em'
								}}>
									Loading packages...
								</Typography>
							</Box>
						) : (
								<Typography variant="h4" component="h1" sx={{
									mb: { xs: 1, sm: 0 },
									color: 'text.primary',
									fontWeight: 500,
									letterSpacing: '-0.01em'
								}}>
									{totalFilteredCount} Entries Found
								</Typography>
						)}
					</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
					<Typography variant="body2" sx={{ mr: 1, minWidth: 55, color: 'text.secondary' }}>Sort by:</Typography>
					<FormControl size="small" variant="outlined" sx={{ minWidth: 150 }}>
						<Select
							id="sort-by-select"
							name="sortBy"
							value={sortBy ?? ''}
							displayEmpty
							onChange={handleSortChange}
							MenuProps={{
								PaperProps: {
									sx: { mt: 1, borderRadius: 2, minWidth: 180 }
								}
							}}
						>
							<MenuItem value="package_name">Name</MenuItem>
							<MenuItem value="average_rating">Rating</MenuItem>
							<MenuItem value="ratings_count">Number of Ratings</MenuItem>
							<MenuItem value="github_stars">GitHub Stars</MenuItem>
							<MenuItem value="citations">Citations</MenuItem>
							<MenuItem value="last_commit">Last Commit</MenuItem>
						</Select>
					</FormControl>
					<IconButton
						onClick={handleSortDirectionToggle}
						size="small"
						aria-label="toggle sort direction"
						sx={{
							border: '1px solid',
							borderColor: 'divider',
							ml: 1,
							background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
							'&:hover': {
								background: (theme) => theme.palette.action.hover,
							},
						}}
					>
						{sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
					</IconButton>
					<ToggleButtonGroup
						value={viewMode}
						exclusive
						onChange={handleViewModeChange}
						aria-label="view mode"
						size="small"
						sx={{ ml: { sm: 2 }, background: 'transparent', borderRadius: 2 }}
					>
						<ToggleButton value="card" aria-label="card view" sx={{ borderRadius: 1, px: 1.5 }}>
							<ViewModuleIcon />
						</ToggleButton>
						<ToggleButton value="list" aria-label="list view" sx={{ borderRadius: 1, px: 1.5 }}>
							<ViewListIcon />
						</ToggleButton>
					</ToggleButtonGroup>
				</Box>
			</Box>
			)}

			{!loading && !error && (
				<Suspense fallback={suspenseFallback}>
					{viewMode === 'card' ? (
						<Fragment>
							<Grid container spacing={2} sx={{ p: 0 }}>
								{displayedPackagesInComponent.map(pkg => (
									<Grid item xs={12} sm={6} md={4} lg={3} key={pkg.id}>
										<PackageCard pkg={pkg} />
									</Grid>
								))}
							</Grid>
							{pageCount > 1 && (
								<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
									<Pagination
										count={pageCount}
										page={currentPage}
										onChange={handlePageChange}
										color="primary"
									/>
								</Box>
							)}
						</Fragment>
					) : (
							<PackageList packages={displayedPackagesInComponent} />
					)}
				</Suspense>
			)}
			{!loading && !error && displayedPackagesInComponent.length === 0 && totalFilteredCount === 0 && (
				<Box sx={{ textAlign: 'center', mt: 4, py: 4 }}>
					<Typography variant="h6" color="text.secondary">
						No packages found matching your criteria.
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
						Try adjusting your filters or search terms.
					</Typography>
				</Box>
			)}
		</Container>
	);
};

export default HomePage;