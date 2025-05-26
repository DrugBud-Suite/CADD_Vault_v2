import React, { useState, useEffect, useMemo } from 'react';
import {
	Box, Typography, FormGroup, FormControlLabel, Button,
	Switch, Slider, Autocomplete, TextField, Chip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useFilterStore } from '../store/filterStore';
import { useShallow } from 'zustand/react/shallow'; // Import useShallow
import { debounce } from 'lodash-es';

const FilterSidebar: React.FC = () => {
	const {
		hasGithub,
		hasWebserver,
		hasPublication,
		minStars,
		minCitations,
		minRating,
		selectedTags,
		allAvailableTags,
		selectedLicenses,
		allAvailableLicenses,
		datasetMaxStars,
		datasetMaxCitations,
		setHasGithub,
		setHasWebserver,
		setHasPublication,
		setMinStars,
		setMinCitations,
		setMinRating,
		setSelectedTags,
		setSelectedLicenses,
		resetFilters,
	} = useFilterStore(useShallow(state => ({
		hasGithub: state.hasGithub,
		hasWebserver: state.hasWebserver,
		hasPublication: state.hasPublication,
		minStars: state.minStars,
		minCitations: state.minCitations,
		minRating: state.minRating,
		selectedTags: state.selectedTags,
		allAvailableTags: state.allAvailableTags,
		selectedLicenses: state.selectedLicenses,
		allAvailableLicenses: state.allAvailableLicenses,
		datasetMaxStars: state.datasetMaxStars,
		datasetMaxCitations: state.datasetMaxCitations,
		setHasGithub: state.setHasGithub,
		setHasWebserver: state.setHasWebserver,
		setHasPublication: state.setHasPublication,
		setMinStars: state.setMinStars,
		setMinCitations: state.setMinCitations,
		setMinRating: state.setMinRating,
		setSelectedTags: state.setSelectedTags,
		setSelectedLicenses: state.setSelectedLicenses,
		resetFilters: state.resetFilters,
	})));

	// Local state for slider values to provide immediate UI feedback
	const [localMinStars, setLocalMinStars] = useState<number | null>(minStars);
	const [localMinCitations, setLocalMinCitations] = useState<number | null>(minCitations);
	const [localMinRating, setLocalMinRating] = useState<number | null>(minRating);

	// Memoized debounced setters for store updates
	const debouncedSetMinStars = useMemo(() => debounce((value: number | null) => setMinStars(value), 300), [setMinStars]);
	const debouncedSetMinCitations = useMemo(() => debounce((value: number | null) => setMinCitations(value), 300), [setMinCitations]);
	const debouncedSetMinRating = useMemo(() => debounce((value: number | null) => setMinRating(value), 300), [setMinRating]);

	// Update local slider state when store values change (e.g., on reset)
	useEffect(() => {
		setLocalMinStars(minStars);
	}, [minStars]);

	useEffect(() => {
		setLocalMinCitations(minCitations);
	}, [minCitations]);

	useEffect(() => {
		setLocalMinRating(minRating);
	}, [minRating]);

	return (
		<Box sx={{
			p: 2,
			height: '100%',
			overflowY: 'auto',
			display: 'flex',
			flexDirection: 'column',
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
				<FilterListIcon sx={{ mr: 1, color: 'primary.main', fontSize: '1.25rem' }} />
				<Typography variant="h6" sx={{
					fontWeight: 'bold',
					fontSize: '1.1rem',
					color: 'text.primary'
				}}>
					Filters
				</Typography>
				<Box sx={{ flexGrow: 1 }} />
				<Button
					variant="text"
					size="small"
					onClick={resetFilters}
					sx={{
						color: 'text.secondary',
						fontWeight: 500,
						fontSize: '0.95rem',
						'&:hover': {
							color: 'primary.main'
						}
					}}
				>
					RESET
				</Button>
			</Box>

			{/* Tags Filter - Uses allAvailableTags from store */}
			<Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}>Tags</Typography>
			<Autocomplete
				multiple
				id="tags-filter"
				options={allAvailableTags || []} // Ensure options is an array
				value={selectedTags}
				onChange={(_, newValue) => {
					setSelectedTags(newValue);
				}}
				ChipProps={{
					size: 'small',
					sx: {
						borderRadius: 1.5,
						'& .MuiChip-label': {
							px: 1,
							fontSize: '0.8125rem'
						}
					}
				}}
				renderTags={(value: readonly string[], getTagProps) =>
					value.map((option: string, index: number) => (
						<Chip
							variant="filled"
							label={option}
							{...getTagProps({ index })}
							sx={{
								bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
								color: 'primary.main',
								'&:hover': {
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
								}
							}}
						/>
					))
				}
				renderInput={(params) => (
					<TextField
						{...params}
						variant="outlined"
						placeholder="Select or type tags..."
						size="small"
						sx={{
							mb: 3,
							'& .MuiOutlinedInput-root': {
								borderRadius: 2,
								'& fieldset': {
									borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
								},
								'&:hover fieldset': {
									borderColor: 'primary.main',
								},
							}
						}}
					/>
				)}
			/>

			{/* Availability Section */}
			<Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}>Availability</Typography>
			<FormGroup sx={{ mb: 3 }}>
				<FormControlLabel
					control={
						<Switch
							checked={hasGithub}
							onChange={(e) => setHasGithub(e.target.checked)}
							size="small"
							sx={{
								'& .MuiSwitch-switchBase.Mui-checked': {
									color: 'primary.main',
								},
								'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
									backgroundColor: 'primary.main',
								},
							}}
						/>
					}
					label={
						<Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.9rem' }}>
							Code Available
						</Typography>
					}
				/>
				<FormControlLabel
					control={
						<Switch
							checked={hasWebserver}
							onChange={(e) => setHasWebserver(e.target.checked)}
							size="small"
							sx={{
								'& .MuiSwitch-switchBase.Mui-checked': {
									color: 'primary.main',
								},
								'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
									backgroundColor: 'primary.main',
								},
							}}
						/>
					}
					label={
						<Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.9rem' }}>
							Webserver Available
						</Typography>
					}
				/>
				<FormControlLabel
					control={
						<Switch
							checked={hasPublication}
							onChange={(e) => setHasPublication(e.target.checked)}
							size="small"
							sx={{
								'& .MuiSwitch-switchBase.Mui-checked': {
									color: 'primary.main',
								},
								'& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
									backgroundColor: 'primary.main',
								},
							}}
						/>
					}
					label={
						<Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.9rem' }}>
							Publication Available
						</Typography>
					}
				/>
			</FormGroup>

			{/* Metrics Section */}
			<Box sx={{ mb: 3 }}>
				<Typography gutterBottom variant="body2" color="text.primary" sx={{ mt: 2, fontWeight: 500, fontSize: '0.9rem' }}>
					Minimum Rating ({localMinRating?.toFixed(1) ?? '0.0'}+)
				</Typography>
				<Slider
					value={localMinRating ?? 0}
					onChange={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						setLocalMinRating(value === 0 ? null : value);
					}}
					onChangeCommitted={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						debouncedSetMinRating(value === 0 ? null : value);
					}}
					valueLabelDisplay="auto"
					valueLabelFormat={(value) => `${value.toFixed(1)}★`}
					step={0.1}
					min={0}
					max={5}
					size="small"
					marks={[
						{ value: 0, label: '0' },
						{ value: 1, label: '1★' },
						{ value: 2, label: '2★' },
						{ value: 3, label: '3★' },
						{ value: 4, label: '4★' },
						{ value: 5, label: '5★' }
					]}
					sx={{
						color: 'warning.main',
						'& .MuiSlider-valueLabel': {
							bgcolor: 'warning.main',
						},
						'& .MuiSlider-mark': {
							bgcolor: (theme) => alpha(theme.palette.warning.main, 0.3),
						},
						'& .MuiSlider-markLabel': {
							fontSize: '0.75rem',
							color: 'text.secondary'
						}
					}}
				/>

				<Typography gutterBottom variant="body2" color="text.primary" sx={{ mt: 3, fontWeight: 500, fontSize: '0.9rem' }}>
					GitHub Stars ({localMinStars ?? 0}+)
				</Typography>
				<Slider
					value={localMinStars ?? 0}
					onChange={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						setLocalMinStars(value === 0 ? null : value);
					}}
					onChangeCommitted={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						debouncedSetMinStars(value === 0 ? null : value);
					}}
					valueLabelDisplay="auto"
					step={10}
					min={0}
					max={datasetMaxStars || 1000}
					size="small"
					sx={{
						color: 'primary.main',
						'& .MuiSlider-valueLabel': {
							bgcolor: 'primary.main',
						},
						'& .MuiSlider-mark': {
							bgcolor: (theme) => alpha(theme.palette.primary.main, 0.3),
						}
					}}
				/>

				<Typography gutterBottom variant="body2" color="text.primary" sx={{ mt: 2, fontWeight: 500, fontSize: '0.9rem' }}>
					Citations ({localMinCitations ?? 0}+)
				</Typography>
				<Slider
					value={localMinCitations ?? 0}
					onChange={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						setLocalMinCitations(value === 0 ? null : value);
					}}
					onChangeCommitted={(_, newValue) => {
						const value = Array.isArray(newValue) ? newValue[0] : newValue;
						debouncedSetMinCitations(value === 0 ? null : value);
					}}
					valueLabelDisplay="auto"
					step={10}
					min={0}
					max={datasetMaxCitations || 1000}
					size="small"
					sx={{
						color: 'primary.main',
						'& .MuiSlider-valueLabel': {
							bgcolor: 'primary.main',
						},
						'& .MuiSlider-mark': {
							bgcolor: (theme) => alpha(theme.palette.primary.main, 0.3),
						}
					}}
				/>
			</Box>

			{/* License Filter - Uses allAvailableLicenses from store */}
			<Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}>Licenses</Typography>
			<Autocomplete
				multiple
				id="license-filter"
				options={allAvailableLicenses || []}
				value={selectedLicenses}
				onChange={(_, newValue) => {
					setSelectedLicenses(newValue);
				}}
				ChipProps={{
					size: 'small',
					sx: {
						borderRadius: 1.5,
						'& .MuiChip-label': {
							px: 1,
							fontSize: '0.8125rem'
						}
					}
				}}
				renderTags={(value: readonly string[], getTagProps) =>
					value.map((option: string, index: number) => (
						<Chip
							variant="filled"
							label={option}
							{...getTagProps({ index })}
							sx={{
								bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
								color: 'primary.main',
								'&:hover': {
									bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
								}
							}}
						/>
					))
				}
				renderInput={(params) => (
					<TextField
						{...params}
						variant="outlined"
						placeholder="Select licenses..."
						size="small"
						sx={{
							'& .MuiOutlinedInput-root': {
								borderRadius: 2,
								'& fieldset': {
									borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
								},
								'&:hover fieldset': {
									borderColor: 'primary.main',
								},
							}
						}}
					/>
				)}
			/>
		</Box>
	);
};

export default FilterSidebar;