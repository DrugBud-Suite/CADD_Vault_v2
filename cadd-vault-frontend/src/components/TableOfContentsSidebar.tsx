import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Package } from '../types';
import { useFilterStore } from '../store/filterStore';
import {
	List, ListItem, ListItemText, Collapse, IconButton, Box, Typography
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { alpha } from '@mui/material/styles';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

interface TocData {
	[folder1: string]: string[];
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
	const setFolder1 = useFilterStore((state) => state.setFolder1);
	const setCategory1 = useFilterStore((state) => state.setCategory1);

	useEffect(() => {
		const fetchPackagesAndBuildToc = async () => {
			const { data: supabaseData, error } = await supabase
				.from('packages')
				.select('folder1, category1');

			if (error) {
				console.error("Error fetching packages for TOC:", error.message);
				return;
			}

			const packageList = supabaseData as Pick<Package, 'folder1' | 'category1'>[];
			const tocStructure: TocData = {};

			packageList.forEach(pkg => {
				const folder1 = pkg.folder1 || 'Uncategorized';
				const category1 = pkg.category1;

				if (!tocStructure[folder1]) {
					tocStructure[folder1] = [];
				}
				if (category1 && !tocStructure[folder1].includes(category1)) {
					tocStructure[folder1].push(category1);
				}
			});

			Object.keys(tocStructure).forEach(folder => {
				tocStructure[folder].sort();
			});

			setTocData(tocStructure);
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
		setFolder1(folder);
		setCategory1(category);
	};

	const handleFolderHeaderClick = (folder: string) => {
		setFolder1(folder);
		setCategory1(null);
	};

	const sortedFolders = Object.keys(tocData).sort();

	return (
		<Box sx={{
			height: '100%',
			overflowY: 'auto',
			pt: 2,
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
				px: 2,
				mb: 2,
				pb: 2,
				borderBottom: 1,
				borderColor: 'divider',
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

			<List component="nav" dense sx={{ px: 1, py: 0 }}>
				<ListItem
					button
					sx={{
						mb: 0.5,
						py: 0,
						borderRadius: 1,
						'&:hover': {
							bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
						}
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
								fontWeight: 'medium',
								fontSize: '0.9rem',
							}
						}}
					/>
				</ListItem>

				{sortedFolders.map((folder, folderIndex) => (
					<Box key={folder} sx={{ position: 'relative', mb: 0.25 }}>
						<ListItem
							button
							sx={{
								borderRadius: 1,
								py: 0,
								pl: 2,
								'&:hover': {
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
								}
							}}
						>
							<ListItemText
								primary={folder}
								onClick={() => handleFolderHeaderClick(folder)}
								primaryTypographyProps={{
									sx: {
										fontWeight: 'medium',
										fontSize: '0.9rem',
									}
								}}
							/>
							{tocData[folder] && tocData[folder].length > 0 && (
								<IconButton
									edge="end"
									size="small"
									onClick={() => handleFolderClick(folder)}
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
								<List component="div" disablePadding dense sx={{ position: 'relative', ml: 2 }}>
									<TreeBranch isOpen={openFolders.has(folder)} isLast={folderIndex === sortedFolders.length - 1} />
									{tocData[folder].map((category) => (
										<ListItem
											key={category}
											button
											onClick={() => handleCategoryClick(folder, category)}
											sx={{
												pl: 4,
												py: 0.25,
												borderRadius: 1,
												position: 'relative',
												'&:hover': {
													bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
												}
											}}
										>
											<ListItemText
												primary={category}
												primaryTypographyProps={{
													sx: {
														fontWeight: 'normal',
														fontSize: '0.85rem',
														color: 'text.primary'
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