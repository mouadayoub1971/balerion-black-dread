/**
 * Image Generator Module - Handles image generation functionality
 */

const ImageGenerator = {
    /**
     * Initialize image generator module
     */
    init() {
        this.modal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.modalCaption = document.getElementById('modalCaption');
        this.modalClose = document.querySelector('.modal-close');

        // Set up modal close handlers
        if (this.modalClose) {
            this.modalClose.addEventListener('click', () => this.closeModal());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        // Keyboard shortcut to close modal (Escape key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.closeModal();
            }
        });

        CONFIG.debug('Image generator module initialized');
    },

    /**
     * Generate an image
     * @param {string} prompt - Image generation prompt
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Response data with image URL
     */
    async generateImage(prompt, sessionId) {
        if (!prompt || !prompt.trim()) {
            throw new Error('Please provide an image prompt');
        }

        if (prompt.length > CONFIG.IMAGE.MAX_PROMPT_LENGTH) {
            throw new Error(`Prompt is too long. Maximum ${CONFIG.IMAGE.MAX_PROMPT_LENGTH} characters.`);
        }

        if (!CONFIG.isApiConfigured()) {
            throw new Error(CONFIG.ERRORS.API_NOT_CONFIGURED);
        }

        const url = CONFIG.getApiUrl(CONFIG.ENDPOINTS.GENERATE_IMAGE);
        CONFIG.debug('Generating image', { url, prompt, sessionId });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.SETTINGS.REQUEST_TIMEOUT);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    sessionId: sessionId
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            CONFIG.debug('Image generated successfully', data);

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Image generation timeout. Please try again.');
            }
            throw error;
        }
    },

    /**
     * Display generated image in chat
     * @param {string} imageUrl - Image URL
     * @param {string} prompt - Original prompt
     */
    displayImageInChat(imageUrl, prompt) {
        ChatModule.hideWelcomeScreen();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';

        messageDiv.innerHTML = `
            <div class="message-avatar">🎨</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p><strong>Generated Image:</strong></p>
                    <p style="color: #666; font-size: 0.9em; margin: 0.5em 0;">Prompt: "${this.escapeHtml(prompt)}"</p>
                    <img src="${imageUrl}"
                         alt="${this.escapeHtml(prompt)}"
                         class="message-image"
                         onclick="ImageGenerator.openModal('${imageUrl}', '${this.escapeHtml(prompt)}')">
                    <p style="font-size: 0.85em; color: #888; margin-top: 0.5em;">Click to view full size</p>
                </div>
                <small class="message-time">${this.formatTime(new Date())}</small>
            </div>
        `;

        ChatModule.messagesContainer.appendChild(messageDiv);
        ChatModule.scrollToBottom();
    },

    /**
     * Display image generation progress
     * @param {string} prompt - Image prompt
     */
    displayGeneratingMessage(prompt) {
        ChatModule.hideWelcomeScreen();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message generating-message';
        messageDiv.id = 'generatingMessage';

        messageDiv.innerHTML = `
            <div class="message-avatar">🎨</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p><strong>Generating image...</strong></p>
                    <p style="color: #666; font-size: 0.9em;">Prompt: "${this.escapeHtml(prompt)}"</p>
                    <div class="loading-dots" style="margin-top: 10px;">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p style="font-size: 0.85em; color: #888; margin-top: 0.5em;">This may take 10-30 seconds...</p>
                </div>
            </div>
        `;

        ChatModule.messagesContainer.appendChild(messageDiv);
        ChatModule.scrollToBottom();
    },

    /**
     * Remove generating message
     */
    removeGeneratingMessage() {
        const generatingMsg = document.getElementById('generatingMessage');
        if (generatingMsg) {
            generatingMsg.remove();
        }
    },

    /**
     * Open image modal for full view
     * @param {string} imageUrl - Image URL
     * @param {string} caption - Image caption
     */
    openModal(imageUrl, caption) {
        if (this.modal && this.modalImage && this.modalCaption) {
            this.modalImage.src = imageUrl;
            this.modalCaption.textContent = caption;
            this.modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            CONFIG.debug('Modal opened', { imageUrl, caption });
        }
    },

    /**
     * Close image modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            CONFIG.debug('Modal closed');
        }
    },

    /**
     * Check if message is an image generation command
     * @param {string} message - Message text
     * @returns {Object|null} { isImageCommand: boolean, prompt: string }
     */
    parseImageCommand(message) {
        const trimmed = message.trim();
        const lowerMessage = trimmed.toLowerCase();

        // Check for /image or /img command
        if (lowerMessage.startsWith(CONFIG.IMAGE.COMMAND_PREFIX + ' ')) {
            return {
                isImageCommand: true,
                prompt: trimmed.substring(CONFIG.IMAGE.COMMAND_PREFIX.length + 1).trim()
            };
        }

        if (lowerMessage.startsWith(CONFIG.IMAGE.ALT_COMMAND_PREFIX + ' ')) {
            return {
                isImageCommand: true,
                prompt: trimmed.substring(CONFIG.IMAGE.ALT_COMMAND_PREFIX.length + 1).trim()
            };
        }

        return {
            isImageCommand: false,
            prompt: null
        };
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
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageGenerator;
}
