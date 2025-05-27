// src/pages/HomePage.tsx
import React, { useEffect, useState, lazy, Suspense, ChangeEvent, Fragment } from 'react';
import { supabase } from '../supabase';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow';
import { Package } from '../types';
import { RatingEventEmitter, type RatingUpdateEvent } from '../services/ratingService';
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
	pageSize: number = 1000, // Supabase default limit
	logPrefix: string = "📊" // Default emoji for logging
): Promise<Package[]> {
	let allData: Package[] = [];
	let offset = 0;
	let hasMore = true;
	let totalCount = 0;
	let batchNumber = 0;
	const startTime = performance.now();

	console.log(`${logPrefix} Starting paginated data fetch...`);

	while (hasMore) {
		batchNumber++;
		const batchStartTime = performance.now();
		console.log(`${logPrefix} Fetching batch #${batchNumber}, offset: ${offset}...`);

		const { data, error, count } = await queryBuilder
			.select(selectFields, { count: 'exact' }) // Ensure count is requested
			.range(offset, offset + pageSize - 1);

		if (error) {
			console.error(`${logPrefix} ❌ Error fetching paginated data batch #${batchNumber}:`, error.message);
			throw error; // Propagate error to be caught by caller
		}

		// Store total count from first response
		if (count !== null && totalCount === 0) {
			totalCount = count;
		}

		if (data && data.length > 0) {
			const batchTime = ((performance.now() - batchStartTime) / 1000).toFixed(2);
			allData = allData.concat(data as Package[]);
			const newOffset = offset + data.length;
			console.log(`${logPrefix} ✅ Batch #${batchNumber} complete in ${batchTime}s: ${data.length} items, progress: ${newOffset}/${totalCount || 'unknown'} (${totalCount ? Math.round((newOffset / totalCount) * 100) : '?'}%)`);
			offset = newOffset;
		} else {
			console.log(`${logPrefix} Batch #${batchNumber} returned no data, ending pagination.`);
			hasMore = false;
		}

		// If Supabase provides a total count and we've fetched that many, stop
		if (totalCount > 0 && offset >= totalCount) {
			console.log(`${logPrefix} Reached total count (${totalCount}), ending pagination.`);
			hasMore = false;
		}

		// Safety break if data length is less than page size, means no more data
		if (data && data.length < pageSize) {
			console.log(`${logPrefix} Received fewer items (${data.length}) than page size (${pageSize}), ending pagination.`);
			hasMore = false;
		}
	}

	const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
	console.log(`${logPrefix} 🏁 All batches complete in ${totalTime}s! Total items: ${allData.length}`);

	return allData;
}

const HomePage: React.FC = () => {
	// --- Zustand Store Selectors using useShallow ---
	const {
		searchTerm, selectedTags, minStars, hasGithub, hasWebserver, hasPublication,
		minCitations, minRating, folder1, category1, selectedLicenses, sortBy, sortDirection, viewMode, currentPage,
		totalFilteredCount,
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
	const [loadingState, setLoadingState] = useState<'metadata' | 'packages' | 'none'>('metadata');
	const [error, setError] = useState('');
	const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});

	const itemsPerPage = 24;

	// --- Effect to fetch global data for filters and set metadata (runs once) ---
	useEffect(() => {
		const fetchGlobalDataAndSetMetadata = async () => {
			setError('');
			setLoadingState('metadata');
			setLoading(true);
			const startTime = performance.now();

			try {
				console.log("📊 Fetching metadata for filters...");

				// Fetch all package data needed for filter metadata using the helper.
				// Select all fields necessary for metadata derivation.
				const selectFieldsForMetadata = 'id, package_name, description, tags, license, github_stars, citations, repo_link, webserver, publication, folder1, category1, last_commit, average_rating, ratings_count, github_owner, github_repo, jif, journal, last_commit_ago, link, page_icon, primary_language, ratings_sum';
				const allPackagesData = await fetchAllSupabaseData(
					supabase.from('packages'),
					selectFieldsForMetadata,
					1000, // page size
					"📊" // log prefix
				);

				const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);
				console.log(`📊 Metadata fetch complete in ${fetchTime}s. Found ${allPackagesData?.length || 0} packages for metadata.`);

				if (allPackagesData && allPackagesData.length > 0) {
					console.log(`📊 Starting metadata processing...`);
					const processStartTime = performance.now();
					setOriginalPackagesAndDeriveMetadata(allPackagesData);
					const processTime = ((performance.now() - processStartTime) / 1000).toFixed(2);
					const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
					console.log(`📊 Metadata processing completed in ${processTime}s`);
					console.log(`📊 Total metadata operation completed in ${totalTime}s`);

					setDebugInfo(prev => ({
						...prev,
						metadataFetch: {
							success: true,
							count: allPackagesData.length,
							fetchTime: `${fetchTime}s`,
							processTime: `${processTime}s`,
							totalTime: `${totalTime}s`,
							timestamp: new Date().toISOString()
						}
					}));
				} else {
					setOriginalPackagesAndDeriveMetadata([]);
					setError("No packages found for filtering options.");
					setDebugInfo(prev => ({
						...prev,
						metadataFetch: {
							success: false,
							count: 0,
							time: `${fetchTime}s`,
							error: "No data returned",
							timestamp: new Date().toISOString()
						}
					}));
					console.warn("⚠️ No packages found for metadata.");
				}
			} catch (err: any) {
				const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);
				console.error("❌ Error in fetchGlobalDataAndSetMetadata:", err);
				setError("Failed to load filter options. Please try refreshing the page.");
				setOriginalPackagesAndDeriveMetadata([]);
				setDebugInfo(prev => ({
					...prev,
					metadataFetch: {
						success: false,
						time: `${fetchTime}s`,
						error: err.message || "Unknown error",
						timestamp: new Date().toISOString()
					}
				}));
			} finally {
				setLoadingState('packages');
			}
		};

		fetchGlobalDataAndSetMetadata();
	}, [setOriginalPackagesAndDeriveMetadata]); // Dependency array ensures this runs once

	// --- Rating update event listener ---
	useEffect(() => {
		const unsubscribe = RatingEventEmitter.subscribe((event: RatingUpdateEvent) => {
			console.log(`HomePage received rating update for package ${event.packageId}: ${event.averageRating} (${event.ratingsCount} ratings)`);

			// Update the displayed packages with the new rating data
			setDisplayedPackagesInComponent(prevPackages =>
				prevPackages.map(pkg =>
					pkg.id === event.packageId
						? {
							...pkg,
							average_rating: event.averageRating,
							ratings_count: event.ratingsCount 
						}
						: pkg
				)
			);

			// Also update in the store
			const currentDisplayedPackages = useFilterStore.getState().displayedPackages;
			const updatedDisplayedPackages = currentDisplayedPackages.map(pkg =>
				pkg.id === event.packageId
					? {
						...pkg,
						average_rating: event.averageRating,
						ratings_count: event.ratingsCount 
					}
					: pkg
			);
			setDisplayedPackages(updatedDisplayedPackages);
		});

		// Cleanup the event listener on component unmount
		return unsubscribe;
	}, [setDisplayedPackages]);

	// --- Data Fetching for packages (paginated and filtered) ---
	useEffect(() => {
		const performFetchPackages = async () => {
			// Only proceed if metadata (like allAvailableFolders) is loaded,
			// which indicates fetchGlobalDataAndSetMetadata has likely completed.
			const metadataLoaded = useFilterStore.getState().allAvailableFolders.length > 0 ||
				useFilterStore.getState().originalPackages.length > 0;

			if (!metadataLoaded) {
				console.log("⏳ Metadata not yet loaded, packages fetch will wait for metadata.");
				return;
			}

			setLoading(true);
			setLoadingState('packages');
			setError('');

			const startTime = performance.now();
			const pageIndex = currentPage - 1;
			const rangeFrom = pageIndex * itemsPerPage;
			const rangeTo = rangeFrom + itemsPerPage - 1;

			console.log(`🔎 Fetching packages (page ${currentPage}):`, {
				sortBy,
				sortDirection,
				searchTerm: searchTerm || 'none',
				filters: {
					tags: selectedTags.length > 0 ? selectedTags : 'none',
					minStars: minStars || 'none',
					hasGithub,
					hasWebserver,
					hasPublication,
					minCitations: minCitations || 'none',
					minRating: minRating || 'none',
					folder1: folder1 || 'none',
					category1: category1 || 'none',
					licenses: selectedLicenses.length > 0 ? selectedLicenses : 'none'
				},
				pagination: { from: rangeFrom, to: rangeTo }
			});

			try {
				console.log(`🔎 Building query with filters...`);
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
				if (minRating !== null && minRating > 0) queryBuilder = queryBuilder.gte('average_rating', minRating);
				if (folder1) queryBuilder = queryBuilder.eq('folder1', folder1);
				if (category1) queryBuilder = queryBuilder.eq('category1', category1);
				if (selectedLicenses.length > 0) queryBuilder = queryBuilder.in('license', selectedLicenses);

				if (sortBy && sortDirection) {
					queryBuilder = queryBuilder.order(sortBy, { ascending: sortDirection === 'asc', nullsFirst: false });
				} else {
					queryBuilder = queryBuilder.order('package_name', { ascending: true, nullsFirst: false });
				}

				queryBuilder = queryBuilder.range(rangeFrom, rangeTo);
				console.log(`🔎 Executing query for page ${currentPage}...`);
				const queryStartTime = performance.now();

				const { data, error: dbError, count } = await queryBuilder;
				const queryTime = ((performance.now() - queryStartTime) / 1000).toFixed(2);
				const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);

				if (dbError) {
					console.error(`🔎 ❌ Query error after ${queryTime}s:`, dbError);
					throw dbError;
				}

				if (data) {
					console.log(`🔎 ✅ Query successful in ${queryTime}s. Total matches: ${count || 0}, current page items: ${data.length}`);

					const processingStartTime = performance.now();
					console.log(`🔎 Processing package data...`);
					setDisplayedPackagesInComponent(data as Package[]);
					setDisplayedPackages(data as Package[]); // Update store
					const processingTime = ((performance.now() - processingStartTime) / 1000).toFixed(2);

					console.log(`🔎 Data processing complete in ${processingTime}s. Total operation time: ${fetchTime}s`);
					setDebugInfo(prev => ({
						...prev,
						packageFetch: {
							success: true,
							totalCount: count,
							displayedCount: data.length,
							queryTime: `${queryTime}s`,
							processingTime: `${processingTime}s`,
							totalTime: `${fetchTime}s`,
							filters: {
								searchTerm: searchTerm || 'none',
								tags: selectedTags.length,
								minStars,
								hasGithub,
								hasWebserver,
								hasPublication,
								minCitations,
								minRating,
								folder1,
								category1,
								licenses: selectedLicenses.length
							},
							timestamp: new Date().toISOString()
						}
					}));
				} else {
					console.warn(`⚠️ No packages found for current filters (${fetchTime}s).`);
					setDisplayedPackagesInComponent([]);
					setDisplayedPackages([]); // Update store
					setDebugInfo(prev => ({
						...prev,
						packageFetch: {
							success: true,
							totalCount: 0,
							displayedCount: 0,
							time: `${fetchTime}s`,
							timestamp: new Date().toISOString()
						}
					}));
				}
				setTotalFilteredCount(count ?? 0); // Update store

			} catch (err: any) {
				const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);
				const errorMessage = `Failed to fetch packages: ${err?.message || 'Unknown error'}`;
				setError(errorMessage);
				console.error("❌ Error fetching packages:", err);
				console.error("Query parameters:", {
					page: currentPage,
					sortBy,
					sortDirection,
					searchTerm,
					filters: {
						tags: selectedTags,
						minStars,
						hasGithub,
						hasWebserver,
						hasPublication,
						minCitations,
						minRating,
						folder1,
						category1,
						licenses: selectedLicenses
					}
				});

				setDisplayedPackagesInComponent([]);
				setDisplayedPackages([]); // Update store
				setTotalFilteredCount(0); // Update store
				setDebugInfo(prev => ({
					...prev,
					packageFetch: {
						success: false,
						error: err?.message || 'Unknown error',
						time: `${fetchTime}s`,
						timestamp: new Date().toISOString()
					}
				}));
			} finally {
				setLoading(false);
				setLoadingState('none');
			}
		};

		performFetchPackages();
	}, [
		currentPage, searchTerm, selectedTags, minStars, hasGithub, hasWebserver,
		hasPublication, minCitations, minRating, folder1, category1, selectedLicenses,
		sortBy, sortDirection,
		setDisplayedPackages, setTotalFilteredCount, // itemsPerPage is stable
		// No longer depends on originalPackages directly for this effect
	]);

	// Output debug info to console when it changes
	useEffect(() => {
		console.log("🔧 HomePage Debug Info:", debugInfo);
	}, [debugInfo]);

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

	// Loading messages based on state
	const getLoadingMessage = () => {
		if (loadingState === 'metadata') {
			return "Loading filter options and metadata...";
		} else if (loadingState === 'packages') {
			return `Loading packages (page ${currentPage})...`;
		}
		return "Loading...";
	};

	return (
		<Container maxWidth="lg" sx={{ pt: 2, px: { xs: 1, sm: 2 }, pb: 0 }}>
			{loading && (
				<Box display="flex" flexDirection="column" alignItems="center" py={4} gap={2}>
					<CircularProgress />
					<Typography variant="body1" color="text.secondary" align="center">
						{getLoadingMessage()}
					</Typography>
					<Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
						{loadingState === 'metadata' ?
							"This may take a moment as we're loading all metadata needed for filtering." :
							"Applying filters and sorting to find matching packages."}
					</Typography>
				</Box>
			)}
			{error && !loading && (
				<Box py={4}>
					<Alert
						severity="error"
						sx={{ mb: 2 }}
					>
						<Typography variant="body1" fontWeight="medium">
							{error}
						</Typography>
						<Typography variant="body2" sx={{ mt: 1 }}>
							Please try again or refresh the page. If the problem persists, contact support.
						</Typography>
					</Alert>
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
					<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
						Try adjusting your filters or search terms.
					</Typography>
				</Box>
			)}
		</Container>
	);
};

export default HomePage;