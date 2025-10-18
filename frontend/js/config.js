/**
 * API Configuration
 * Replace the API_BASE_URL with your actual API Gateway endpoint after deployment
 */

const CONFIG = {
    // API Gateway Base URL
    // After deploying backend, replace this with your actual endpoint
    // Example: 'https://abc123xyz.execute-api.us-east-1.amazonaws.com'
    API_BASE_URL: 'https://YOUR_API_GATEWAY_URL_HERE',

    // API Endpoints
    ENDPOINTS: {
        CHAT: '/chat',
        GENERATE_IMAGE: '/generate-image',
        FUNCTION_CALL: '/function-call',
        GET_HISTORY: '/history'
    },

    // Local Storage Keys
    STORAGE_KEYS: {
        SESSION_ID: 'chatbot_session_id',
        CHAT_HISTORY: 'chatbot_history',
        USER_PREFERENCES: 'chatbot_preferences'
    },

    // Application Settings
    SETTINGS: {
        // Maximum message length
        MAX_MESSAGE_LENGTH: 5000,

        // Auto-scroll to bottom on new message
        AUTO_SCROLL: true,

        // Show typing indicator
        SHOW_TYPING_INDICATOR: true,

        // Request timeout (milliseconds)
        REQUEST_TIMEOUT: 60000, // 60 seconds

        // Maximum history items to store locally
        MAX_LOCAL_HISTORY: 100,

        // Enable debug logging
        DEBUG: false
    },

    // UI Settings
    UI: {
        // Show welcome screen on first load
        SHOW_WELCOME_SCREEN: true,

        // Animation duration (milliseconds)
        ANIMATION_DURATION: 300,

        // Message display delay (milliseconds)
        MESSAGE_DELAY: 100
    },

    // Image Generation Settings
    IMAGE: {
        // Prefix to trigger image generation
        COMMAND_PREFIX: '/image',

        // Alternative prefix
        ALT_COMMAND_PREFIX: '/img',

        // Maximum prompt length for images
        MAX_PROMPT_LENGTH: 1000
    },

    // Error Messages
    ERRORS: {
        NETWORK_ERROR: 'Network error. Please check your connection and try again.',
        API_ERROR: 'Failed to connect to the server. Please try again later.',
        INVALID_RESPONSE: 'Received invalid response from server.',
        SESSION_ERROR: 'Session error. Starting a new session.',
        IMAGE_GENERATION_FAILED: 'Failed to generate image. Please try again.',
        MESSAGE_TOO_LONG: 'Message is too long. Please shorten your message.',
        EMPTY_MESSAGE: 'Please enter a message.',
        API_NOT_CONFIGURED: 'API endpoint not configured. Please set your API Gateway URL in config.js'
    },

    // Success Messages
    SUCCESS: {
        MESSAGE_SENT: 'Message sent successfully',
        IMAGE_GENERATED: 'Image generated successfully',
        HISTORY_LOADED: 'History loaded',
        SESSION_CREATED: 'New session started'
    }
};

/**
 * Helper function to get full API URL
 * @param {string} endpoint - Endpoint path
 * @returns {string} Full URL
 */
CONFIG.getApiUrl = function(endpoint) {
    if (this.API_BASE_URL === 'https://YOUR_API_GATEWAY_URL_HERE') {
        console.warn('⚠️ API_BASE_URL not configured! Please update config.js with your API Gateway URL.');
    }
    return `${this.API_BASE_URL}${endpoint}`;
};

/**
 * Helper function to check if API is configured
 * @returns {boolean}
 */
CONFIG.isApiConfigured = function() {
    return this.API_BASE_URL !== 'https://YOUR_API_GATEWAY_URL_HERE' &&
           this.API_BASE_URL !== '';
};

/**
 * Helper function to log debug messages
 * @param {string} message - Debug message
 * @param {*} data - Optional data to log
 */
CONFIG.debug = function(message, data = null) {
    if (this.SETTINGS.DEBUG) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
};

/**
 * Validate configuration
 */
CONFIG.validate = function() {
    const warnings = [];

    if (!this.isApiConfigured()) {
        warnings.push('API_BASE_URL is not configured');
    }

    if (this.SETTINGS.REQUEST_TIMEOUT < 5000) {
        warnings.push('REQUEST_TIMEOUT is too low (< 5 seconds)');
    }

    if (warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:', warnings);
    }

    return warnings.length === 0;
};

// Validate configuration on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        CONFIG.validate();

        if (!CONFIG.isApiConfigured()) {
            console.error(
                '%c⚠️ IMPORTANT: API Not Configured',
                'font-size: 16px; color: red; font-weight: bold;',
                '\n\nPlease update the API_BASE_URL in js/config.js with your API Gateway endpoint.\n' +
                'You can find this URL after deploying your backend with:\n' +
                '  npm run deploy\n\n' +
                'Example: https://abc123xyz.execute-api.us-east-1.amazonaws.com'
            );
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
