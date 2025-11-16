// Web Search Module - Handle /search commands with Google Search grounding

const WebSearchModule = {
    /**
     * Parse search command
     * @param {string} message - User message
     * @returns {object|null} - { query } or null
     */
    parseSearchCommand(message) {
        const trimmed = message.trim();

        if (!trimmed.startsWith('/search ')) {
            return null;
        }

        const query = trimmed.substring(8).trim(); // Remove "/search "

        if (!query) {
            return null;
        }

        return { query };
    },

    /**
     * Perform web search
     * @param {string} query - Search query
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} - API response
     */
    async performSearch(query, sessionId) {
        console.log(`🔍 Performing web search: ${query}`);

        const response = await fetch(`${CONFIG.API_BASE_URL}/web-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Web search failed');
        }

        return await response.json();
    },

    /**
     * Display search results in chat
     * @param {object} data - API response data
     */
    displaySearchResults(data) {
        const messagesContainer = document.getElementById('messagesContainer');

        // Create message wrapper
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message search-message';

        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add search query indicator
        const queryIndicator = document.createElement('div');
        queryIndicator.className = 'search-query-indicator';
        queryIndicator.innerHTML = `🔍 Search: <strong>${this.escapeHtml(data.query)}</strong>`;
        contentDiv.appendChild(queryIndicator);

        // Add AI response
        const responseText = document.createElement('div');
        responseText.className = 'search-response-text';
        responseText.innerHTML = this.formatResponse(data.response);
        contentDiv.appendChild(responseText);

        // Add grounding metadata if available
        if (data.groundingMetadata) {
            this.addGroundingInfo(contentDiv, data.groundingMetadata);
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
     * Add grounding information to message
     * @param {HTMLElement} container - Container element
     * @param {object} groundingMetadata - Grounding metadata from Gemini
     */
    addGroundingInfo(container, groundingMetadata) {
        if (!groundingMetadata.groundingChunks || groundingMetadata.groundingChunks.length === 0) {
            return;
        }

        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'search-sources';
        sourcesDiv.innerHTML = '<div class="sources-label">📚 Sources:</div>';

        const sourcesList = document.createElement('ul');
        sourcesList.className = 'sources-list';

        groundingMetadata.groundingChunks.forEach((chunk, index) => {
            if (chunk.web) {
                const sourceItem = document.createElement('li');
                sourceItem.className = 'source-item';

                const link = document.createElement('a');
                link.href = chunk.web.uri;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = chunk.web.title || chunk.web.uri;

                sourceItem.appendChild(link);
                sourcesList.appendChild(sourceItem);
            }
        });

        if (sourcesList.children.length > 0) {
            sourcesDiv.appendChild(sourcesList);
            container.appendChild(sourcesDiv);
        }
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
window.WebSearchModule = WebSearchModule;
