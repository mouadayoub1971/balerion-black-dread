// Audio Processor Module - Handle voice recording and processing

const AudioProcessorModule = {
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    stream: null,

    /**
     * Initialize audio recording
     * @returns {Promise<boolean>} - Success status
     */
    async initializeRecording() {
        try {
            // Check if running on HTTPS or localhost
            const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

            if (!isSecureContext) {
                throw new Error('Voice input requires HTTPS. Please use:\n1. CloudFront with SSL, or\n2. Run locally: python -m http.server 8000');
            }

            // Check if mediaDevices API is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support audio recording. Please use a modern browser (Chrome, Firefox, Edge).');
            }

            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Create MediaRecorder with webm format (widely supported)
            const options = { mimeType: 'audio/webm' };

            // Fallback to other formats if webm not supported
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn('audio/webm not supported, trying alternatives');
                if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options.mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                    options.mimeType = 'audio/ogg';
                } else {
                    options.mimeType = ''; // Use default
                }
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.audioChunks = [];

            // Collect audio data
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            console.log('🎤 Audio recording initialized with format:', this.mediaRecorder.mimeType);
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize recording:', error);
            alert('Could not access microphone. Please grant microphone permissions.');
            return false;
        }
    },

    /**
     * Start recording
     * @returns {Promise<boolean>} - Success status
     */
    async startRecording() {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        // Initialize if not already done
        if (!this.mediaRecorder) {
            const initialized = await this.initializeRecording();
            if (!initialized) return false;
        }

        this.audioChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;

        console.log('🎤 Recording started');
        return true;
    },

    /**
     * Stop recording and return audio blob
     * @returns {Promise<{blob: Blob, mimeType: string}>}
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording || !this.mediaRecorder) {
                reject(new Error('Not recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.isRecording = false;

                console.log(`🎤 Recording stopped. Size: ${audioBlob.size} bytes, Type: ${mimeType}`);

                resolve({ blob: audioBlob, mimeType });
            };

            this.mediaRecorder.stop();
        });
    },

    /**
     * Cancel recording
     */
    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.audioChunks = [];
            console.log('🎤 Recording cancelled');
        }
    },

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    },

    /**
     * Convert audio blob to base64
     * @param {Blob} blob - Audio blob
     * @returns {Promise<string>} - Base64 string
     */
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Process audio - send to backend for transcription and response
     * @param {string} audioBase64 - Base64 encoded audio
     * @param {string} mimeType - MIME type of audio
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} - Processing response with audioId
     */
    async processAudio(audioBase64, mimeType, sessionId) {
        console.log(`🎤 Processing audio (${audioBase64.length} chars, ${mimeType})`);

        const response = await fetch(`${CONFIG.API_BASE_URL}/process-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioBase64: audioBase64,
                mimeType: mimeType,
                sessionId: sessionId,
                filename: `voice-${Date.now()}.${mimeType.split('/')[1]}`
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Audio processing failed');
        }

        return await response.json();
    },

    /**
     * Check audio processing status
     * @param {string} audioId - Audio processing ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<object>} - Status response
     */
    async checkStatus(audioId, sessionId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/process-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                checkStatus: true,
                audioId: audioId,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Status check failed');
        }

        return await response.json();
    },

    /**
     * Poll for audio processing completion
     * @param {string} audioId - Audio processing ID
     * @param {string} sessionId - Session ID
     * @param {function} onUpdate - Callback for status updates
     * @returns {Promise<object>} - Final response
     */
    async pollForCompletion(audioId, sessionId, onUpdate) {
        const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
        let attempts = 0;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            const status = await this.checkStatus(audioId, sessionId);

            if (onUpdate) {
                onUpdate(status);
            }

            if (status.status === 'completed') {
                return status;
            }

            if (status.status === 'failed') {
                throw new Error(status.error || 'Audio processing failed');
            }

            attempts++;
        }

        throw new Error('Audio processing timed out');
    },

    /**
     * Display voice input processing status
     * @param {string} status - Status message
     */
    displayProcessingStatus(status) {
        const messagesContainer = document.getElementById('messagesContainer');

        // Remove previous processing message if exists
        const existingProcessing = messagesContainer.querySelector('.voice-processing-message');
        if (existingProcessing) {
            existingProcessing.remove();
        }

        // Create processing message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message voice-processing-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `<div class="processing-indicator">🎤 ${this.escapeHtml(status)}</div>`;

        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Display voice transcription and AI response
     * @param {object} data - Response data
     */
    displayVoiceResponse(data) {
        const messagesContainer = document.getElementById('messagesContainer');

        // Remove processing message
        const processingMsg = messagesContainer.querySelector('.voice-processing-message');
        if (processingMsg) {
            processingMsg.remove();
        }

        // Create AI response message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message voice-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add voice indicator
        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        indicator.innerHTML = '🎤 Voice Input';
        contentDiv.appendChild(indicator);

        // Add AI response
        const responseText = document.createElement('div');
        responseText.className = 'voice-response-text';
        responseText.innerHTML = this.formatResponse(data.aiResponse);
        contentDiv.appendChild(responseText);

        // Add timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(data.timestamp);

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        messagesContainer.appendChild(messageDiv);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Format response text
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
     * Escape HTML
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
window.AudioProcessorModule = AudioProcessorModule;
