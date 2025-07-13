// src/pages/HomePage.tsx
import React, { useEffect, lazy, Suspense } from 'react';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../context/AuthContext';
import { useInfinitePackages } from '../hooks/queries/usePackages';
import { useFilterMetadata } from '../hooks/queries/useMetadata';
import { PackageWithNormalizedData } from '../types';
import {
	Container, Box, Typography, CircularProgress, Alert, Select, MenuItem, IconButton,
	ToggleButtonGroup, ToggleButton, FormControl, SelectChangeEvent
} from '@mui/material';
import { ViewList as ViewListIcon, ViewModule as ViewModuleIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

// Lazy load components
const PackageCard = lazy(() => import('../components/PackageCard'));
const PackageList = lazy(() => import('../components/PackageList'));

// Import VirtualGrid for card view virtualization
import { VirtualGrid } from '../components/virtual/VirtualGrid';

const HomePage: React.FC = () => {
	// --- Authentication context ---
	const { currentUser } = useAuth();
	const userId = currentUser?.id || null;

	// --- Zustand Store Selectors using useShallow ---
	const {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minCitations, minRating, folder, category, selectedLicenses, sortBy, sortDirection, viewMode,
	} = useFilterStore(useShallow(state => ({
		searchTerm: state.searchTerm,
		selectedTags: state.selectedTags,
		minStars: state.minStars,
		hasGithub: state.hasGithub,
		hasWebserver: state.hasWebserver,
		hasPublication: state.hasPublication,
		minCitations: state.minCitations,
		minRating: state.minRating,
		folder: state.folder,
		category: state.category,
		selectedLicenses: state.selectedLicenses,
		sortBy: state.sortBy,
		sortDirection: state.sortDirection,
		viewMode: state.viewMode,
	})));

	// Actions from store (these are stable references)
	const {
		setSort, setViewMode,
	} = useFilterStore(useShallow(state => ({
		setSort: state.setSort,
		setViewMode: state.setViewMode,
	})));

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
		folder,
		category,
		selectedLicenses,
		sortBy,
		sortDirection,
		includeUserRatings: !!userId,
		currentUserId: userId,
	};

	const { 
		data: infiniteData, 
		isLoading: packagesLoading, 
		error: packagesError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage
	} = useInfinitePackages(packageFilters);

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
	// Flatten all pages from infinite query into a single array
	const displayedPackagesInComponent = infiniteData?.pages.flatMap(page => page.packages) || [];
	const totalFilteredCount = infiniteData?.pages[0]?.totalCount || 0;
	const loading = metadataLoading || packagesLoading;
	const error = metadataError || packagesError;

	// Determine loading state for UI
	const loadingState = metadataLoading ? 'metadata' : packagesLoading ? 'packages' : 'none';

	// Scroll detection for infinite loading
	const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
		const threshold = 200; // Trigger when 200px from bottom
		
		if (scrollHeight - scrollTop - clientHeight < threshold) {
			if (hasNextPage && !isFetchingNextPage) {
				fetchNextPage();
			}
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// --- Event Handlers ---

	const handleSortChange = (event: SelectChangeEvent<string>) => {
		const value = event.target.value;
		setSort(value === '' ? null : value, sortDirection);
	};

	const handleSortDirectionToggle = () => {
		setSort(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
	};

	const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newViewMode: 'card' | 'list' | null) => {
		if (newViewMode !== null) {
			setViewMode(newViewMode);
		}
	};

	// Always use virtualization for consistent performance

	// Render item function for virtual grid
	const renderCardItem = (pkg: PackageWithNormalizedData, _index: number, style: React.CSSProperties) => (
		<Suspense fallback={suspenseFallback} key={pkg.id}>
			<Box style={style}>
				<PackageCard pkg={pkg} />
			</Box>
		</Suspense>
	);

	// --- Render Logic ---
	const suspenseFallback = (
		<Box display="flex" justifyContent="center" py={4}>
			<CircularProgress />
		</Box>
	);

	// Page count no longer needed with always-on virtualization

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
						<VirtualGrid
							items={displayedPackagesInComponent}
							renderItem={renderCardItem}
							height="calc(100vh - 250px)" // Adjust based on header height
							width="100%"
							gap={16} // Material-UI spacing={2}
							overscan={2}
							getItemKey={(pkg) => pkg.id}
							onScroll={handleScroll}
						/>
					) : (
						<PackageList 
							packages={displayedPackagesInComponent} 
							height="calc(100vh - 250px)"
							onScroll={handleScroll}
						/>
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