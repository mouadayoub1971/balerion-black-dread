/**
 * Chat Module - Handles all chat-related functionality
 */

const ChatModule = {
    /**
     * Initialize chat module
     */
    init() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.welcomeScreen = document.getElementById('welcomeScreen');

        // Auto-resize textarea
        if (this.messageInput) {
            this.messageInput.addEventListener('input', this.autoResizeTextarea.bind(this));
            this.messageInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        }

        CONFIG.debug('Chat module initialized');
    },

    /**
     * Send a chat message
     * @param {string} message - User message
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Response data
     */
    async sendMessage(message, sessionId) {
        if (!message || !message.trim()) {
            throw new Error(CONFIG.ERRORS.EMPTY_MESSAGE);
        }

        if (message.length > CONFIG.SETTINGS.MAX_MESSAGE_LENGTH) {
            throw new Error(CONFIG.ERRORS.MESSAGE_TOO_LONG);
        }

        if (!CONFIG.isApiConfigured()) {
            throw new Error(CONFIG.ERRORS.API_NOT_CONFIGURED);
        }

        const url = CONFIG.getApiUrl(CONFIG.ENDPOINTS.CHAT);
        CONFIG.debug('Sending chat message', { url, message, sessionId });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.SETTINGS.REQUEST_TIMEOUT);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message.trim(),
                    sessionId: sessionId
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            CONFIG.debug('Received chat response', data);

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please try again.');
            }
            throw error;
        }
    },

    /**
     * Send a message using function calling
     * @param {string} message - User message
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Response data
     */
    async sendFunctionCallMessage(message, sessionId) {
        if (!CONFIG.isApiConfigured()) {
            throw new Error(CONFIG.ERRORS.API_NOT_CONFIGURED);
        }

        const url = CONFIG.getApiUrl(CONFIG.ENDPOINTS.FUNCTION_CALL);
        CONFIG.debug('Sending function call message', { url, message, sessionId });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.SETTINGS.REQUEST_TIMEOUT);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message.trim(),
                    sessionId: sessionId
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            CONFIG.debug('Received function call response', data);

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please try again.');
            }
            throw error;
        }
    },

    /**
     * Load chat history
     * @param {string} sessionId - Session ID
     * @returns {Promise<Array>} History messages
     */
    async loadHistory(sessionId) {
        if (!CONFIG.isApiConfigured()) {
            CONFIG.debug('API not configured, skipping history load');
            return [];
        }

        const url = `${CONFIG.getApiUrl(CONFIG.ENDPOINTS.GET_HISTORY)}/${sessionId}`;
        CONFIG.debug('Loading history', { url, sessionId });

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    CONFIG.debug('No history found for session');
                    return [];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            CONFIG.debug('Loaded history', data);

            return data.messages || [];
        } catch (error) {
            console.error('Failed to load history:', error);
            return [];
        }
    },

    /**
     * Display a user message
     * @param {string} message - Message text
     */
    displayUserMessage(message) {
        this.hideWelcomeScreen();

        const messageDiv = this.createMessageElement({
            type: 'user',
            text: message,
            timestamp: new Date()
        });

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    },

    /**
     * Display an AI message
     * @param {string} message - Message text
     * @param {string} functionCalled - Function that was called (optional)
     */
    displayAIMessage(message, functionCalled = null) {
        this.hideWelcomeScreen();

        const messageDiv = this.createMessageElement({
            type: 'ai',
            text: message,
            timestamp: new Date(),
            functionCalled: functionCalled
        });

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    },

    /**
     * Display an error message
     * @param {string} errorMessage - Error message
     */
    displayErrorMessage(errorMessage) {
        this.hideWelcomeScreen();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">❌</div>
            <div class="message-content">
                <div class="message-bubble" style="background: #fee; color: #c00;">
                    <strong>Error:</strong> ${this.escapeHtml(errorMessage)}
                </div>
                <small class="message-time">${this.formatTime(new Date())}</small>
            </div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    },

    /**
     * Create a message element
     * @param {Object} options - Message options
     * @returns {HTMLElement} Message element
     */
    createMessageElement({ type, text, timestamp, functionCalled = null }) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        const avatar = type === 'user' ? '👤' : '🤖';
        const escapedText = this.escapeHtml(text);
        const formattedText = this.formatText(escapedText);

        let functionInfo = '';
        if (functionCalled) {
            const functionIcons = {
                'get_weather': '🌤️',
                'calculate': '🧮',
                'search_web': '🔍'
            };
            const icon = functionIcons[functionCalled] || '🛠️';
            functionInfo = `<div class="message-function">${icon} Used: ${functionCalled}</div>`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble">${formattedText}</div>
                ${functionInfo}
                <small class="message-time">${this.formatTime(timestamp)}</small>
            </div>
        `;

        return messageDiv;
    },

    /**
     * Format text with basic markdown support
     * @param {string} text - Text to format
     * @returns {string} Formatted HTML
     */
    formatText(text) {
        // Convert line breaks to <br>
        let formatted = text.replace(/\n/g, '<br>');

        // Bold: **text**
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Code: `code`
        formatted = formatted.replace(/`(.+?)`/g, '<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px;">$1</code>');

        return formatted;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Format timestamp
     * @param {Date} date - Date object
     * @returns {string} Formatted time
     */
    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Show loading indicator
     */
    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
            this.scrollToBottom();
        }
    },

    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    },

    /**
     * Hide welcome screen
     */
    hideWelcomeScreen() {
        if (this.welcomeScreen && this.welcomeScreen.style.display !== 'none') {
            this.welcomeScreen.style.display = 'none';
        }
    },

    /**
     * Show welcome screen
     */
    showWelcomeScreen() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'flex';
        }
    },

    /**
     * Clear all messages
     */
    clearMessages() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
        this.showWelcomeScreen();
    },

    /**
     * Scroll to bottom of messages
     */
    scrollToBottom() {
        if (CONFIG.SETTINGS.AUTO_SCROLL && this.messagesContainer) {
            setTimeout(() => {
                this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            }, 100);
        }
    },

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea() {
        if (this.messageInput) {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        }
    },

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        // Send message on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.sendBtn) {
                this.sendBtn.click();
            }
        }
    },

    /**
     * Detect if message should use function calling
     * @param {string} message - Message text
     * @returns {boolean}
     */
    shouldUseFunctionCalling(message) {
        const lowerMessage = message.toLowerCase();

        // Keywords that trigger function calling
        const functionKeywords = [
            'weather', 'temperature', 'forecast',
            'calculate', 'compute', 'math', 'solve',
            'search', 'find', 'look up', 'google'
        ];

        return functionKeywords.some(keyword => lowerMessage.includes(keyword));
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatModule;
}
