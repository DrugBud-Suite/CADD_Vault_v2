/**
 * Error handler utility for CADD Vault
 * Provides different error messages based on environment
 */
class ErrorHandler {
	/**
	 * Create a new error handler
	 * @param {boolean} isDevelopment - Whether the app is running in development mode
	 */
	constructor(isDevelopment = false) {
	  this.isDevelopment = isDevelopment;
	}
  
	/**
	 * Handle Firebase initialization error
	 * @param {Error} error - The error object
	 * @returns {Object} Error information object
	 */
	handleFirebaseInitError(error) {
	  console.error('Firebase initialization error:', error);
	  
	  if (this.isDevelopment) {
		return {
		  title: 'Firebase Initialization Failed',
		  message: `Could not initialize Firebase: ${error.message}`,
		  details: 'Check your API key in .env file and ensure Firebase is properly configured.',
		  technical: error.stack,
		  actions: ['checkConsole', 'retry']
		};
	  } else {
		return {
		  title: 'Connection Error',
		  message: 'Could not connect to the database service.',
		  details: 'This might be a temporary issue. Please try again later.',
		  actions: ['retry']
		};
	  }
	}
  
	/**
	 * Handle database operation error
	 * @param {Error} error - The error object 
	 * @returns {Object} Error information object
	 */
	handleDatabaseError(error) {
	  console.error('Database operation failed:', error);
	  
	  if (this.isDevelopment) {
		return {
		  title: 'Database Error',
		  message: `Could not access database: ${error.message}`,
		  details: 'Verify your database permissions and network connectivity.',
		  technical: error.stack,
		  actions: ['checkConsole', 'retry']
		};
	  } else {
		return {
		  title: 'Data Loading Error',
		  message: 'We encountered a problem loading the package data.',
		  details: 'This might be a temporary issue. Please try refreshing the page.',
		  actions: ['retry']
		};
	  }
	}
  
	/**
	 * Handle network error
	 * @param {Error} error - The error object
	 * @returns {Object} Error information object
	 */
	handleNetworkError(error) {
	  console.error('Network error:', error);
	  
	  return {
		title: 'Network Error',
		message: 'Could not connect to the server.',
		details: 'Please check your internet connection and try again.',
		technical: this.isDevelopment ? error.stack : null,
		actions: ['retry']
	  };
	}
  
	/**
	 * Handle data parsing error
	 * @param {Error} error - The error object
	 * @returns {Object} Error information object
	 */
	handleDataError(error) {
	  console.error('Data processing error:', error);
	  
	  if (this.isDevelopment) {
		return {
		  title: 'Data Processing Error',
		  message: `Error processing data: ${error.message}`,
		  details: 'There may be an issue with the data format or structure.',
		  technical: error.stack,
		  actions: ['checkConsole', 'retry']
		};
	  } else {
		return {
		  title: 'Application Error',
		  message: 'Something went wrong while processing the data.',
		  details: 'We\'ve logged this issue and are working to fix it.',
		  actions: ['retry']
		};
	  }
	}
  
	/**
	 * Create error display HTML
	 * @param {Object} errorInfo - Error information object
	 * @returns {string} HTML string for error display
	 */
	createErrorDisplay(errorInfo) {
	  return `
		<div class="error-message">
		  <span class="material-icons-round error-icon">error</span>
		  <h3>${errorInfo.title}</h3>
		  <p>${errorInfo.message}</p>
		  <p class="error-details">${errorInfo.details}</p>
		  ${errorInfo.technical ? `<pre class="error-technical">${errorInfo.technical}</pre>` : ''}
		  <div class="error-actions">
			${errorInfo.actions.includes('retry') ? 
			  `<button id="retry-button" class="btn btn-primary">Try Again</button>` : ''}
			${errorInfo.actions.includes('checkConsole') ? 
			  `<button id="view-details-button" class="btn btn-outline">View Console</button>` : ''}
		  </div>
		</div>
	  `;
	}
  }
  
  // If we're in a module environment, export the class
  if (typeof module !== 'undefined' && module.exports) {
	module.exports = ErrorHandler;
  }