// src/pages/AdminBulkUploadPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { Package, PackageSuggestion as Suggestion } from '../types';
// @ts-ignore
import Papa from 'papaparse';
import EditSuggestionModal from '../components/EditSuggestionModal';

import {
	Container,
	Typography,
	Button,
	Box,
	Paper,
	TableContainer,
	Table,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
	Checkbox,
	CircularProgress,
	Alert,
	Tooltip,
	Chip,
	styled,
	useTheme,
} from '@mui/material';
import {
	UploadFileOutlined as UploadFileIcon,
	ReportProblemOutlined as AlertCircleIcon,
	CheckCircleOutline as CheckCircleIcon,
	EditOutlined as EditIcon,
	CloudUploadOutlined as UploadCloudIcon,
	CancelOutlined as XCircleIcon,
	InfoOutlined as InfoIcon,
} from '@mui/icons-material';
// @ts-ignore
import { toast } from 'react-hot-toast';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

// Raw data structure from CSV
interface CsvRowInput {
	timestamp?: string;
	package_name?: string;
	publication_url?: string;
	repo_url?: string;
	webserver_url?: string;
	link_url?: string;
	description?: string;
	license?: string;
	tags?: string;
	folder1?: string;
	category1?: string;
	status?: string;
	[key: string]: any;
}

interface CsvRowData {
	timestamp: string;
	package_name: string;
	publication_url: string;
	repo_url: string;
	webserver_url: string;
	link_url: string;
	description: string;
	license: string;
	tags: string[];
	folder1: string;
	category1: string;
	status: string;
	originalCsvRowIndex: number;
	tempId: string;
}

interface ClashInfo {
	field: 'package_name' | 'repo_url' | 'publication_url';
	conflictingValue: string;
	sourceTable: 'packages' | 'suggestions';
	conflictingEntryId?: string;
	conflictingEntryName?: string;
}

interface ParsedCsvItem {
	csvData: CsvRowData;
	clashDetails?: ClashInfo | null;
	markedForImport: boolean;
	importStatus?: 'imported' | 'error' | 'skipped' | 'pending';
	databaseId?: string;
	errorMessage?: string;
}

const VisuallyHiddenInput = styled('input')({
	clip: 'rect(0 0 0 0)',
	clipPath: 'inset(50%)',
	height: 1,
	overflow: 'hidden',
	position: 'absolute',
	bottom: 0,
	left: 0,
	whiteSpace: 'nowrap',
	width: 1,
});


const AdminBulkUploadPage: React.FC = () => {
	const { currentUser, loading: authLoading, isAdmin } = useAuth();
	const [parsedCsvItems, setParsedCsvItems] = useState<ParsedCsvItem[]>([]);
	const [isLoading, setIsLoading] = useState(false); // General loading for page data
	const [isProcessing, setIsProcessing] = useState(false); // Specific loading for CSV parsing/saving
	const [allPackages, setAllPackages] = useState<Package[]>([]);
	const [allExistingSuggestions, setAllExistingSuggestions] = useState<Suggestion[]>([]);
	const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const theme = useTheme();

	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			try {
				const { data: packagesData, error: packagesError } = await supabase
					.from('packages')
					.select('*');
				if (packagesError) throw packagesError;
				setAllPackages(packagesData || []);

				const { data: suggestionsData, error: suggestionsError } = await supabase
					.from('suggestions')
					.select('*');
				if (suggestionsError) throw suggestionsError;
				setAllExistingSuggestions(suggestionsData || []);
			} catch (error: any) {
				console.error('Error fetching existing data:', error);
				toast.error(`Failed to load existing data: ${error.message}`);
			}
			setIsLoading(false);
		};
		fetchData();
	}, []);

	const findConflict = (
		value: string | null | undefined,
		items: (Package | Suggestion)[],
		fieldName: keyof Package | keyof Suggestion,
		itemType: 'packages' | 'suggestions'
	): ClashInfo | null => {
		if (!value || value.trim() === '') return null;
		const lowerValue = value.toLowerCase().trim();
		for (const item of items) {
			const itemValue = item[fieldName as keyof typeof item] as string | null;
			if (itemValue && typeof itemValue === 'string' && itemValue.toLowerCase().trim() === lowerValue) {
				return {
					field: fieldName as 'package_name' | 'repo_url' | 'publication_url',
					conflictingValue: itemValue,
					sourceTable: itemType,
					conflictingEntryId: item.id,
					conflictingEntryName: (item as Package).name || (item as Suggestion).package_name,
				};
			}
		}
		return null;
	};

	const checkForClashes = useCallback((
		csvRow: CsvRowData,
		currentPackages: Package[],
		currentSuggestions: Suggestion[]
	): ClashInfo | null => {
		let conflict: ClashInfo | null = null;

		conflict = findConflict(csvRow.package_name, currentPackages, 'name', 'packages');
		if (conflict) return conflict;
		conflict = findConflict(csvRow.package_name, currentSuggestions, 'package_name', 'suggestions');
		if (conflict) return conflict;

		if (csvRow.repo_url && csvRow.repo_url.trim() !== '') {
			conflict = findConflict(csvRow.repo_url, currentPackages, 'repo_url', 'packages');
			if (conflict) return conflict;
			conflict = findConflict(csvRow.repo_url, currentSuggestions, 'repo_url', 'suggestions');
			if (conflict) return conflict;
		}

		if (csvRow.publication_url && csvRow.publication_url.trim() !== '') {
			conflict = findConflict(csvRow.publication_url, currentPackages, 'publication_url', 'packages');
			if (conflict) return conflict;
			conflict = findConflict(csvRow.publication_url, currentSuggestions, 'publication_url', 'suggestions');
			if (conflict) return conflict;
		}
		return null;
	}, []); // Removed dependencies as they are passed as arguments now

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		setIsProcessing(true);
		setParsedCsvItems([]);

		Papa.parse<CsvRowInput>(file, {
			header: true,
			skipEmptyLines: true,
			complete: (results: Papa.ParseResult<CsvRowInput>) => {
				const parsedData = results.data.map((row: CsvRowInput, index: number) => {
					if (!row.timestamp || !row.package_name || !row.status) {
						console.warn(`Skipping row ${index + 1} due to missing required fields.`, row);
						return null;
					}
					const csvRow: CsvRowData = {
						timestamp: String(row.timestamp).trim(),
						package_name: String(row.package_name).trim(),
						publication_url: String(row.publication_url || '').trim(),
						repo_url: String(row.repo_url || '').trim(),
						webserver_url: String(row.webserver_url || '').trim(),
						link_url: String(row.link_url || '').trim(),
						description: String(row.description || '').trim(),
						license: String(row.license || '').trim(),
						tags: row.tags ? (() => {
							try {
								const parsed = JSON.parse(row.tags);
								return Array.isArray(parsed) ? parsed.filter(tag => typeof tag === 'string' && tag.trim().length > 0) : [];
							} catch (e) {
								console.warn(`Invalid JSON format for tags in row ${index + 1}: ${row.tags}. Expected format: ["tag1", "tag2", "tag3"]`);
								return [];
							}
						})() : [],
						folder1: String(row.folder1 || '').trim(),
						category1: String(row.category1 || '').trim(),
						status: String(row.status).trim(),
						originalCsvRowIndex: index,
						tempId: uuidv4(),
					};
					// Pass current state of allPackages and allExistingSuggestions
					const clashDetails = checkForClashes(csvRow, allPackages, allExistingSuggestions);
					return {
						csvData: csvRow,
						clashDetails,
						markedForImport: true,
						importStatus: 'pending' as 'pending',
					};
				}).filter((item: ParsedCsvItem | null): item is ParsedCsvItem => item !== null);

				setParsedCsvItems(parsedData);
				setIsProcessing(false);
				if (results.errors.length > 0) {
					toast.error(`Encountered ${results.errors.length} errors during CSV parsing. Check console.`);
					console.error("CSV Parsing Errors:", results.errors);
				}
				// Reset file input to allow re-uploading the same file
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			},
			error: (error: Papa.ParseError) => {
				console.error('CSV parsing error:', error);
				toast.error('Failed to parse CSV file.');
				setIsProcessing(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			}
		});
	};

	const toggleImportMark = (tempId: string) => {
		setParsedCsvItems(prevItems =>
			prevItems.map(item =>
				item.csvData.tempId === tempId
					? { ...item, markedForImport: !item.markedForImport }
					: item
			)
		);
	};

	const handleProcessAndSave = async () => {
		if (!currentUser) {
			toast.error('You must be logged in to save suggestions.');
			return;
		}

		const itemsToImport = parsedCsvItems.filter(item => item.markedForImport && item.importStatus === 'pending');
		if (itemsToImport.length === 0) {
			toast.error('No items selected or pending for import.');
			return;
		}

		setIsProcessing(true);
		let successCount = 0;
		let errorCount = 0;
		const newSuggestionsCreated: Suggestion[] = [];

		const updatedItems = [...parsedCsvItems];

		for (const item of itemsToImport) {
			const suggestionToInsert: Omit<Suggestion, 'id' | 'user_email' | 'reviewed_at' | 'reviewed_by_user_id'> & { suggested_by_user_id: string } = {
				package_name: item.csvData.package_name,
				description: item.csvData.description || undefined,
				publication_url: item.csvData.publication_url || undefined,
				repo_url: item.csvData.repo_url || undefined,
				webserver_url: item.csvData.webserver_url || undefined,
				link_url: item.csvData.link_url || undefined,
				license: item.csvData.license || undefined,
				tags: item.csvData.tags.length > 0 ? item.csvData.tags : undefined,
				folder1: item.csvData.folder1 || undefined,
				category1: item.csvData.category1 || undefined,
				suggestion_reason: 'Bulk CSV Upload',
				status: item.csvData.status as Suggestion['status'],
				admin_notes: item.clashDetails ? `Potential Clash: ${item.clashDetails.field} with ${item.clashDetails.sourceTable} (ID: ${item.clashDetails.conflictingEntryId || 'N/A'}, Name: ${item.clashDetails.conflictingEntryName || 'N/A'})` : undefined,
				created_at: new Date(item.csvData.timestamp).toISOString(),
				suggested_by_user_id: currentUser.id,
			};

			const itemIndex = updatedItems.findIndex(ui => ui.csvData.tempId === item.csvData.tempId);

			try {
				const { data, error } = await supabase
					.from('package_suggestions') // Changed from 'suggestions'
					.insert(suggestionToInsert)
					.select()
					.single();

				if (error) throw error;

				if (data && itemIndex !== -1) {
					updatedItems[itemIndex] = { ...updatedItems[itemIndex], importStatus: 'imported', databaseId: data.id };
					newSuggestionsCreated.push(data as Suggestion); // Add to list for state update
					successCount++;
				} else {
					if (itemIndex !== -1) updatedItems[itemIndex] = { ...updatedItems[itemIndex], importStatus: 'error', errorMessage: 'Import ok but no data returned.' };
					errorCount++;
				}
			} catch (error: any) {
				console.error('Error inserting suggestion:', error);
				if (itemIndex !== -1) updatedItems[itemIndex] = { ...updatedItems[itemIndex], importStatus: 'error', errorMessage: error.message || 'Unknown error.' };
				errorCount++;
			}
		}

		setParsedCsvItems(updatedItems);
		// Update the main list of suggestions with newly created ones for accurate clash detection
		if (newSuggestionsCreated.length > 0) {
			setAllExistingSuggestions(prev => [...prev, ...newSuggestionsCreated]);
		}
		setIsProcessing(false);
		toast.success(`${successCount} suggestions imported successfully.`);
		if (errorCount > 0) {
			toast.error(`${errorCount} suggestions failed to import.`);
		}
	};

	const handleEditImportedSuggestion = async (suggestionId: string) => {
		setIsProcessing(true);
		try {
			const { data, error } = await supabase
				.from('package_suggestions') // Changed from 'suggestions'
				.select('*, user_profile:suggested_by_user_id(email)')
				.eq('id', suggestionId)
				.single();
			if (error) throw error;
			if (data) {
				const suggestionToEdit: Suggestion = { ...data, user_email: (data.user_profile as any)?.email || undefined };
				delete (suggestionToEdit as any).user_profile;
				setEditingSuggestion(suggestionToEdit);
			} else {
				toast.error('Could not find the suggestion to edit.');
			}
		} catch (error: any) {
			console.error('Error fetching suggestion for edit:', error);
			toast.error(`Failed to load suggestion for editing: ${error.message}`);
		}
		setIsProcessing(false);
	};

	const onSuggestionUpdatedInModal = async () => {
		const updatedId = editingSuggestion?.id;
		setEditingSuggestion(null);
		toast.success('Suggestion updated in the database.');

		if (updatedId) {
			setIsProcessing(true);
			try {
				const { data: newSuggestionData, error: fetchError } = await supabase
					.from('package_suggestions') // Changed from 'suggestions'
					.select('*')
					.eq('id', updatedId)
					.single();

				if (fetchError) throw fetchError;

				if (newSuggestionData) {
					// Update the item in parsedCsvItems state
					setParsedCsvItems(prevItems => prevItems.map(item => {
						if (item.databaseId === updatedId) {
							const updatedCsvEquivalent: CsvRowData = {
								...item.csvData,
								package_name: newSuggestionData.package_name,
								publication_url: newSuggestionData.publication_url || '',
								repo_url: newSuggestionData.repo_url || '',
								webserver_url: newSuggestionData.webserver_url || '',
								description: newSuggestionData.description || '',
								status: newSuggestionData.status,
							};
							const newClashDetails = checkForClashes(updatedCsvEquivalent, allPackages, allExistingSuggestions.map(s => s.id === updatedId ? newSuggestionData : s));
							return { ...item, csvData: updatedCsvEquivalent, clashDetails: newClashDetails };
						}
						return item;
					}));
					// Refresh the main list of allExistingSuggestions
					setAllExistingSuggestions(prevSuggestions =>
						prevSuggestions.map(s => s.id === updatedId ? newSuggestionData : s)
					);
					toast.success('Local clash information updated.');
				}
			} catch (error: any) {
				console.error("Error refreshing suggestion data after edit:", error);
				toast.error(`Failed to refresh local data: ${error.message}`);
			} finally {
				setIsProcessing(false);
			}
		}
	};

	if (authLoading || isLoading) { // Combined initial loading states
		return (
			<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
				<CircularProgress />
			</Container>
		);
	}

	if (!currentUser) {
		return (
			<Container sx={{ py: 4 }}>
				<Alert severity="error">You must be logged in to access this page.</Alert>
			</Container>
		);
	}
	if (!isAdmin) {
		return (
			<Container sx={{ py: 4 }}>
				<Alert severity="error">Access Denied. This page is for administrators only.</Alert>
			</Container>
		);
	}

	const allPendingItemsSelected = parsedCsvItems.length > 0 && parsedCsvItems.filter(i => i.importStatus === 'pending').every(item => item.markedForImport);
	const somePendingItemsSelected = parsedCsvItems.some(item => item.importStatus === 'pending' && item.markedForImport);
	const noPendingItems = !parsedCsvItems.some(item => item.importStatus === 'pending');


	return (
		<Container sx={{ py: 4 }}>
			<Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
				Admin Bulk Suggestion Upload
			</Typography>
			<Typography variant="subtitle1" color="text.secondary" gutterBottom>
				Upload, review, and import multiple package suggestions via a CSV file.
			</Typography>

			<Paper elevation={3} sx={{ p: 3, my: 3 }}>
				<Typography variant="h6" component="h2" gutterBottom>
					Upload CSV File
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
					Required headers: <code>timestamp, package_name, status</code>. Optional headers: <code>publication_url, repo_url, webserver_url, link_url, description, license, tags, folder1, category1</code>.
				</Typography>
				<ul style={{ fontSize: '0.875rem', color: theme.palette.text.secondary, paddingLeft: '20px', marginBottom: theme.spacing(2) }}>
					<li>Ensure <code>timestamp</code> is ISO 8601 (e.g., <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>).</li>
					<li><code>package_name</code> and <code>status</code> are mandatory for each row.</li>
					<li><code>tags</code> should be a JSON array format (e.g., <code>["molecular dynamics", "simulation", "analysis"]</code>).</li>
					<li>All other fields are optional and will be set to empty if not provided.</li>
				</ul>
				<Button
					component="label"
					variant="contained"
					startIcon={<UploadFileIcon />}
					disabled={isProcessing}
					sx={{ mb: 1 }}
				>
					Choose CSV File
					<VisuallyHiddenInput type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} />
				</Button>
				{fileInputRef.current?.files?.[0] && (
					<Typography variant="body2" sx={{ ml: 1, display: 'inline' }}>Selected: {fileInputRef.current.files[0].name}</Typography>
				)}
			</Paper>

			{isProcessing && parsedCsvItems.length === 0 && (
				<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 4, p: 3, flexDirection: 'column' }}>
					<CircularProgress sx={{ mb: 2 }} />
					<Typography>Processing CSV...</Typography>
				</Box>
			)}

			{parsedCsvItems.length > 0 && (
				<Paper elevation={3} sx={{ mt: 4, overflow: 'hidden' }}>
					<Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
						<Typography variant="h6">Review & Import Suggestions</Typography>
						<Button
							variant="contained"
							color="success"
							startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <UploadCloudIcon />}
							onClick={handleProcessAndSave}
							disabled={isProcessing || !parsedCsvItems.some(item => item.markedForImport && item.importStatus === 'pending')}
						>
							Import Selected ({parsedCsvItems.filter(item => item.markedForImport && item.importStatus === 'pending').length})
						</Button>
					</Box>
					<TableContainer>
						<Table stickyHeader aria-label="suggestions review table">
							<TableHead>
								<TableRow>
									<TableCell padding="checkbox">
										<Checkbox
											indeterminate={somePendingItemsSelected && !allPendingItemsSelected}
											checked={parsedCsvItems.length > 0 && allPendingItemsSelected && !noPendingItems}
											onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
												const checked = event.target.checked;
												setParsedCsvItems(items => items.map(i => ({ ...i, markedForImport: i.importStatus === 'pending' ? checked : i.markedForImport })));
											}}
											disabled={isProcessing || noPendingItems}
											inputProps={{ 'aria-label': 'select all pending suggestions' }}
										/>
									</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Row</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Package Name</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Tags</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Category/Folder</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>License</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Clash Details</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Status (CSV)</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Import Status</TableCell>
									<TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{parsedCsvItems.map((item: ParsedCsvItem) => (
									<TableRow
										key={item.csvData.tempId}
										hover
										sx={{
											backgroundColor: item.importStatus === 'imported'
												? theme.palette.success.light + '33' // Light green with opacity
												: item.importStatus === 'error'
													? theme.palette.error.light + '33' // Light red with opacity
													: 'inherit'
										}}
									>
										<TableCell padding="checkbox">
											<Checkbox
												checked={item.markedForImport}
												onChange={() => toggleImportMark(item.csvData.tempId)}
												disabled={item.importStatus !== 'pending' || isProcessing}
												inputProps={{ 'aria-label': `select suggestion ${item.csvData.package_name}` }}
											/>
										</TableCell>
										<TableCell>{item.csvData.originalCsvRowIndex + 1}</TableCell>
										<TableCell sx={{ fontWeight: 500 }}>{item.csvData.package_name}</TableCell>
										<TableCell>
											{item.csvData.tags.length > 0 ? (
												<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
													{item.csvData.tags.slice(0, 3).map((tag, index) => (
														<Chip key={index} label={tag} size="small" variant="outlined" />
													))}
													{item.csvData.tags.length > 3 && (
														<Chip label={`+${item.csvData.tags.length - 3} more`} size="small" variant="outlined" />
													)}
												</Box>
											) : (
												<Typography variant="body2" color="text.secondary">-</Typography>
											)}
										</TableCell>
										<TableCell>
											{item.csvData.category1 || item.csvData.folder1 ? (
												<Box>
													{item.csvData.category1 && (
														<Chip label={`Cat: ${item.csvData.category1}`} size="small" variant="outlined" sx={{ mb: 0.5 }} />
													)}
													{item.csvData.folder1 && (
														<Chip label={`Folder: ${item.csvData.folder1}`} size="small" variant="outlined" />
													)}
												</Box>
											) : (
												<Typography variant="body2" color="text.secondary">-</Typography>
											)}
										</TableCell>
										<TableCell>
											{item.csvData.license ? (
												<Chip label={item.csvData.license} size="small" variant="outlined" />
											) : (
												<Typography variant="body2" color="text.secondary">-</Typography>
											)}
										</TableCell>
										<TableCell>
											{item.clashDetails ? (
												<Chip
													icon={<AlertCircleIcon />}
													label={
														<Tooltip title={`Clash on ${item.clashDetails.field.replace('_', ' ')} with ${item.clashDetails.sourceTable}: "${item.clashDetails.conflictingEntryName || item.clashDetails.conflictingValue}" (ID: ${item.clashDetails.conflictingEntryId || 'N/A'})`}>
															<span>{`${item.clashDetails.field.replace('_', ' ')} with ${item.clashDetails.sourceTable}`}</span>
														</Tooltip>
													}
													color="warning"
													variant="outlined"
													size="small"
												/>
											) : (
												<Chip icon={<CheckCircleIcon />} label="No conflicts" color="success" variant="outlined" size="small" />
											)}
										</TableCell>
										<TableCell>
											<Chip label={item.csvData.status} size="small" variant="outlined" />
										</TableCell>
										<TableCell>
											{item.importStatus === 'imported' && <Chip icon={<CheckCircleIcon />} label="Imported" color="success" size="small" />}
											{item.importStatus === 'error' &&
												<Tooltip title={item.errorMessage || "Unknown error"}>
													<Chip icon={<XCircleIcon />} label="Error" color="error" size="small" />
												</Tooltip>
											}
											{item.importStatus === 'pending' && <Chip icon={<CircularProgress size={16} sx={{ mr: 0.5 }} />} label="Pending" size="small" variant="outlined" />}
											{item.importStatus === 'skipped' && <Chip label="Skipped" size="small" variant="outlined" />}
										</TableCell>
										<TableCell>
											{item.importStatus === 'imported' && item.databaseId && (
												<Button
													variant="outlined"
													size="small"
													startIcon={<EditIcon />}
													onClick={() => handleEditImportedSuggestion(item.databaseId!)}
													disabled={isProcessing}
												>
													Edit
												</Button>
											)}
											{item.importStatus === 'error' && item.errorMessage && (
												<Tooltip title={item.errorMessage}>
													<InfoIcon color="error" fontSize="small" />
												</Tooltip>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</Paper>
			)}

			{editingSuggestion && (
				<EditSuggestionModal
					open={!!editingSuggestion}
					onClose={() => setEditingSuggestion(null)}
					suggestion={editingSuggestion}
					onSaveSuccess={onSuggestionUpdatedInModal}
					isAdmin={isAdmin} // Added missing isAdmin prop
				/>
			)}
		</Container>
	);
};

export default AdminBulkUploadPage;
