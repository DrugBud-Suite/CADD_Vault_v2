// Firebase configuration with enhanced error handling
console.log("Loading Firebase configuration...");

// Detect development mode - this helps provide appropriate error messages
const isDevelopment = window.location.hostname === 'localhost' ||
	window.location.hostname === '127.0.0.1' ||
	window.location.hostname.includes('.gitpod.io');

console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

// Initialize error handler
const errorHandler = new ErrorHandler(isDevelopment);
let loadingIndicator = document.getElementById('loading-indicator');

const firebaseConfig = {
	apiKey: "AIzaSyDWA7UCprKOEWlaIoSbw-_EcNM9PIO4wow",
	authDomain: "cadd-vault-f8fc0.firebaseapp.com",
	projectId: "cadd-vault-f8fc0",
	storageBucket: "cadd-vault-f8fc0.firebasestorage.app",
	messagingSenderId: "613470547495",
	appId: "1:613470547495:web:56640d735c0d44a5802802",
	measurementId: "G-SPS76ZJYG9"
};

console.log("Firebase config loaded:", firebaseConfig);
console.log('API Key in config:', firebaseConfig.apiKey);

// Validate API key before proceeding
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "missing-api-key") {
	const error = new Error("Firebase API key is missing or not replaced. Check build configuration.");
	const errorInfo = errorHandler.handleFirebaseInitError(error);

	// If loading indicator exists, show error there
	if (loadingIndicator) {
		loadingIndicator.innerHTML = errorHandler.createErrorDisplay(errorInfo);

		// Add retry button event listener
		const retryButton = document.getElementById('retry-button');
		if (retryButton) {
			retryButton.addEventListener('click', () => window.location.reload());
		}

		// View console button for development
		const viewDetailsButton = document.getElementById('view-details-button');
		if (viewDetailsButton) {
			viewDetailsButton.addEventListener('click', () => console.log('API Key Error:', error));
		}
	}

	throw error; // Stop initialization
}

// Initialize Firebase with detailed error handling
let db;
try {
	console.log("Attempting to initialize Firebase app...");

	// Check if firebase is defined
	if (typeof firebase === 'undefined') {
		throw new Error("Firebase SDK not loaded. Check script tags in HTML.");
	}

	// Initialize Firebase app
	firebase.initializeApp(firebaseConfig);
	console.log("Firebase app initialized successfully");

	// Check if firestore is defined
	if (typeof firebase.firestore === 'undefined') {
		throw new Error("Firebase Firestore module not loaded. Check script tags in HTML.");
	}

	// Initialize Firestore
	db = firebase.firestore();
	console.log("Firestore initialized successfully");

	// Test connection with a small read operation
	console.log("Testing Firestore connection...");
	db.collection('packages').limit(1).get()
		.then(snapshot => {
			console.log(`Firestore connection test successful. Got ${snapshot.size} documents.`);
			if (snapshot.size === 0) {
				console.warn("No documents found in 'packages' collection. The collection might be empty or you might not have read permissions.");

				// Only show warning in development mode
				if (isDevelopment && loadingIndicator) {
					const warningInfo = {
						title: 'Empty Collection',
						message: 'The packages collection appears to be empty.',
						details: 'This might be normal if you haven\'t imported any data yet.',
						actions: ['retry']
					};
					loadingIndicator.innerHTML = errorHandler.createErrorDisplay(warningInfo);

					// Add retry button event listener
					const retryButton = document.getElementById('retry-button');
					if (retryButton) {
						retryButton.addEventListener('click', () => window.location.reload());
					}
				}
			}
		})
		.catch(error => {
			console.error("Firestore connection test failed:", error);

			// Handle different error types
			let errorInfo;

			if (error.code === 'permission-denied') {
				errorInfo = errorHandler.handleDatabaseError(
					new Error("Permission denied. Check Firestore security rules.")
				);
			} else if (error.code === 'unavailable') {
				errorInfo = errorHandler.handleNetworkError(
					new Error("Firestore service unavailable. Check your connection.")
				);
			} else {
				errorInfo = errorHandler.handleDatabaseError(error);
			}

			if (loadingIndicator) {
				loadingIndicator.innerHTML = errorHandler.createErrorDisplay(errorInfo);

				// Add retry button event listener
				const retryButton = document.getElementById('retry-button');
				if (retryButton) {
					retryButton.addEventListener('click', () => window.location.reload());
				}

				// View console button for development
				const viewDetailsButton = document.getElementById('view-details-button');
				if (viewDetailsButton) {
					viewDetailsButton.addEventListener('click', () => console.log('Database Error:', error));
				}
			}
		});

} catch (error) {
	console.error("Error during Firebase initialization:", error);

	const errorInfo = errorHandler.handleFirebaseInitError(error);

	if (loadingIndicator) {
		loadingIndicator.innerHTML = errorHandler.createErrorDisplay(errorInfo);

		// Add retry button event listener
		const retryButton = document.getElementById('retry-button');
		if (retryButton) {
			retryButton.addEventListener('click', () => window.location.reload());
		}

		// View console button for development
		const viewDetailsButton = document.getElementById('view-details-button');
		if (viewDetailsButton) {
			viewDetailsButton.addEventListener('click', () => console.log('Firebase Init Error:', error));
		}
	}
}