/**
 * Video Generator Module
 * Handles video generation using Google Veo 3.1 API
 */

const VideoGenerator = {
    /**
     * Parse video command from message
     * @param {string} message - User message
     * @returns {Object} - { isVideoCommand: boolean, prompt: string }
     */
    parseVideoCommand(message) {
        const trimmed = message.trim();
        const lowerMessage = trimmed.toLowerCase();

        if (lowerMessage.startsWith(CONFIG.VIDEO.COMMAND_PREFIX + ' ')) {
            return {
                isVideoCommand: true,
                prompt: trimmed.substring(CONFIG.VIDEO.COMMAND_PREFIX.length + 1).trim()
            };
        }

        return { isVideoCommand: false, prompt: '' };
    },

    /**
     * Generate video from prompt
     * @param {string} prompt - Video generation prompt
     * @param {string} sessionId - Current session ID
     * @returns {Promise<Object>} - Video generation response
     */
    async generateVideo(prompt, sessionId) {
        if (!prompt || prompt.trim() === '') {
            throw new Error('Video prompt cannot be empty');
        }

        if (!CONFIG.isApiConfigured()) {
            throw new Error('API is not configured. Please check config.js');
        }

        console.log('🎬 Generating video with prompt:', prompt);

        try {
            // Step 1: Initiate video generation
            const initiateResponse = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GENERATE_VIDEO}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    sessionId: sessionId
                })
            });

            if (!initiateResponse.ok) {
                const errorData = await initiateResponse.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${initiateResponse.status}`);
            }

            const initiateData = await initiateResponse.json();
            console.log('📝 Video generation initiated:', initiateData);

            if (initiateData.status !== 'processing') {
                throw new Error('Unexpected response status: ' + initiateData.status);
            }

            const videoId = initiateData.videoId;

            // Step 2: Poll for completion (every 10 seconds, max 15 minutes = 90 attempts)
            for (let i = 0; i < 90; i++) {
                // Wait 10 seconds before polling
                await new Promise(resolve => setTimeout(resolve, 10000));

                console.log(`📊 Polling status (attempt ${i + 1}/90)...`);

                const statusResponse = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GENERATE_VIDEO}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        checkStatus: true,
                        videoId: videoId,
                        sessionId: sessionId
                    })
                });

                if (!statusResponse.ok) {
                    console.warn('Status check failed, will retry...');
                    continue;
                }

                const statusData = await statusResponse.json();
                console.log('📊 Status:', statusData.status);

                if (statusData.status === 'completed') {
                    console.log('✅ Video generation complete!');
                    return {
                        videoUrl: statusData.videoUrl,
                        filename: statusData.filename,
                        prompt: prompt,
                        duration: statusData.duration || 6,
                        timestamp: statusData.timestamp,
                        sessionId: statusData.sessionId
                    };
                } else if (statusData.status === 'failed') {
                    throw new Error(statusData.error || 'Video generation failed');
                }

                // Status is still 'processing', continue polling
            }

            throw new Error('Video generation timed out after 15 minutes');

        } catch (error) {
            console.error('❌ Video generation error:', error);
            throw error;
        }
    },

    /**
     * Display video message in chat
     * @param {Object} videoData - Video response data
     * @param {HTMLElement} container - Messages container element
     */
    displayVideoMessage(videoData, container) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message video-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Video title
        const videoTitle = document.createElement('div');
        videoTitle.className = 'video-title';
        videoTitle.innerHTML = '🎬 Generated Video';
        contentDiv.appendChild(videoTitle);

        // Video player
        const videoElement = document.createElement('video');
        videoElement.className = 'generated-video';
        videoElement.src = videoData.videoUrl;
        videoElement.controls = true;
        videoElement.preload = 'metadata';

        // Add error handling
        videoElement.onerror = () => {
            console.error('Failed to load video');
            videoElement.parentElement.innerHTML = '<p class="error-message">❌ Failed to load video. The link may have expired.</p>';
        };

        contentDiv.appendChild(videoElement);

        // Video caption with prompt
        const caption = document.createElement('p');
        caption.className = 'video-caption';
        caption.textContent = `Prompt: "${videoData.prompt}"`;
        contentDiv.appendChild(caption);

        // Duration info
        if (videoData.duration) {
            const durationInfo = document.createElement('p');
            durationInfo.className = 'video-duration';
            durationInfo.textContent = `Duration: ${videoData.duration}s`;
            contentDiv.appendChild(durationInfo);
        }

        messageDiv.appendChild(contentDiv);

        // Timestamp
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        const timestamp = videoData.timestamp || Date.now();
        timeDiv.textContent = new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        messageDiv.appendChild(timeDiv);

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        console.log('✅ Video message displayed');
    },

    /**
     * Show video generation progress message
     * @param {HTMLElement} container - Messages container element
     * @returns {HTMLElement} - Progress message element
     */
    showGeneratingMessage(container) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message generating-message';
        messageDiv.id = 'generatingVideoMessage';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const generatingText = document.createElement('p');
        generatingText.innerHTML = '🎬 Generating video<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>';
        contentDiv.appendChild(generatingText);

        const estimateText = document.createElement('p');
        estimateText.className = 'estimate-text';
        estimateText.textContent = 'This may take 2-10 minutes. Please wait...';
        contentDiv.appendChild(estimateText);

        // Progress indicator
        const progressBar = document.createElement('div');
        progressBar.className = 'video-progress-bar';
        progressBar.innerHTML = '<div class="video-progress-fill"></div>';
        contentDiv.appendChild(progressBar);

        messageDiv.appendChild(contentDiv);

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // Animate progress bar (fake progress for UX)
        this.animateProgress(progressBar.querySelector('.video-progress-fill'));

        console.log('📊 Showing video generation progress');
        return messageDiv;
    },

    /**
     * Animate progress bar
     * @param {HTMLElement} progressFill - Progress fill element
     */
    animateProgress(progressFill) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 2; // Random increment
            if (progress > 90) progress = 90; // Cap at 90% until done
            progressFill.style.width = `${progress}%`;
        }, 1000);

        // Store interval ID to clear later
        progressFill.dataset.intervalId = interval;
    },

    /**
     * Remove generating message
     * @param {HTMLElement} container - Messages container element
     */
    removeGeneratingMessage(container) {
        const generatingMsg = container.querySelector('#generatingVideoMessage');
        if (generatingMsg) {
            // Clear progress animation
            const progressFill = generatingMsg.querySelector('.video-progress-fill');
            if (progressFill && progressFill.dataset.intervalId) {
                clearInterval(Number(progressFill.dataset.intervalId));
            }
            generatingMsg.remove();
            console.log('✅ Removed video generation progress message');
        }
    },

    /**
     * Show error message
     * @param {string} error - Error message
     * @param {HTMLElement} container - Messages container element
     */
    showErrorMessage(error, container) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message error-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const errorText = document.createElement('p');
        errorText.innerHTML = `❌ Video generation failed: ${error}`;
        contentDiv.appendChild(errorText);

        messageDiv.appendChild(contentDiv);

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        messageDiv.appendChild(timeDiv);

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        console.error('❌ Displayed video error message');
    }
};

// Make available globally
window.VideoGenerator = VideoGenerator;
