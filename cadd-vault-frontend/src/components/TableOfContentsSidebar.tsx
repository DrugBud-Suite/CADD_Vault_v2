// src/components/TableOfContentsSidebar.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Package } from '../types'; // Assuming Package type includes folder1 and category1
import { useFilterStore } from '../store/filterStore';
import {
	List, ListItem, ListItemText, Collapse, IconButton, Box, Typography, CircularProgress
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { alpha, useTheme } from '@mui/material/styles';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

interface TocData {
	[folder1: string]: string[];
}

// Helper function to fetch all data with pagination (can be moved to a utils file)
async function fetchAllSupabaseDataForTOC(
	queryBuilder: any,
	selectFields: string,
	pageSize: number = 1000
): Promise<Pick<Package, 'folder1' | 'category1'>[]> {
	let allData: Pick<Package, 'folder1' | 'category1'>[] = [];
	let offset = 0;
	let hasMore = true;

	while (hasMore) {
		const { data, error, count } = await queryBuilder
			.select(selectFields, { count: 'exact' }) // Ensure count is requested
			.range(offset, offset + pageSize - 1);

		if (error) {
			console.error("Error fetching paginated TOC data:", error.message);
			throw error;
		}

		if (data && data.length > 0) {
			allData = allData.concat(data as Pick<Package, 'folder1' | 'category1'>[]);
			offset += data.length;
		} else {
			hasMore = false;
		}
		if (count !== null && offset >= count) {
			hasMore = false;
		}
		if (data && data.length < pageSize) {
			hasMore = false;
		}
	}
	return allData;
}


// TreeBranch component with vertical and horizontal lines
const TreeBranch = ({ isOpen, isLast = false }: { isOpen: boolean; isLast?: boolean }) => (
	<Box sx={{ position: 'relative' }}>
		{/* Vertical line */}
		<Box
			sx={{
				position: 'absolute',
				left: 16,
				top: 0,
				bottom: isLast ? '50%' : 0,
				width: 1,
				bgcolor: (theme) =>
					isOpen ? alpha(theme.palette.primary.main, 0.3) : alpha(theme.palette.text.disabled, 0.2),
				transition: 'background-color 0.2s',
			}}
		/>
		{/* Horizontal line for category items */}
		<Box
			sx={{
				position: 'absolute',
				left: 16,
				top: '50%',
				width: 16,
				height: 1,
				bgcolor: (theme) => alpha(theme.palette.text.disabled, 0.2),
			}}
		/>
	</Box>
);

const TableOfContentsSidebar: React.FC = () => {
	const [tocData, setTocData] = useState<TocData>({});
	const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const theme = useTheme();

	const setFolder1 = useFilterStore((state) => state.setFolder1);
	const setCategory1 = useFilterStore((state) => state.setCategory1);
	const selectedFolder1 = useFilterStore((state) => state.folder1);
	const selectedCategory1 = useFilterStore((state) => state.category1);


	useEffect(() => {
		const fetchPackagesAndBuildToc = async () => {
			setLoading(true);
			setError(null);
			try {
				const packageList = await fetchAllSupabaseDataForTOC(
					supabase.from('packages'),
					'folder1, category1'
				);

				const tocStructure: TocData = {};
				packageList.forEach(pkg => {
					const folder1Value = pkg.folder1 || 'Uncategorized'; // Handle null/empty folder1
					const category1Value = pkg.category1;

					if (!tocStructure[folder1Value]) {
						tocStructure[folder1Value] = [];
					}
					if (category1Value && !tocStructure[folder1Value].includes(category1Value)) {
						tocStructure[folder1Value].push(category1Value);
					}
				});

				Object.keys(tocStructure).forEach(folder => {
					tocStructure[folder].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
				});

				// Sort folders, ensuring 'Uncategorized' comes last if present
				const sortedFolderKeys = Object.keys(tocStructure).sort((a, b) => {
					if (a === 'Uncategorized') return 1;
					if (b === 'Uncategorized') return -1;
					return a.localeCompare(b, undefined, { sensitivity: 'base' });
				});

				const sortedTocData: TocData = {};
				sortedFolderKeys.forEach(key => {
					sortedTocData[key] = tocStructure[key];
				});


				setTocData(sortedTocData);

			} catch (err: any) {
				console.error("Error fetching packages for TOC:", err.message);
				setError("Failed to load navigation data.");
			} finally {
				setLoading(false);
			}
		};

		fetchPackagesAndBuildToc();
	}, []);

	const handleFolderClick = (folder: string) => {
		setOpenFolders(prevOpen => {
			const newOpen = new Set(prevOpen);
			if (newOpen.has(folder)) {
				newOpen.delete(folder);
			} else {
				newOpen.add(folder);
			}
			return newOpen;
		});
	};

	const handleCategoryClick = (folder: string, category: string | null) => {
		setFolder1(folder === 'Uncategorized' ? null : folder);
		setCategory1(category);
	};

	const handleFolderHeaderClick = (folder: string) => {
		setFolder1(folder === 'Uncategorized' ? null : folder);
		setCategory1(null); // Reset category when a folder header is clicked
		// Optionally, open the folder if it's not already open
		if (!openFolders.has(folder)) {
			handleFolderClick(folder);
		}
	};

	const sortedFolders = Object.keys(tocData); // Already sorted by fetchPackagesAndBuildToc

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
				<CircularProgress size={24} />
				<Typography sx={{ ml: 1, fontSize: '0.9rem' }}>Loading Nav...</Typography>
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ p: 2 }}>
				<Typography color="error" sx={{ fontSize: '0.9rem' }}>{error}</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{
			height: '100%',
			overflowY: 'auto',
			display: 'flex',
			flexDirection: 'column',
			pt: 1,
			'&::-webkit-scrollbar': { width: '6px' },
			'&::-webkit-scrollbar-track': { background: 'transparent' },
			'&::-webkit-scrollbar-thumb': {
				backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.2),
				borderRadius: '3px',
				'&:hover': {
					backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.3),
				}
			}
		}}>
			<Box sx={{
				display: 'flex',
				alignItems: 'center',
				mt: 1.5,
				px: 2,
				mb: 2,
				pb: 2,
				borderBottom: 1,
				borderColor: 'divider',
				flexGrow: 1,
			}}>
				<AccountTreeIcon sx={{ mr: 1, color: 'primary.main', fontSize: '1.25rem' }} />
				<Typography variant="h6" sx={{
					fontWeight: 'bold',
					fontSize: '1.1rem',
					color: 'text.primary'
				}}>
					Navigation
				</Typography>
			</Box>

			<List component="nav" dense sx={{ px: 1, py: 0, '& .MuiListItem-root': { minHeight: 'unset' } }}>
				<ListItem
					button
					sx={{
						mb: 0.25,
						py: 0.5, // Reduced padding
						borderRadius: 1.5, // Slightly more rounded
						bgcolor: selectedFolder1 === null && selectedCategory1 === null ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
						color: selectedFolder1 === null && selectedCategory1 === null ? 'primary.main' : 'text.primary',
						'&:hover': {
							bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
						},
						transition: 'background-color 0.2s, color 0.2s',
					}}
					onClick={() => {
						setFolder1(null);
						setCategory1(null);
					}}
				>
					<ListItemText
						primary="All Packages"
						primaryTypographyProps={{
							sx: {
								fontWeight: selectedFolder1 === null && selectedCategory1 === null ? 'bold' : 'medium',
								fontSize: '0.9rem',
							}
						}}
					/>
				</ListItem>

				{sortedFolders.map((folder, folderIndex) => (
					<Box key={folder} sx={{ position: 'relative', mb: 0.1 }}>
						<ListItem
							button
							onClick={() => handleFolderHeaderClick(folder)}
							sx={{
								borderRadius: 1.5,
								py: 0,
								pl: 2,
								bgcolor: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === null ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
								color: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === null ? 'primary.main' : 'text.primary',
								'&:hover': {
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
								},
								transition: 'background-color 0.2s, color 0.2s',
							}}
						>
							<ListItemText
								primary={folder}
								primaryTypographyProps={{
									sx: {
										fontWeight: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === null ? 'bold' : 'medium',
										fontSize: '0.9rem',
									}
								}}
							/>
							{tocData[folder] && tocData[folder].length > 0 && (
								<IconButton
									edge="end"
									size="small"
									onClick={(e) => { e.stopPropagation(); handleFolderClick(folder); }}
									sx={{
										color: 'text.secondary',
										'&:hover': {
											color: 'primary.main',
											bgcolor: 'transparent'
										}
									}}
								>
									{openFolders.has(folder) ? <ExpandLess /> : <ExpandMore />}
								</IconButton>
							)}
						</ListItem>

						{tocData[folder] && tocData[folder].length > 0 && (
							<Collapse in={openFolders.has(folder)} timeout="auto" unmountOnExit>
								<List component="div" disablePadding dense sx={{ position: 'relative', ml: 2, mt: 0, mb: 0 }}>
									<TreeBranch isOpen={openFolders.has(folder)} isLast={folderIndex === sortedFolders.length - 1 && tocData[folder].length === 0} />
									{tocData[folder].map((category) => (
										<ListItem
											key={category}
											button
											onClick={() => handleCategoryClick(folder, category)}
											sx={{
												pl: 4,
												py: 0.2, // Reduced padding
												borderRadius: 1.5,
												position: 'relative',
												bgcolor: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === category ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
												color: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === category ? 'primary.main' : 'text.secondary',
												'&:hover': {
													bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
												},
												transition: 'background-color 0.2s, color 0.2s',
											}}
										>
											<ListItemText
												primary={category}
												primaryTypographyProps={{
													sx: {
														fontWeight: selectedFolder1 === (folder === 'Uncategorized' ? null : folder) && selectedCategory1 === category ? 'medium' : 'normal',
														fontSize: '0.8rem',
													}
												}}
											/>
										</ListItem>
									))}
								</List>
							</Collapse>
						)}
					</Box>
				))}
			</List>
		</Box>
	);
};

export default TableOfContentsSidebar;

