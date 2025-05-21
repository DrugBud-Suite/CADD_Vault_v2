// src/pages/HomePage.tsx
import React, { useEffect, useState, lazy, Suspense, ChangeEvent, Fragment } from 'react';
import { supabase } from '../supabase';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { Package } from '../types';
import {
	Container, Box, Typography, CircularProgress, Alert, Select, MenuItem, IconButton,
	ToggleButtonGroup, ToggleButton, Grid, Pagination, FormControl, SelectChangeEvent
} from '@mui/material';
import { ViewList as ViewListIcon, ViewModule as ViewModuleIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';

// Lazy load components
const PackageCard = lazy(() => import('../components/PackageCard'));
const PackageList = lazy(() => import('../components/PackageList'));

// Helper function to fetch all data with pagination
async function fetchAllSupabaseData(
	queryBuilder: any, // Adjust type based on Supabase client version if possible
	selectFields: string,
	pageSize: number = 1000 // Supabase default limit
): Promise<Package[]> {
	let allData: Package[] = [];
	let offset = 0;
	let hasMore = true;

	while (hasMore) {
		const { data, error, count } = await queryBuilder
			.select(selectFields, { count: 'exact' }) // Ensure count is requested
			.range(offset, offset + pageSize - 1);

		if (error) {
			console.error("Error fetching paginated data:", error.message);
			throw error; // Propagate error to be caught by caller
		}

		if (data && data.length > 0) {
			allData = allData.concat(data as Package[]);
			offset += data.length;
		} else {
			hasMore = false;
		}

		// If Supabase provides a total count and we've fetched that many, stop
		if (count !== null && offset >= count) {
			hasMore = false;
		}
		// Safety break if data length is less than page size, means no more data
		if (data && data.length < pageSize) {
			hasMore = false;
		}
	}
	return allData;
}


const HomePage: React.FC = () => {
	// --- Zustand Store Selectors using useShallow ---
	const {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minCitations, folder1, category1, selectedLicenses, sortBy, sortDirection, viewMode, currentPage,
		totalFilteredCount,
	} = useFilterStore(useShallow(state => ({
		searchTerm: state.searchTerm,
		selectedTags: state.selectedTags,
		minStars: state.minStars,
		hasGithub: state.hasGithub,
		hasWebserver: state.hasWebserver,
		hasPublication: state.hasPublication,
		minCitations: state.minCitations,
		folder1: state.folder1,
		category1: state.category1,
		selectedLicenses: state.selectedLicenses,
		sortBy: state.sortBy,
		sortDirection: state.sortDirection,
		viewMode: state.viewMode,
		currentPage: state.currentPage,
		totalFilteredCount: state.totalFilteredCount,
	})));

	// Actions from store (these are stable references)
	const {
		setSort, setDisplayedPackages, setTotalFilteredCount, setViewMode, setCurrentPage,
		setOriginalPackagesAndDeriveMetadata,
	} = useFilterStore(useShallow(state => ({
		setSort: state.setSort,
		setDisplayedPackages: state.setDisplayedPackages,
		setTotalFilteredCount: state.setTotalFilteredCount,
		setViewMode: state.setViewMode,
		setCurrentPage: state.setCurrentPage,
		setOriginalPackagesAndDeriveMetadata: state.setOriginalPackagesAndDeriveMetadata,
	})));


	// --- Local State for this component ---
	const [displayedPackagesInComponent, setDisplayedPackagesInComponent] = useState<Package[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const itemsPerPage = 24;

	// --- Effect to fetch global data for filters and set metadata (runs once) ---
	useEffect(() => {
		const fetchGlobalDataAndSetMetadata = async () => {
			setError('');
			setLoading(true); // Set loading true at the start of this specific fetch
			try {
				// Fetch all package data needed for filter metadata using the helper.
				// Select all fields necessary for metadata derivation.
				const selectFieldsForMetadata = 'id, package_name, description, tags, license, github_stars, citations, repo_link, webserver, publication, folder1, category1, last_commit, average_rating, ratings_count, github_owner, github_repo, jif, journal, last_commit_ago, link, page_icon, primary_language, ratings_sum';
				const allPackagesData = await fetchAllSupabaseData(
					supabase.from('packages'),
					selectFieldsForMetadata
				);

				if (allPackagesData) {
					setOriginalPackagesAndDeriveMetadata(allPackagesData);
				} else {
					setOriginalPackagesAndDeriveMetadata([]);
					setError("No packages found for metadata."); // More specific error
				}
			} catch (err: any) {
				console.error("Error in fetchGlobalDataAndSetMetadata:", err.message);
				setError("An unexpected error occurred while loading filter options.");
				setOriginalPackagesAndDeriveMetadata([]);
			} finally {
				setLoading(false); // Set loading false after this specific fetch is done
			}
		};

		fetchGlobalDataAndSetMetadata();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setOriginalPackagesAndDeriveMetadata]); // Dependency array ensures this runs once

	// --- Data Fetching for packages (paginated and filtered) ---
	useEffect(() => {
		const performFetchPackages = async () => {
			// Only proceed if metadata (like allAvailableFolders) is loaded,
			// which indicates fetchGlobalDataAndSetMetadata has likely completed.
			// This check can be made more robust if needed.
			if (useFilterStore.getState().allAvailableFolders.length === 0 && useFilterStore.getState().originalPackages.length === 0) {
				// console.log("Metadata not yet loaded, skipping package fetch.");
				// return;
			}

			setLoading(true);
			setError('');
			// console.log(`Fetching packages. Page: ${currentPage}, SortBy: ${sortBy}, Dir: ${sortDirection}, Search: ${searchTerm}`);

			const pageIndex = currentPage - 1;
			const rangeFrom = pageIndex * itemsPerPage;
			const rangeTo = rangeFrom + itemsPerPage - 1;

			try {
				let queryBuilder = supabase
					.from('packages')
					.select('*, average_rating, ratings_count', { count: 'exact' });

				if (searchTerm) queryBuilder = queryBuilder.or(`package_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
				if (selectedTags.length > 0) {
					const jsonFormattedTags = JSON.stringify(selectedTags);
					queryBuilder = queryBuilder.contains('tags', jsonFormattedTags);
				}
				if (minStars !== null && minStars > 0) queryBuilder = queryBuilder.gte('github_stars', minStars);
				if (hasGithub) queryBuilder = queryBuilder.not('repo_link', 'is', null);
				if (hasWebserver) queryBuilder = queryBuilder.not('webserver', 'is', null);
				if (hasPublication) queryBuilder = queryBuilder.not('publication', 'is', null);
				if (minCitations !== null && minCitations > 0) queryBuilder = queryBuilder.gte('citations', minCitations);
				if (folder1) queryBuilder = queryBuilder.eq('folder1', folder1);
				if (category1) queryBuilder = queryBuilder.eq('category1', category1);
				if (selectedLicenses.length > 0) queryBuilder = queryBuilder.in('license', selectedLicenses);

				if (sortBy && sortDirection) {
					queryBuilder = queryBuilder.order(sortBy, { ascending: sortDirection === 'asc', nullsFirst: false });
				} else {
					queryBuilder = queryBuilder.order('package_name', { ascending: true, nullsFirst: false });
				}

				queryBuilder = queryBuilder.range(rangeFrom, rangeTo);

				const { data, error: dbError, count } = await queryBuilder;

				if (dbError) throw dbError;

				if (data) {
					setDisplayedPackagesInComponent(data as Package[]);
					setDisplayedPackages(data as Package[]); // Update store
				} else {
					setDisplayedPackagesInComponent([]);
					setDisplayedPackages([]); // Update store
				}
				setTotalFilteredCount(count ?? 0); // Update store

			} catch (err: any) {
				setError(`Failed to fetch packages: ${err?.message || 'Unknown error'}`);
				console.error("Error fetching packages from Supabase:", err);
				setDisplayedPackagesInComponent([]);
				setDisplayedPackages([]); // Update store
				setTotalFilteredCount(0); // Update store
			} finally {
				setLoading(false);
			}
		};

		performFetchPackages();
	}, [
		currentPage, searchTerm, selectedTags, minStars, hasGithub, hasWebserver,
		hasPublication, minCitations, folder1, category1, selectedLicenses,
		sortBy, sortDirection,
		setDisplayedPackages, setTotalFilteredCount, // itemsPerPage is stable
		// No longer depends on originalPackages directly for this effect
	]);


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
			{loading && (
				<Box display="flex" justifyContent="center" py={4}>
					<CircularProgress />
				</Box>
			)}
			{error && !loading && (
				<Box py={4}>
					<Alert severity="error">{error}</Alert>
				</Box>
			)}

			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
				<Typography variant="h4" component="h1" sx={{
					mb: { xs: 1, sm: 0 },
					color: 'text.primary',
					fontWeight: 500,
					letterSpacing: '-0.01em'
				}}>
					{totalFilteredCount} Entries Found
				</Typography>
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
				</Box>
			)}
		</Container>
	);
};

export default HomePage;
