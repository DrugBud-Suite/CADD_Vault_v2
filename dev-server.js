// dev-server.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');
require('dotenv').config(); // This loads variables from .env file

console.log('Starting development server...');
console.log('Using API key:', process.env.FIREBASE_API_KEY ? 'Key is present (not shown for security)' : 'MISSING');

// Read the firebase config template
const configTemplate = fs.readFileSync(
	path.join(__dirname, 'docs/js/firebase-config.js'),
	'utf8'
);

// Replace API key placeholder
const configWithKey = configTemplate.replace(
	/__FIREBASE_API_KEY__/g,
	process.env.FIREBASE_API_KEY || 'missing-api-key'
);

// Also update the validation logic to check for missing key
// rather than checking for a specific value
const configWithKeyAndValidation = configWithKey.replace(
	/if \(firebaseConfig\.apiKey === ".*?" \|\| !firebaseConfig\.apiKey\) {/,
	'if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "missing-api-key") {'
);

// Write the processed file to a temporary location
const tempConfigPath = path.join(__dirname, 'docs/js/firebase-config.temp.js');
fs.writeFileSync(tempConfigPath, configWithKeyAndValidation);
console.log('Generated temporary config file at:', tempConfigPath);

// Create server
const server = http.createServer((request, response) => {
	// Log each request in development
	console.log(`${new Date().toISOString()} - ${request.method} ${request.url}`);

	// Special handling for the config file
	if (request.url === '/js/firebase-config.js') {
		console.log('Serving Firebase config with injected API key');
		response.writeHead(200, { 'Content-Type': 'application/javascript' });
		response.end(configWithKeyAndValidation);
		return;
	}

	// Serve all other files normally
	return handler(request, response, {
		public: 'docs'
	});
});

// Handle server errors
server.on('error', (err) => {
	console.error('Server error:', err);
	if (err.code === 'EADDRINUSE') {
		console.error('Port 8000 is already in use. Please close the other application or use a different port.');
	}
});

// Start the server
server.listen(8000, () => {
	console.log('Development server running at http://localhost:8000');
	console.log('Press Ctrl+C to stop the server');
});

// Clean up on exit
process.on('SIGINT', () => {
	console.log('\nShutting down server...');
	try {
		fs.unlinkSync(tempConfigPath);
		console.log('Removed temporary config file');
	} catch (e) {
		// Ignore if file doesn't exist
		console.log('No temporary file to clean up');
	}
	console.log('Goodbye!');
	process.exit();
});