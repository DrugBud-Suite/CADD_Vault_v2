import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import AdminRoute from './components/AdminRoute'; // Import AdminRoute
import './App.css';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PackageDetailPage = lazy(() => import('./pages/PackageDetailPage'));
const AddPackagePage = lazy(() => import('./pages/AddPackagePage'));
const EditPackagePage = lazy(() => import('./pages/EditPackagePage'));

function App() {
	// Fallback UI for Suspense
	const suspenseFallback = (
		<Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100vh' }}>
			<CircularProgress />
		</Box>
	);

	return (
		// <Router> Removed: Router is already provided in main.tsx
		<Layout>
			<Suspense fallback={suspenseFallback}>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/about" element={<AboutPage />} />
					{/* Add other routes here if needed */}
					<Route path="/package/:packageId" element={<PackageDetailPage />} />
					{/* Admin Routes */}
					<Route element={<AdminRoute />}> {/* Wrap admin routes with AdminRoute */}
						<Route path="/add-package" element={<AddPackagePage />} />
						<Route path="/edit-package/:packageId" element={<EditPackagePage />} />
					</Route>
				</Routes>
			</Suspense>
		</Layout>
		// </Router> Removed
	);
}

export default App;
