// Maps Search Module - Handle /maps commands with Google Maps grounding

const MapsSearchModule = {
    /**
     * Parse maps command
     * @param {string} message - User message
     * @returns {object|null} - { query } or null
     */
    parseMapsCommand(message) {
        const trimmed = message.trim();

        if (!trimmed.startsWith('/maps ')) {
            return null;
        }

        const query = trimmed.substring(6).trim(); // Remove "/maps "

        if (!query) {
            return null;
        }

        return { query };
    },

    /**
     * Get user's current location using browser Geolocation API
     * @returns {Promise<{latitude: number, longitude: number}>}
     */
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.warn('⚠️ Geolocation not supported by browser');
                resolve({ latitude: null, longitude: null });
                return;
            }

            console.log('📍 Requesting user location...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    console.log(`📍 Got location: ${coords.latitude}, ${coords.longitude}`);
                    resolve(coords);
                },
                (error) => {
                    console.warn('⚠️ Location permission denied or unavailable:', error.message);
                    // Continue without location - Gemini will use general results
                    resolve({ latitude: null, longitude: null });
                },
                {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 300000 // Cache for 5 minutes
                }
            );
        });
    },

    /**
     * Perform maps search
     * @param {string} query - Search query
     * @param {object} location - { latitude, longitude }
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} - API response
     */
    async performMapsSearch(query, location, sessionId) {
        console.log(`🗺️ Performing maps search: ${query}`);

        const requestBody = {
            query: query,
            sessionId: sessionId
        };

        // Add location if available
        if (location.latitude !== null && location.longitude !== null) {
            requestBody.latitude = location.latitude;
            requestBody.longitude = location.longitude;
            console.log(`📍 Using location: ${location.latitude}, ${location.longitude}`);
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/maps-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Maps search failed');
        }

        return await response.json();
    },

    /**
     * Display maps search results in chat
     * @param {object} data - API response data
     */
    displayMapsResults(data) {
        const messagesContainer = document.getElementById('messagesContainer');

        // Create message wrapper
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message maps-message';

        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add maps query indicator
        const queryIndicator = document.createElement('div');
        queryIndicator.className = 'maps-query-indicator';
        queryIndicator.innerHTML = `🗺️ Maps: <strong>${this.escapeHtml(data.query)}</strong>`;
        contentDiv.appendChild(queryIndicator);

        // Add AI response
        const responseText = document.createElement('div');
        responseText.className = 'maps-response-text';
        responseText.innerHTML = this.formatResponse(data.response);
        contentDiv.appendChild(responseText);

        // Add map sources if available
        if (data.sources && data.sources.length > 0) {
            this.addMapSources(contentDiv, data.sources);
        }

        // Add timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(data.timestamp);

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Add map place sources to message
     * @param {HTMLElement} container - Container element
     * @param {Array} sources - Array of map sources
     */
    addMapSources(container, sources) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'maps-sources';
        sourcesDiv.innerHTML = '<div class="sources-label">📍 Places:</div>';

        const sourcesList = document.createElement('ul');
        sourcesList.className = 'maps-list';

        sources.forEach((source) => {
            const sourceItem = document.createElement('li');
            sourceItem.className = 'map-item';

            const link = document.createElement('a');
            link.href = source.uri;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = source.title;

            sourceItem.appendChild(link);
            sourcesList.appendChild(sourceItem);
        });

        sourcesDiv.appendChild(sourcesList);
        container.appendChild(sourcesDiv);
    },

    /**
     * Format response text (preserve line breaks, add markdown-like formatting)
     * @param {string} text - Response text
     * @returns {string} - Formatted HTML
     */
    formatResponse(text) {
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Format timestamp
     * @param {number} timestamp - Unix timestamp
     * @returns {string} - Formatted time
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Make module globally available
window.MapsSearchModule = MapsSearchModule;
