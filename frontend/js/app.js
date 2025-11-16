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

        // Initialize theme
        this.setupTheme();

        // Initialize modules
        ChatModule.init();
        ImageGenerator.init();
        // DocumentProcessor doesn't need initialization

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

        // Upload PDF button
        const uploadPdfBtn = document.getElementById('uploadPdfBtn');
        if (uploadPdfBtn) {
            uploadPdfBtn.addEventListener('click', () => this.handleDocumentProcessing());
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

        // Theme toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Message input - Enter to send (with Shift+Enter for new line)
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });

            // Auto-resize textarea
            messageInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            });
        }

        // Quick prompt chips
        const promptChips = document.querySelectorAll('.prompt-chip');
        promptChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                if (prompt && messageInput) {
                    messageInput.value = prompt;
                    messageInput.focus();
                    this.handleSendMessage();
                }
            });
        });

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

        // Check if it's a web search command
        const searchCommand = WebSearchModule.parseSearchCommand(message);
        if (searchCommand) {
            await this.handleWebSearch(searchCommand.query);
            return;
        }

        // Check if it's a maps search command
        const mapsCommand = MapsSearchModule.parseMapsCommand(message);
        if (mapsCommand) {
            await this.handleMapsSearch(mapsCommand.query);
            return;
        }

        // Check if it's a teacher command (document processing)
        if (DocumentProcessor.isTeacherCommand(message)) {
            await this.handleDocumentProcessing();
            return;
        }

        // Check if it's a video generation command
        const videoCommand = VideoGenerator.parseVideoCommand(message);
        if (videoCommand.isVideoCommand) {
            await this.handleVideoGeneration(videoCommand.prompt);
            return;
        }

        // Check if it's an image generation command
        const imageCommand = ImageGenerator.parseImageCommand(message);
        if (imageCommand.isImageCommand) {
            await this.handleImageGeneration(imageCommand.prompt);
            return;
        }

        // Otherwise, handle as regular chat message
        await this.handleChatMessage(message);
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

            // Use regular chat (function calling disabled for now)
            CONFIG.debug('Using regular chat for message');
            const response = await ChatModule.sendMessage(message, this.sessionId);

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
     * Handle video generation
     * @param {string} prompt - Video prompt
     */
    async handleVideoGeneration(prompt) {
        if (!prompt) {
            this.showNotification('Please provide a video prompt', 'warning');
            return;
        }

        this.isProcessing = true;
        this.updateStatus('processing', 'Generating video (2-10 min)...');

        const messagesContainer = document.getElementById('messagesContainer');

        try {
            // Display user request
            ChatModule.displayUserMessage(`/video ${prompt}`);

            // Show generating message
            VideoGenerator.showGeneratingMessage(messagesContainer);

            // Generate video
            const response = await VideoGenerator.generateVideo(prompt, this.sessionId);

            // Remove generating message
            VideoGenerator.removeGeneratingMessage(messagesContainer);

            // Display generated video
            if (response && response.videoUrl) {
                VideoGenerator.displayVideoMessage(response, messagesContainer);
                this.showNotification(CONFIG.SUCCESS.VIDEO_GENERATED, 'success');
            } else {
                throw new Error('Please check your connection or you may have hit API rate limits. Try again later.');
            }

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error generating video:', error);
            VideoGenerator.removeGeneratingMessage(messagesContainer);

            // Create a user-friendly error message
            let errorMessage = error.message;

            // Check for common error patterns
            if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = '⚠️ You\'ve hit the API rate limit. Please try again later or upgrade your plan.';
            } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
                errorMessage = '⏱️ Video generation timed out. This usually means the request is taking longer than expected.';
            } else if (errorMessage.includes('Network') || errorMessage.includes('connection') || errorMessage.includes('INVALID_RESPONSE')) {
                errorMessage = '🌐 Please check your internet connection or try again later.';
            } else if (!errorMessage || errorMessage === 'Failed to generate video') {
                errorMessage = '❌ Video generation failed. Please check your connection or you may have hit API rate limits.';
            }

            VideoGenerator.showErrorMessage(errorMessage, messagesContainer);
            this.showNotification(errorMessage, 'error');
            this.updateStatus('error', 'Error');
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle document processing (teacher mode)
     */
    async handleDocumentProcessing() {
        if (this.isProcessing) {
            console.log('Already processing a request');
            return;
        }

        const messagesContainer = document.getElementById('messagesContainer');
        let processingMessage = null;

        try {
            // Show file upload dialog and get file data
            const fileData = await DocumentProcessor.showFileUploadDialog();

            // Now set processing state after file is selected
            this.isProcessing = true;
            this.updateStatus('processing', 'Processing document...');

            // Display user command
            ChatModule.displayUserMessage(`/teacher ${fileData.filename} (${fileData.action})`);

            // Show processing message
            processingMessage = DocumentProcessor.showProcessingMessage(messagesContainer);

            // Process document
            const response = await DocumentProcessor.processDocument(
                fileData.pdfBase64,
                fileData.action,
                fileData.prompt,
                this.sessionId,
                fileData.filename
            );

            // Display response
            DocumentProcessor.displayDocumentResponse(response, messagesContainer, processingMessage);
            this.showNotification(CONFIG.SUCCESS.DOCUMENT_PROCESSED, 'success');

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error processing document:', error);

            // Only show error if it's not a cancellation
            if (!error.message.includes('cancel')) {
                DocumentProcessor.showErrorMessage(error, messagesContainer, processingMessage);
                this.showNotification(error.message || CONFIG.ERRORS.DOCUMENT_PROCESSING_FAILED, 'error');
                this.updateStatus('error', 'Error');
            } else {
                // User cancelled, just reset status
                this.updateStatus('connected', 'Connected');
            }
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle web search
     * @param {string} query - Search query
     */
    async handleWebSearch(query) {
        if (!query) {
            this.showNotification('Please provide a search query', 'warning');
            return;
        }

        this.isProcessing = true;
        this.updateStatus('processing', 'Searching...');

        try {
            // Display user command
            ChatModule.displayUserMessage(`/search ${query}`);

            // Show loading indicator
            ChatModule.showLoading();

            // Perform web search
            const response = await WebSearchModule.performSearch(query, this.sessionId);

            // Hide loading
            ChatModule.hideLoading();

            // Display search results
            if (response && response.response) {
                WebSearchModule.displaySearchResults(response);
                this.showNotification(CONFIG.SUCCESS.WEB_SEARCH_COMPLETED, 'success');
            } else {
                throw new Error(CONFIG.ERRORS.INVALID_RESPONSE);
            }

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error performing web search:', error);
            ChatModule.hideLoading();
            ChatModule.displayErrorMessage(error.message || CONFIG.ERRORS.WEB_SEARCH_FAILED);
            this.showNotification(error.message || CONFIG.ERRORS.WEB_SEARCH_FAILED, 'error');
            this.updateStatus('error', 'Error');
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle maps search
     * @param {string} query - Search query
     */
    async handleMapsSearch(query) {
        if (!query) {
            this.showNotification('Please provide a search query', 'warning');
            return;
        }

        this.isProcessing = true;
        this.updateStatus('processing', 'Searching maps...');

        try {
            // Display user command
            ChatModule.displayUserMessage(`/maps ${query}`);

            // Show loading indicator
            ChatModule.showLoading();

            // Get user location (will return null if permission denied)
            const location = await MapsSearchModule.getUserLocation();

            // Perform maps search
            const response = await MapsSearchModule.performMapsSearch(query, location, this.sessionId);

            // Hide loading
            ChatModule.hideLoading();

            // Display maps results
            if (response && response.response) {
                MapsSearchModule.displayMapsResults(response);
                this.showNotification(CONFIG.SUCCESS.MAPS_SEARCH_COMPLETED, 'success');
            } else {
                throw new Error(CONFIG.ERRORS.INVALID_RESPONSE);
            }

            this.updateStatus('connected', 'Connected');
        } catch (error) {
            console.error('Error performing maps search:', error);
            ChatModule.hideLoading();
            ChatModule.displayErrorMessage(error.message || CONFIG.ERRORS.MAPS_SEARCH_FAILED);
            this.showNotification(error.message || CONFIG.ERRORS.MAPS_SEARCH_FAILED, 'error');
            this.updateStatus('error', 'Error');
        } finally {
            this.isProcessing = false;
        }
    },

    /**
     * Handle new chat
     */
    handleNewChat() {
        this.showNewChatModal();
    },

    /**
     * Show new chat confirmation modal
     */
    showNewChatModal() {
        const modal = document.getElementById('newChatModal');
        const confirmBtn = document.getElementById('confirmNewChat');
        const cancelBtn = document.getElementById('cancelNewChat');
        const overlay = modal.querySelector('.new-chat-overlay');

        if (!modal) return;

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Handle confirm
        const handleConfirm = () => {
            this.startNewSession();
            this.closeNewChatModal();
        };

        // Handle cancel
        const handleCancel = () => {
            this.closeNewChatModal();
        };

        // Add event listeners
        confirmBtn.addEventListener('click', handleConfirm, { once: true });
        cancelBtn.addEventListener('click', handleCancel, { once: true });
        overlay.addEventListener('click', handleCancel, { once: true });

        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeNewChatModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    /**
     * Close new chat modal
     */
    closeNewChatModal() {
        const modal = document.getElementById('newChatModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    /**
     * Start new session
     */
    startNewSession() {
        this.sessionId = this.generateSessionId();
        localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_ID, this.sessionId);
        this.updateSessionDisplay();
        ChatModule.clearMessages();
        this.showNotification(CONFIG.SUCCESS.SESSION_CREATED, 'success');
        console.log('📝 New session started:', this.sessionId);
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
     * Set up theme system
     */
    setupTheme() {
        // Load saved theme or default to light
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.className = savedTheme;

        CONFIG.debug('Theme initialized:', savedTheme);
    },

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.className;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        html.className = newTheme;
        localStorage.setItem('theme', newTheme);

        console.log(`🎨 Theme switched to: ${newTheme}`);
        CONFIG.debug('Theme changed to', newTheme);
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
    window.DocumentProcessor = DocumentProcessor;
    window.CONFIG = CONFIG;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
