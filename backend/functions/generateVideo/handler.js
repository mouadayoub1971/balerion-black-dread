const AWS = require('aws-sdk');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const ssm = new AWS.SSM();

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'ChatMessages';
const S3_BUCKET = process.env.S3_BUCKET;

/**
 * Make HTTPS request
 */
function makeRequest(options, postData = null) {
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
        if (postData) req.write(JSON.stringify(postData));
        req.end();
    });
}

/**
 * Download video from URL with redirect following
 */
function downloadVideo(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            // Follow redirects
            if (res.statusCode === 302 || res.statusCode === 301) {
                console.log('Following redirect to:', res.headers.location);
                return downloadVideo(res.headers.location).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed: ${res.statusCode}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

/**
 * Poll operation until done
 */
async function pollOperation(operationName, apiKey, maxAttempts = 90) {
    console.log(`Polling operation: ${operationName}`);

    for (let i = 0; i < maxAttempts; i++) {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/${operationName}?key=${apiKey}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        };

        const result = await makeRequest(options);
        console.log(`Poll attempt ${i + 1}/${maxAttempts}:`, result.done ? 'DONE' : 'PENDING');

        if (result.done) {
            if (result.error) {
                throw new Error(`Operation failed: ${JSON.stringify(result.error)}`);
            }
            return result.response;
        }

        // Wait 10 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error('Operation timed out after 15 minutes');
}

/**
 * Process video generation asynchronously
 */
async function processVideoGeneration(prompt, sessionId, timestamp, videoId) {
    try {
        console.log(`🎬 Starting async video generation for: "${prompt}"`);

        // Get Gemini API key from SSM Parameter Store
        const apiKeyParam = await ssm.getParameter({
            Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
            WithDecryption: true
        }).promise();

        const apiKey = apiKeyParam.Parameter.Value;

        // Step 1: Initiate video generation
        const initiateOptions = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const initiateData = {
            instances: [{ prompt: prompt }]
        };

        console.log('Initiating Veo API call...');
        const initiateResponse = await makeRequest(initiateOptions, initiateData);

        if (!initiateResponse.name) {
            throw new Error('No operation name returned from API');
        }

        const operationName = initiateResponse.name;
        console.log(`Operation started: ${operationName}`);

        // Step 2: Poll until complete
        const response = await pollOperation(operationName, apiKey, 90);

        // Step 3: Extract video URI
        const videoUri = response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!videoUri) {
            throw new Error('No video URI in response');
        }

        console.log(`Video generated, downloading from: ${videoUri}`);

        // Step 4: Download video
        const videoBuffer = await downloadVideo(videoUri);
        console.log(`Downloaded video: ${videoBuffer.length} bytes`);

        // Step 5: Upload to S3
        const filename = `videos/${sessionId}-${uuidv4()}.mp4`;
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: filename,
            Body: videoBuffer,
            ContentType: 'video/mp4'
        }).promise();

        console.log(`Uploaded to S3: ${filename}`);

        // Step 6: Generate signed URL
        const videoUrl = s3.getSignedUrl('getObject', {
            Bucket: S3_BUCKET,
            Key: filename,
            Expires: 3600 // 1 hour
        });

        // Step 7: Update DynamoDB with completed status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'video',
                prompt: prompt,
                status: 'completed',
                videoUrl: videoUrl,
                filename: filename,
                duration: 6,
                videoId: videoId
            }
        }).promise();

        console.log('✅ Video generation complete!');

    } catch (error) {
        console.error('❌ Error in async video processing:', error);

        // Update DynamoDB with error status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'video',
                prompt: prompt,
                status: 'failed',
                error: error.message,
                videoId: videoId
            }
        }).promise();
    }
}

exports.handler = async (event) => {
    console.log('Video generation request:', JSON.stringify(event));

    try {
        // Check if this is an async processing event (from Lambda self-invocation)
        if (event.asyncProcessing) {
            const { prompt, sessionId, timestamp, videoId } = event;
            await processVideoGeneration(prompt, sessionId, timestamp, videoId);
            return { statusCode: 200, body: 'Processing complete' };
        }

        // Parse request body (from API Gateway)
        const body = JSON.parse(event.body || '{}');
        const { prompt, sessionId, checkStatus } = body;

        // If this is a status check request
        if (checkStatus) {
            const videoId = body.videoId;
            if (!videoId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Missing videoId for status check' })
                };
            }

            // Query DynamoDB for video status
            const result = await dynamodb.get({
                TableName: DYNAMODB_TABLE,
                Key: {
                    sessionId: sessionId,
                    timestamp: parseInt(videoId)
                }
            }).promise();

            if (!result.Item) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Video request not found' })
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

        // Validate input for new video request
        if (!prompt || !sessionId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Missing required fields: prompt and sessionId' })
            };
        }

        const timestamp = Date.now();
        const videoId = timestamp.toString();

        // Save initial "processing" status to DynamoDB
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'video',
                prompt: prompt,
                status: 'processing',
                videoId: videoId
            }
        }).promise();

        console.log(`🎬 Video generation initiated for: "${prompt}"`);

        // Invoke Lambda asynchronously to process video in background
        const lambda = new AWS.Lambda();
        await lambda.invoke({
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
            InvocationType: 'Event', // Asynchronous invocation
            Payload: JSON.stringify({
                asyncProcessing: true,
                prompt: prompt,
                sessionId: sessionId,
                timestamp: timestamp,
                videoId: videoId
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
                message: 'Video generation started. This will take 2-10 minutes.',
                videoId: videoId,
                sessionId: sessionId,
                timestamp: timestamp
            })
        };

    } catch (error) {
        console.error('❌ Error in video handler:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to process video request',
                details: error.message
            })
        };
    }
};
