// src/components/AdminRoute.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

const AdminRoute: React.FC = () => {
	const { currentUser, loading, isAdmin } = useAuth();

	if (loading) {
		// You might want a better loading indicator here
		return <div>Loading...</div>;
	}

	if (!currentUser || !isAdmin) {
		// Redirect to home or login page if not authenticated or not admin
		return <Navigate to="/" replace />;
	}

	// If authenticated and admin, render child routes
	return <Outlet />;
};

export default AdminRoute;