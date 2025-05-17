import React, { useEffect, useState, lazy, Suspense, ChangeEvent, Fragment } from 'react';
import { supabase } from '../supabase'; // Import Supabase client
import { useFilterStore } from '../store/filterStore';
import type { Package } from '../types';
import { Box, Container, Grid, Typography, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Pagination, FormControl, InputLabel, Select, MenuItem, IconButton, SelectChangeEvent } from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { shallow } from 'zustand/shallow';
import '../App.css';

// Lazy load components
const PackageCard = lazy(() => import('../components/PackageCard'));
const PackageList = lazy(() => import('../components/PackageList'));

const HomePage: React.FC = () => {
	// Use individual selectors to prevent unnecessary re-renders
	const filteredPackages = useFilterStore(state => state.filteredPackages);
	const viewMode = useFilterStore(state => state.viewMode);
	const setViewMode = useFilterStore(state => state.setViewMode);
	const sortBy = useFilterStore(state => state.sortBy);
	const sortDirection = useFilterStore(state => state.sortDirection);
	const setSort = useFilterStore(state => state.setSort);
	const isFilterSidebarVisible = useFilterStore(state => state.isFilterSidebarVisible); // Access sidebar visibility
	const isNavSidebarVisible = useFilterStore(state => state.isNavSidebarVisible); // Access sidebar visibility

	// Get setOriginalPackages separately since it's only used in useEffect
	const setOriginalPackages = useFilterStore(state => state.setOriginalPackages);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 24; // Show 24 cards per page

	useEffect(() => {
		const fetchPackages = async () => {
			// Only fetch if original packages aren't already loaded
			if (useFilterStore.getState().originalPackages.length === 0) {
				try {
					setLoading(true); // Set loading true when fetching starts
					setError(''); // Clear previous errors

					let allPackages: Package[] = [];
					let offset = 0;
					const limit = 1000; // Supabase default limit

					while (true) {
						const { data, error: dbError } = await supabase
							.from('packages')
							.select('*, average_rating, ratings_count')
							.range(offset, offset + limit - 1);

						if (dbError) {
							throw dbError; // Throw error to be caught by catch block
						}

						if (data) {
							allPackages = allPackages.concat(data as Package[]);
						}

						if (!data || data.length < limit) {
							break; // No more data to fetch
						}

						offset += limit;
					}

					setOriginalPackages(allPackages); // Use the setter

				} catch (err: any) { // Catch any error type
					setError(`Failed to fetch packages: ${err?.message || 'Unknown error'}`);
					console.error("Error fetching packages from Supabase:", err);
				} finally {
					setLoading(false);
				}
			} else {
				setLoading(false); // Already loaded
			}
		};

		fetchPackages();
	}, []); // Remove the dependency array, as setOriginalPackages is stable

	// Fallback UI for Suspense
	const suspenseFallback = (
		<Box display="flex" justifyContent="center" py={4}>
			<CircularProgress />
		</Box>
	);

	// Calculate pagination values
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedPackages = filteredPackages.slice(startIndex, endIndex);
	const pageCount = Math.ceil(filteredPackages.length / itemsPerPage);

	// Handle page change
	const handlePageChange = (event: ChangeEvent<unknown>, value: number) => {
		setCurrentPage(value);
		window.scrollTo(0, 0); // Scroll to top on page change
	};

	// Extract event handlers to avoid inline function recreation
	const handleSortChange = (event: SelectChangeEvent<string>) => {
		const value = event.target.value;
		setSort(value === '' ? null : value);
	};

	const handleSortDirectionToggle = () => {
		setSort(sortBy, sortDirection === 'asc' ? 'desc' : 'asc');
	};

	const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newViewMode: 'card' | 'list' | null) => {
		if (newViewMode !== null) {
			setViewMode(newViewMode);
		}
	};

	return (
		<Container maxWidth="lg" sx={{ pt: 2, px: 0, pb: 0 }}>
			{/* Show loading indicator inside the container */}
			{loading && (
				<Box display="flex" justifyContent="center" py={4}>
					<CircularProgress />
				</Box>
			)}

			{/* Show error message inside the container */}
			{error && !loading && (
				<Box py={4}>
					<Alert severity="error">{error}</Alert>
				</Box>
			)}

			{/* Header Row: Title and View Toggle */}
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
				<Typography variant="h4" component="h1" sx={{
					mb: 0,
					color: 'text.primary',
					fontWeight: 500,
					letterSpacing: '-0.01em'
				}}>
					{filteredPackages.length} Entries Found
				</Typography>
				{/* Sorting and View Toggle Buttons */}
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
							<MenuItem value="package_name">Name (A-Z)</MenuItem>
							<MenuItem value="citations">Citations</MenuItem>
							<MenuItem value="github_stars">GitHub Stars</MenuItem>
							<MenuItem value="last_commit">Last Updated</MenuItem>
							<MenuItem value="jif">Journal Impact</MenuItem>
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
							<ViewModuleIcon fontSize="small" />
						</ToggleButton>
						<ToggleButton value="list" aria-label="list view" sx={{ borderRadius: 1, px: 1.5 }}>
							<ViewListIcon fontSize="small" />
						</ToggleButton>
					</ToggleButtonGroup>
				</Box>
			</Box>

			{/* Only render package list/cards if not loading and no error */}
			{!loading && !error && (
				<Suspense fallback={suspenseFallback}>
					{viewMode === 'card' ? (
						<Fragment>
							<Grid container spacing={2} sx={{ p: 0 }}>
								{paginatedPackages.map((pkg: Package) => {
									// Fixed number of columns for lg and xl breakpoints
									return (
										<Grid item key={pkg.id} xs={12} sm={6} md={4} lg={3} xl={3}> {/* Always 4 columns on lg/xl */}
											<PackageCard pkg={pkg} />
										</Grid>
									);
								})}
							</Grid>
							{/* Add Pagination component */}
							{pageCount > 1 && (
								<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
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
						<PackageList packages={filteredPackages} />
					)}
				</Suspense>
			)}
		</Container>
	);
};

export default HomePage;