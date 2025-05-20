// src/App.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom'; // BrowserRouter is in main.tsx
import { Typography, Box, CircularProgress, Container } from '@mui/material';
import Layout from './components/Layout';
import AdminRoute from './components/AdminRoute';
import './App.css';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PackageDetailPage = lazy(() => import('./pages/PackageDetailPage'));
const AddPackagePage = lazy(() => import('./pages/AddPackagePage'));
const EditPackagePage = lazy(() => import('./pages/EditPackagePage'));
const SuggestPackagePage = lazy(() => import('./pages/SuggestPackagePage'));
const AdminReviewSuggestionsPage = lazy(() => import('./pages/AdminReviewSuggestionsPage'));
const MySuggestionsPage = lazy(() => import('./pages/MySuggestionsPage'));

// Placeholder for a simple Login Page if direct navigation is desired
const LoginPagePlaceholder = () => (
	<Container sx={{ mt: 5, textAlign: 'center' }}>
		<Typography variant="h5">Please Login</Typography>
		<Typography>Login functionality is typically handled via a modal in the header.</Typography>
	</Container>
);


function App() {
	// Fallback UI for Suspense
	const suspenseFallback = (
		<Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
			<CircularProgress />
		</Box>
	);

	return (
		<Layout>
			<Suspense fallback={suspenseFallback}>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/about" element={<AboutPage />} />
					<Route path="/package/:packageId" element={<PackageDetailPage />} />

					{/* Routes requiring authentication (can be wrapped if more complex auth logic is needed per route) */}
					<Route path="/suggest-package" element={<SuggestPackagePage />} />
					<Route path="/my-suggestions" element={<MySuggestionsPage />} />
					<Route path="/login" element={<LoginPagePlaceholder />} /> {/* Example if direct login page needed */}


					{/* Admin Routes */}
					<Route element={<AdminRoute />}>
						<Route path="/add-package" element={<AddPackagePage />} />
						<Route path="/edit-package/:packageId" element={<EditPackagePage />} />
						<Route path="/admin/review-suggestions" element={<AdminReviewSuggestionsPage />} />
					</Route>
				</Routes>
			</Suspense>
		</Layout>
	);
}

export default App;
