// Document Processor Module - Handle /teacher command for PDF processing
const DocumentProcessor = {
    /**
     * Check if message is a /teacher command
     */
    isTeacherCommand(message) {
        return message.trim().toLowerCase().startsWith('/teacher');
    },

    /**
     * Show file upload dialog and mode selection
     */
    showFileUploadDialog() {
        return new Promise((resolve, reject) => {
            // Create file input element
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf';
            fileInput.style.display = 'none';

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];

                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                // Validate file type
                if (file.type !== 'application/pdf') {
                    reject(new Error('Please select a PDF file'));
                    return;
                }

                // Validate file size (20MB limit)
                const maxSize = 20 * 1024 * 1024; // 20MB
                if (file.size > maxSize) {
                    reject(new Error('PDF file must be less than 20MB'));
                    return;
                }

                try {
                    console.log(`📄 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

                    // Convert PDF to base64
                    const pdfBase64 = await this.convertPDFToBase64(file);

                    // Show mode selection dialog
                    const modeData = await this.showModeSelectionDialog(file.name);

                    resolve({
                        pdfBase64,
                        filename: file.name,
                        action: modeData.action,
                        prompt: modeData.prompt
                    });
                } catch (error) {
                    reject(error);
                }
            });

            // Trigger file dialog
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
    },

    /**
     * Convert PDF file to base64 string
     */
    convertPDFToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                // Remove data URL prefix (data:application/pdf;base64,)
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };

            reader.onerror = () => {
                reject(new Error('Failed to read PDF file'));
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * Show mode selection dialog
     */
    showModeSelectionDialog(filename) {
        return new Promise((resolve, reject) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;

            // Create modal content
            const modal = document.createElement('div');
            modal.className = 'mode-selection-modal';
            modal.style.cssText = `
                background: hsl(var(--card));
                border-radius: var(--radius);
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            `;

            modal.innerHTML = `
                <h2 style="margin: 0 0 1rem 0; color: hsl(var(--foreground));">
                    📄 Process Document
                </h2>
                <p style="margin: 0 0 1.5rem 0; color: hsl(var(--muted-foreground)); font-size: 0.9rem;">
                    File: <strong>${filename}</strong>
                </p>

                <div style="margin-bottom: 1.5rem;">
                    <p style="margin: 0 0 0.75rem 0; color: hsl(var(--foreground)); font-weight: 500;">
                        How would you like to process this document?
                    </p>

                    <div class="mode-options" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button class="mode-btn" data-action="summarize" style="
                            padding: 1rem;
                            border: 2px solid hsl(var(--border));
                            border-radius: calc(var(--radius) - 4px);
                            background: hsl(var(--background));
                            color: hsl(var(--foreground));
                            cursor: pointer;
                            text-align: left;
                            transition: all 0.2s;
                        ">
                            <div style="font-weight: 600; margin-bottom: 0.25rem;">📋 Summarize</div>
                            <div style="font-size: 0.85rem; color: hsl(var(--muted-foreground));">
                                Get a comprehensive summary of the document
                            </div>
                        </button>

                        <button class="mode-btn" data-action="explain" style="
                            padding: 1rem;
                            border: 2px solid hsl(var(--border));
                            border-radius: calc(var(--radius) - 4px);
                            background: hsl(var(--background));
                            color: hsl(var(--foreground));
                            cursor: pointer;
                            text-align: left;
                            transition: all 0.2s;
                        ">
                            <div style="font-weight: 600; margin-bottom: 0.25rem;">💡 Explain</div>
                            <div style="font-size: 0.85rem; color: hsl(var(--muted-foreground));">
                                Break down complex concepts into simple language
                            </div>
                        </button>

                        <button class="mode-btn" data-action="qa" style="
                            padding: 1rem;
                            border: 2px solid hsl(var(--border));
                            border-radius: calc(var(--radius) - 4px);
                            background: hsl(var(--background));
                            color: hsl(var(--foreground));
                            cursor: pointer;
                            text-align: left;
                            transition: all 0.2s;
                        ">
                            <div style="font-weight: 600; margin-bottom: 0.25rem;">❓ Ask Questions</div>
                            <div style="font-size: 0.85rem; color: hsl(var(--muted-foreground));">
                                Ask specific questions about the document
                            </div>
                        </button>
                    </div>
                </div>

                <div id="qa-prompt-container" style="display: none; margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: hsl(var(--foreground)); font-weight: 500;">
                        Your Question:
                    </label>
                    <textarea
                        id="qa-prompt"
                        placeholder="What would you like to know about this document?"
                        style="
                            width: 100%;
                            min-height: 80px;
                            padding: 0.75rem;
                            border: 2px solid hsl(var(--border));
                            border-radius: calc(var(--radius) - 4px);
                            background: hsl(var(--background));
                            color: hsl(var(--foreground));
                            font-family: inherit;
                            resize: vertical;
                        "
                    ></textarea>
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        padding: 0.5rem 1rem;
                        border: 2px solid hsl(var(--border));
                        border-radius: calc(var(--radius) - 4px);
                        background: hsl(var(--background));
                        color: hsl(var(--foreground));
                        cursor: pointer;
                        font-weight: 500;
                    ">
                        Cancel
                    </button>
                    <button id="process-btn" disabled style="
                        padding: 0.5rem 1rem;
                        border: 2px solid hsl(var(--primary));
                        border-radius: calc(var(--radius) - 4px);
                        background: hsl(var(--primary));
                        color: hsl(var(--primary-foreground));
                        cursor: not-allowed;
                        font-weight: 500;
                        opacity: 0.5;
                    ">
                        Process Document
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            let selectedAction = null;

            // Handle mode button clicks
            const modeButtons = modal.querySelectorAll('.mode-btn');
            const qaPromptContainer = modal.querySelector('#qa-prompt-container');
            const processBtn = modal.querySelector('#process-btn');
            const cancelBtn = modal.querySelector('#cancel-btn');

            modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove selection from all buttons
                    modeButtons.forEach(b => {
                        b.style.borderColor = 'hsl(var(--border))';
                        b.style.background = 'hsl(var(--background))';
                    });

                    // Highlight selected button
                    btn.style.borderColor = 'hsl(var(--primary))';
                    btn.style.background = 'hsl(var(--accent))';

                    selectedAction = btn.dataset.action;

                    // Show Q&A prompt input if Q&A is selected
                    if (selectedAction === 'qa') {
                        qaPromptContainer.style.display = 'block';
                    } else {
                        qaPromptContainer.style.display = 'none';
                    }

                    // Enable process button
                    processBtn.disabled = false;
                    processBtn.style.cursor = 'pointer';
                    processBtn.style.opacity = '1';
                });

                // Hover effects
                btn.addEventListener('mouseenter', () => {
                    if (btn.style.borderColor !== 'hsl(var(--primary))') {
                        btn.style.borderColor = 'hsl(var(--muted))';
                    }
                });
                btn.addEventListener('mouseleave', () => {
                    if (btn.style.borderColor !== 'hsl(var(--primary))') {
                        btn.style.borderColor = 'hsl(var(--border))';
                    }
                });
            });

            // Handle process button
            processBtn.addEventListener('click', () => {
                if (!selectedAction) return;

                let prompt = '';
                if (selectedAction === 'qa') {
                    const qaInput = modal.querySelector('#qa-prompt');
                    prompt = qaInput.value.trim();

                    if (!prompt) {
                        qaInput.style.borderColor = 'hsl(0, 70%, 50%)';
                        return;
                    }
                }

                document.body.removeChild(overlay);
                resolve({ action: selectedAction, prompt });
            });

            // Handle cancel button
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                reject(new Error('User cancelled document processing'));
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    reject(new Error('User cancelled document processing'));
                }
            });
        });
    },

    /**
     * Process document with Gemini API (async with polling)
     */
    async processDocument(pdfBase64, action, prompt, sessionId, filename) {
        console.log(`🔄 Processing document: ${filename} with action: ${action}`);

        // Step 1: Initiate document processing
        const initiateResponse = await fetch(`${CONFIG.API_BASE_URL}/process-document`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pdfBase64,
                action,
                prompt,
                sessionId,
                filename
            })
        });

        if (!initiateResponse.ok) {
            const errorData = await initiateResponse.json();
            throw new Error(errorData.error || 'Failed to initiate document processing');
        }

        const initiateData = await initiateResponse.json();
        console.log(`📄 Document processing started, ID: ${initiateData.documentId}`);

        // Step 2: Poll for completion
        const maxAttempts = 24; // 24 attempts * 5 seconds = 2 minutes max
        const pollInterval = 5000; // 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Polling attempt ${attempt}/${maxAttempts}...`);

            // Wait before polling (except first attempt)
            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } else {
                // Wait 3 seconds before first poll to give Lambda time to start
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Check status
            const statusResponse = await fetch(`${CONFIG.API_BASE_URL}/process-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    checkStatus: true,
                    documentId: initiateData.documentId,
                    sessionId: sessionId
                })
            });

            if (!statusResponse.ok) {
                console.error('Status check failed:', statusResponse.statusText);
                continue;
            }

            const statusData = await statusResponse.json();
            console.log(`Status: ${statusData.status}`);

            if (statusData.status === 'completed') {
                console.log('✅ Document processing complete!');
                return {
                    response: statusData.aiResponse,
                    action: statusData.action,
                    filename: statusData.filename,
                    timestamp: statusData.timestamp,
                    sessionId: statusData.sessionId
                };
            } else if (statusData.status === 'failed') {
                throw new Error(statusData.error || 'Document processing failed');
            }

            // Status is still 'processing', continue polling
        }

        throw new Error('Document processing timed out after 2 minutes');
    },

    /**
     * Show processing message in chat
     */
    showProcessingMessage(container) {
        const processingDiv = document.createElement('div');
        processingDiv.className = 'message ai-message processing-message';
        processingDiv.innerHTML = `
            <div class="message-content">
                <div class="processing-indicator">
                    <div class="spinner"></div>
                    <span>Processing document...</span>
                </div>
            </div>
        `;
        container.appendChild(processingDiv);
        container.scrollTop = container.scrollHeight;
        return processingDiv;
    },

    /**
     * Display document response in chat
     */
    displayDocumentResponse(data, container, processingMessage) {
        // Remove processing message
        if (processingMessage) {
            processingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message document-message';

        // Format action name
        const actionNames = {
            summarize: 'Summary',
            explain: 'Explanation',
            qa: 'Q&A Response'
        };
        const actionName = actionNames[data.action] || data.action;

        // Format timestamp
        const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="document-header" style="
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid hsl(var(--border));
                ">
                    <div style="font-weight: 600; color: hsl(var(--primary)); margin-bottom: 0.25rem;">
                        📄 ${data.filename}
                    </div>
                    <div style="font-size: 0.85rem; color: hsl(var(--muted-foreground));">
                        ${actionName}
                    </div>
                </div>
                <div class="document-response" style="white-space: pre-wrap; line-height: 1.6;">
${data.response}
                </div>
            </div>
            <div class="message-time">${time}</div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    },

    /**
     * Show error message in chat
     */
    showErrorMessage(error, container, processingMessage) {
        // Remove processing message
        if (processingMessage) {
            processingMessage.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'message ai-message error-message';

        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        errorDiv.innerHTML = `
            <div class="message-content">
                <div style="color: hsl(0, 70%, 50%);">
                    ❌ Error processing document: ${error.message}
                </div>
            </div>
            <div class="message-time">${time}</div>
        `;

        container.appendChild(errorDiv);
        container.scrollTop = container.scrollHeight;
    }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentProcessor;
}
