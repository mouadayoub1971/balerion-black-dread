/**
 * Main Application - Coordinates all modules and handles user interactions
 */

const App = {
    sessionId: null,
    isProcessing: false,

    /**
     * Initialize the application
     */
    init() {
        console.log('🤖 AI Chatbot initializing...');

        // Initialize modules
        ChatModule.init();
        ImageGenerator.init();

        // Get or create session ID
        this.sessionId = this.getOrCreateSessionId();
        this.updateSessionDisplay();

        // Set up event listeners
        this.setupEventListeners();

        // Load chat history
        this.loadHistory();

        // Display welcome message if configured
        if (CONFIG.UI.SHOW_WELCOME_SCREEN) {
            ChatModule.showWelcomeScreen();
        }

        // Update status
        this.updateStatus('connected', 'Connected');

        console.log('✅ AI Chatbot ready!');
        console.log('📝 Session ID:', this.sessionId);
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Send button click
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.handleSendMessage());
        }

        // New chat button
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.handleNewChat());
        }

        // Clear history button
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.handleClearHistory());
        }

        CONFIG.debug('Event listeners set up');
    },

    /**
     * Handle send message
     */
    async handleSendMessage() {
        if (this.isProcessing) {
            console.log('Already processing a message');
            return;
        }

        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) {
            this.showNotification(CONFIG.ERRORS.EMPTY_MESSAGE, 'warning');
            return;
        }

        // Check if API is configured
        if (!CONFIG.isApiConfigured()) {
            ChatModule.displayErrorMessage(CONFIG.ERRORS.API_NOT_CONFIGURED);
            this.showNotification(CONFIG.ERRORS.API_NOT_CONFIGURED, 'error');
            return;
        }

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Check if it's an image generation command
        const imageCommand = ImageGenerator.parseImageCommand(message);

        if (imageCommand.isImageCommand) {
            await this.handleImageGeneration(imageCommand.prompt);
        } else {
            await this.handleChatMessage(message);
        }
    },

    /**
     * Handle chat message
     * @param {string} message - User message
     */
    async handleChatMessage(message) {
        this.isProcessing = true;
        this.updateStatus('processing', 'Processing...');

        try {
            // Display user message
            ChatModule.displayUserMessage(message);

            // Show loading indicator
            ChatModule.showLoading();

            // Determine if we should use function calling
            const useFunctionCalling = ChatModule.shouldUseFunctionCalling(message);

            let response;
            if (useFunctionCalling) {
                CONFIG.debug('Using function calling for message');
                response = await ChatModule.sendFunctionCallMessage(message, this.sessionId);
            } else {
                CONFIG.debug('Using regular chat for message');
                response = await ChatModule.sendMessage(message, this.sessionId);
            }

            // Hide loading
            ChatModule.hideLoading();

            // Display AI response
            if (response && response.response) {
                ChatModule.displayAIMessage(
                    response.response,
                    response.functionCalled || null
                );
            } else {
                throw new Error(CONFIG.ERRORS.INVALID_RESPONSE);
            }

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error sending message:', error);
            ChatModule.hideLoading();
            ChatModule.displayErrorMessage(error.message || CONFIG.ERRORS.API_ERROR);
            this.showNotification(error.message || CONFIG.ERRORS.API_ERROR, 'error');
            this.updateStatus('error', 'Error');
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle image generation
     * @param {string} prompt - Image prompt
     */
    async handleImageGeneration(prompt) {
        if (!prompt) {
            this.showNotification('Please provide an image prompt', 'warning');
            return;
        }

        this.isProcessing = true;
        this.updateStatus('processing', 'Generating image...');

        try {
            // Display user request
            ChatModule.displayUserMessage(`/image ${prompt}`);

            // Show generating message
            ImageGenerator.displayGeneratingMessage(prompt);

            // Generate image
            const response = await ImageGenerator.generateImage(prompt, this.sessionId);

            // Remove generating message
            ImageGenerator.removeGeneratingMessage();

            // Display generated image
            if (response && response.imageUrl) {
                ImageGenerator.displayImageInChat(response.imageUrl, prompt);
                this.showNotification(CONFIG.SUCCESS.IMAGE_GENERATED, 'success');
            } else {
                throw new Error(CONFIG.ERRORS.INVALID_RESPONSE);
            }

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error generating image:', error);
            ImageGenerator.removeGeneratingMessage();
            ChatModule.displayErrorMessage(error.message || CONFIG.ERRORS.IMAGE_GENERATION_FAILED);
            this.showNotification(error.message || CONFIG.ERRORS.IMAGE_GENERATION_FAILED, 'error');
            this.updateStatus('error', 'Error');
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle new chat
     */
    handleNewChat() {
        if (confirm('Start a new chat? Current conversation will remain in history.')) {
            this.sessionId = this.generateSessionId();
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_ID, this.sessionId);
            this.updateSessionDisplay();
            ChatModule.clearMessages();
            this.showNotification(CONFIG.SUCCESS.SESSION_CREATED, 'success');
            console.log('📝 New session started:', this.sessionId);
        }
    },

    /**
     * Handle clear history
     */
    handleClearHistory() {
        if (confirm('Clear all messages? This cannot be undone.')) {
            ChatModule.clearMessages();
            this.showNotification('Messages cleared', 'success');
        }
    },

    /**
     * Load chat history
     */
    async loadHistory() {
        try {
            const history = await ChatModule.loadHistory(this.sessionId);

            if (history && history.length > 0) {
                CONFIG.debug('Loading history messages', history.length);
                ChatModule.hideWelcomeScreen();

                history.forEach(item => {
                    if (item.type === 'chat' || item.type === 'function_call') {
                        // Display user message
                        if (item.userMessage) {
                            const userMsg = ChatModule.createMessageElement({
                                type: 'user',
                                text: item.userMessage,
                                timestamp: new Date(item.timestamp)
                            });
                            ChatModule.messagesContainer.appendChild(userMsg);
                        }

                        // Display AI response
                        if (item.aiResponse) {
                            const aiMsg = ChatModule.createMessageElement({
                                type: 'ai',
                                text: item.aiResponse,
                                timestamp: new Date(item.timestamp),
                                functionCalled: item.functionCalled || null
                            });
                            ChatModule.messagesContainer.appendChild(aiMsg);
                        }
                    } else if (item.type === 'image') {
                        // Display image (Note: imageKey would need to be converted to URL)
                        const userMsg = ChatModule.createMessageElement({
                            type: 'user',
                            text: `/image ${item.prompt}`,
                            timestamp: new Date(item.timestamp)
                        });
                        ChatModule.messagesContainer.appendChild(userMsg);
                    }
                });

                ChatModule.scrollToBottom();
                console.log(`✅ Loaded ${history.length} history items`);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    },

    /**
     * Get or create session ID
     * @returns {string} Session ID
     */
    getOrCreateSessionId() {
        let sessionId = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_ID);

        if (!sessionId) {
            sessionId = this.generateSessionId();
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_ID, sessionId);
        }

        return sessionId;
    },

    /**
     * Generate a new session ID
     * @returns {string} New session ID
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Update session display
     */
    updateSessionDisplay() {
        const sessionIdElement = document.getElementById('sessionId');
        if (sessionIdElement) {
            // Show shortened session ID
            const shortId = this.sessionId.substring(0, 20) + '...';
            sessionIdElement.textContent = shortId;
            sessionIdElement.title = this.sessionId; // Full ID on hover
        }
    },

    /**
     * Update status indicator
     * @param {string} status - Status type (connected, disconnected, processing, error)
     * @param {string} text - Status text
     */
    updateStatus(status, text) {
        const statusDot = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        if (statusDot) {
            statusDot.className = 'status-dot';
            switch (status) {
                case 'connected':
                    statusDot.classList.add('status-connected');
                    break;
                case 'disconnected':
                case 'error':
                    statusDot.classList.add('status-disconnected');
                    break;
                case 'processing':
                    statusDot.style.background = '#f39c12';
                    break;
            }
        }

        if (statusText) {
            statusText.textContent = text;
        }
    },

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You can implement a toast notification system here
        // For now, just log to console
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Expose App globally for debugging
if (typeof window !== 'undefined') {
    window.App = App;
    window.ChatModule = ChatModule;
    window.ImageGenerator = ImageGenerator;
    window.CONFIG = CONFIG;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
