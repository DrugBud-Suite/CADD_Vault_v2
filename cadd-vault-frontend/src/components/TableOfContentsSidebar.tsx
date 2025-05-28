// src/components/TableOfContentsSidebar.tsx
import React, { useState, useEffect } from 'react';
// Removed supabase import as data will come from the store
import { useFilterStore } from '../store/filterStore'; // Assuming Package type is not directly needed here anymore
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

// TreeBranch component with vertical and horizontal lines (remains the same)
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
	// Use data from the filter store
	const allAvailableFolders = useFilterStore((state) => state.allAvailableFolders);
	const allAvailableCategoriesMap = useFilterStore((state) => state.allAvailableCategories);
	const setFolder1Filter = useFilterStore((state) => state.setFolder1);
	const setCategory1Filter = useFilterStore((state) => state.setCategory1);
	const selectedFolder1 = useFilterStore((state) => state.folder1);
	const selectedCategory1 = useFilterStore((state) => state.category1);


	const [tocData, setTocData] = useState<TocData>({});
	const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState<boolean>(true); // Still useful for initial processing from store
	const [error, setError] = useState<string | null>(null); // Keep for potential processing errors
	const theme = useTheme();


	useEffect(() => {
		// Check if the necessary data is loaded in the store
		// We consider data loaded if allAvailableFolders has items, since metadata is now loaded directly
		if (allAvailableFolders.length > 0) {
			setLoading(true); // Indicate processing of store data
			setError(null);
			try {
				// Directly use the data from the store
				// The allAvailableCategoriesMap is already structured as { folder: [categories] }
				// and allAvailableFolders is a sorted list of folders.
				setTocData(allAvailableCategoriesMap);
				setLoading(false);
			} catch (err: any) {
				console.error("Error processing TOC data from store:", err.message);
				setError("Failed to load navigation data from store.");
				setLoading(false);
			}
		} else {
			// Data not yet loaded in store, can show a loading state or wait.
			// Setting loading to true here means it will show loading until metadata is populated.
			setLoading(true);
		}
	}, [allAvailableFolders, allAvailableCategoriesMap]); // Depend on store data

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
		setFolder1Filter(folder === 'Uncategorized' ? null : folder);
		setCategory1Filter(category);
	};

	const handleFolderHeaderClick = (folder: string) => {
		setFolder1Filter(folder === 'Uncategorized' ? null : folder);
		setCategory1Filter(null);
		if (!openFolders.has(folder)) {
			handleFolderClick(folder);
		}
	};

	// Use allAvailableFolders directly as it's already sorted from the store
	const sortedFolders = allAvailableFolders;

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
				flexGrow: 1, // Changed from flexGrow: 1 to allow content below
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
					button // sx prop makes it interactive
					sx={{
						mb: 0.25,
						py: 0.5,
						borderRadius: 1.5,
						bgcolor: selectedFolder1 === null && selectedCategory1 === null ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
						color: selectedFolder1 === null && selectedCategory1 === null ? 'primary.main' : 'text.primary',
						'&:hover': {
							bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
						},
						transition: 'background-color 0.2s, color 0.2s',
					}}
					onClick={() => {
						setFolder1Filter(null);
						setCategory1Filter(null);
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
							button // sx prop makes it interactive
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
											button // sx prop makes it interactive
											onClick={() => handleCategoryClick(folder, category)}
											sx={{
												pl: 4,
												py: 0.2,
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
