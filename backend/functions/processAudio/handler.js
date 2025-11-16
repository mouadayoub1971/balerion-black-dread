// Audio Processor Handler - Process audio files with Gemini API
const AWS = require('aws-sdk');
const https = require('https');
const { Readable } = require('stream');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'ChatMessages';
const S3_BUCKET = process.env.S3_BUCKET;

/**
 * Make HTTPS request
 */
function makeRequest(options, postData, isStream = false) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);

        if (isStream && postData) {
            postData.pipe(req);
        } else if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }

        if (!isStream) {
            req.end();
        }
    });
}

/**
 * Upload file to Gemini File API
 */
async function uploadFileToGemini(audioBuffer, mimeType, filename, apiKey) {
    console.log(`🎵 Uploading audio file to Gemini File API: ${filename} (${audioBuffer.length} bytes)`);

    // Step 1: Initiate resumable upload
    const initiateOptions = {
        hostname: 'generativelanguage.googleapis.com',
        path: '/upload/v1beta/files?key=' + apiKey,
        method: 'POST',
        headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': audioBuffer.length.toString(),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json'
        }
    };

    const metadata = {
        file: {
            display_name: filename
        }
    };

    const initiateResponse = await makeRequest(initiateOptions, metadata);
    const uploadUrl = initiateResponse.file?.uri;

    if (!uploadUrl) {
        throw new Error('Failed to get upload URL from Gemini File API');
    }

    console.log(`📤 Upload URL obtained, uploading file data...`);

    // Step 2: Upload file data
    const urlParts = new URL(uploadUrl);
    const uploadOptions = {
        hostname: urlParts.hostname,
        path: urlParts.pathname + urlParts.search,
        method: 'POST',
        headers: {
            'Content-Length': audioBuffer.length.toString(),
            'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize',
            'Content-Type': mimeType
        }
    };

    const stream = Readable.from(audioBuffer);
    await makeRequest(uploadOptions, stream, true);

    console.log(`✅ File uploaded successfully`);

    // Step 3: Poll file status until ACTIVE
    const fileId = uploadUrl.split('/').pop();
    let fileState = 'PROCESSING';
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max

    while (fileState === 'PROCESSING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusOptions = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/files/${fileId}?key=${apiKey}`,
            method: 'GET'
        };

        const statusResponse = await makeRequest(statusOptions);
        fileState = statusResponse.state;

        console.log(`📊 File status: ${fileState} (attempt ${attempts + 1}/${maxAttempts})`);
        attempts++;
    }

    if (fileState !== 'ACTIVE') {
        throw new Error(`File processing failed or timed out. Final state: ${fileState}`);
    }

    return {
        fileUri: `https://generativelanguage.googleapis.com/v1beta/files/${fileId}`,
        mimeType: mimeType
    };
}

/**
 * Process audio with Gemini API
 */
async function processAudioWithGemini(fileUri, mimeType, prompt, apiKey) {
    console.log(`🤖 Processing audio with Gemini API`);

    const requestData = {
        contents: [{
            parts: [
                {
                    file_data: {
                        mime_type: mimeType,
                        file_uri: fileUri
                    }
                },
                {
                    text: prompt || "Please transcribe this audio file and provide a summary. Support French, English, and Arabic languages."
                }
            ]
        }]
    };

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(requestData))
        }
    };

    const response = await makeRequest(options, requestData);

    // Extract text from response
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No response text from Gemini API');
    }

    return text;
}

/**
 * Process audio asynchronously (invoked by Lambda self-invocation)
 */
async function processAudioAsync(sessionId, timestamp, audioId) {
    try {
        console.log(`🎵 Starting async audio processing for audioId: ${audioId}`);

        // Retrieve audio metadata from DynamoDB
        const result = await dynamodb.get({
            TableName: DYNAMODB_TABLE,
            Key: {
                sessionId: sessionId,
                timestamp: timestamp
            }
        }).promise();

        if (!result.Item) {
            throw new Error('Audio data not found in DynamoDB');
        }

        const { s3Key, userPrompt: prompt, filename, mimeType } = result.Item;

        console.log(`🎵 Retrieved audio metadata: ${filename}, mimeType: ${mimeType}`);

        // Retrieve audio from S3
        const s3Object = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: s3Key
        }).promise();

        console.log(`🎵 Retrieved audio from S3: ${s3Key}`);

        // Get Gemini API key from SSM Parameter Store
        const apiKeyParam = await ssm.getParameter({
            Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
            WithDecryption: true
        }).promise();

        const apiKey = apiKeyParam.Parameter.Value;

        // Upload file to Gemini File API and get file URI
        const { fileUri, mimeType: uploadedMimeType } = await uploadFileToGemini(
            s3Object.Body,
            mimeType,
            filename,
            apiKey
        );

        // Process audio with Gemini API
        const response = await processAudioWithGemini(fileUri, uploadedMimeType, prompt, apiKey);

        // Update DynamoDB with completed status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'audio',
                filename: filename || 'unknown.mp3',
                mimeType: mimeType,
                userPrompt: prompt || '',
                aiResponse: response,
                status: 'completed',
                audioId: audioId
                // s3Key is removed - audio will be deleted from S3
            }
        }).promise();

        // Delete audio from S3 to save storage costs
        await s3.deleteObject({
            Bucket: S3_BUCKET,
            Key: s3Key
        }).promise();

        console.log(`✅ Audio processing complete! Audio deleted from S3: ${s3Key}`);

    } catch (error) {
        console.error('❌ Error in async audio processing:', error);

        // Get filename and S3 key from context for error reporting and cleanup
        let errorFilename = 'unknown.mp3';
        let errorMimeType = 'audio/mpeg';
        let errorS3Key = null;
        try {
            const result = await dynamodb.get({
                TableName: DYNAMODB_TABLE,
                Key: { sessionId: sessionId, timestamp: timestamp }
            }).promise();
            if (result.Item) {
                errorFilename = result.Item.filename || 'unknown.mp3';
                errorMimeType = result.Item.mimeType || 'audio/mpeg';
                errorS3Key = result.Item.s3Key;
            }
        } catch (getError) {
            console.error('Failed to get audio info for error:', getError);
        }

        // Delete audio from S3 even on error
        if (errorS3Key) {
            try {
                await s3.deleteObject({
                    Bucket: S3_BUCKET,
                    Key: errorS3Key
                }).promise();
                console.log(`🗑️ Deleted audio from S3 after error: ${errorS3Key}`);
            } catch (s3Error) {
                console.error('Failed to delete audio from S3:', s3Error);
            }
        }

        // Update DynamoDB with error status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'audio',
                filename: errorFilename,
                mimeType: errorMimeType,
                status: 'failed',
                error: error.message,
                audioId: audioId
            }
        }).promise();
    }
}

exports.handler = async (event) => {
    console.log('Audio processing request:', JSON.stringify(event, null, 2));

    try {
        // Check if this is an async processing event (from Lambda self-invocation)
        if (event.asyncProcessing) {
            const { sessionId, timestamp, audioId } = event;
            await processAudioAsync(sessionId, timestamp, audioId);
            return { statusCode: 200, body: 'Processing complete' };
        }

        // Parse request body (from API Gateway)
        const body = JSON.parse(event.body || '{}');
        const { audioBase64, prompt, sessionId, filename, mimeType, checkStatus } = body;

        // If this is a status check request
        if (checkStatus) {
            const audioId = body.audioId;
            if (!audioId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Missing audioId for status check' })
                };
            }

            // Query DynamoDB for audio status
            const result = await dynamodb.get({
                TableName: DYNAMODB_TABLE,
                Key: {
                    sessionId: sessionId,
                    timestamp: parseInt(audioId)
                }
            }).promise();

            if (!result.Item) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Audio request not found' })
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result.Item)
            };
        }

        // Validate input for new audio request
        if (!audioBase64 || !sessionId || !mimeType) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Missing required fields: audioBase64, sessionId, and mimeType are required'
                })
            };
        }

        // Validate MIME type
        const validMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4'];
        if (!validMimeTypes.includes(mimeType.toLowerCase())) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: `Invalid MIME type. Supported types: ${validMimeTypes.join(', ')}`
                })
            };
        }

        const timestamp = Date.now();
        const audioId = timestamp.toString();

        // Store audio in S3 (avoid DynamoDB 400KB limit)
        const s3Key = `audio/${sessionId}/${audioId}.${mimeType.split('/')[1]}`;
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: Buffer.from(audioBase64, 'base64'),
            ContentType: mimeType
        }).promise();

        console.log(`🎵 Audio uploaded to S3: ${s3Key}`);

        // Save initial "processing" status to DynamoDB with S3 reference
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'audio',
                filename: filename || 'unknown.mp3',
                mimeType: mimeType,
                userPrompt: prompt || '',
                status: 'processing',
                audioId: audioId,
                s3Key: s3Key
            }
        }).promise();

        console.log(`🎵 Audio processing initiated: ${filename}, mimeType: ${mimeType}`);

        // Invoke Lambda asynchronously to process audio in background
        await lambda.invoke({
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
            InvocationType: 'Event', // Asynchronous invocation
            Payload: JSON.stringify({
                asyncProcessing: true,
                sessionId: sessionId,
                timestamp: timestamp,
                audioId: audioId
            })
        }).promise();

        // Return immediately with processing status
        return {
            statusCode: 202, // Accepted
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: 'processing',
                message: 'Audio processing started. This may take 1-2 minutes.',
                audioId: audioId,
                sessionId: sessionId,
                timestamp: timestamp,
                filename: filename
            })
        };

    } catch (error) {
        console.error('❌ Error in audio handler:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to process audio request',
                details: error.message
            })
        };
    }
};
