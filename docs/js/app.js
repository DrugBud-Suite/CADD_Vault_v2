// Main application code
document.addEventListener('DOMContentLoaded', function () {
	// Check if Firebase is initialized
	if (typeof firebase === 'undefined') {
		console.error("Firebase SDK not loaded");
		document.getElementById('loading-indicator').textContent =
			'Error loading application. Please refresh the page or contact support.';
		return;
	}

	// Check if Firestore is initialized
	if (typeof db === 'undefined') {
		console.error("Firestore not initialized");
		document.getElementById('loading-indicator').textContent =
			'Error connecting to database. Please refresh the page or contact support.';
		return;
	}

	try {
		// Initialize packages manager
		const packagesManager = new PackagesManager();
		packagesManager.init().catch(error => {
			console.error("Failed to initialize package manager:", error);
			document.getElementById('loading-indicator').textContent =
				`Error loading packages: ${error.message}. Please try again later.`;
		});
	} catch (error) {
		console.error("Critical error in application initialization:", error);
		document.getElementById('loading-indicator').textContent =
			'Critical application error. Please refresh the page or contact support.';
	}
});