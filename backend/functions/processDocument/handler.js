// Document Processor Handler - Process PDFs with Gemini API
const AWS = require('aws-sdk');
const https = require('https');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'ChatMessages';
const S3_BUCKET = process.env.S3_BUCKET;

/**
 * Make HTTPS request to Gemini API
 */
function makeRequest(options, postData) {
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
 * Get system instruction based on action type
 */
function getSystemInstruction(action) {
    const instructions = {
        summarize: "You are a helpful teacher assistant. When summarizing documents, provide a comprehensive summary with: 1) Main topic and purpose, 2) Key findings or arguments, 3) Conclusions or implications. Use clear headings and bullet points for readability. Cite specific sections or page numbers when referencing content.",
        explain: "You are a helpful teacher assistant. When explaining documents, break down complex concepts into simple, understandable language. Use analogies and examples where helpful. Structure your explanation with clear headings. If the document contains technical terms, define them. Explain as if teaching someone who is encountering this material for the first time.",
        qa: "You are a helpful teacher assistant. When answering questions about documents, provide accurate, specific answers based on the document content. Always cite the relevant sections or page numbers. If the answer isn't in the document, say so clearly. If the question is ambiguous, ask for clarification."
    };

    return instructions[action] || instructions.qa;
}

/**
 * Get default prompt based on action
 */
function getDefaultPrompt(action) {
    const prompts = {
        summarize: "Please provide a comprehensive summary of this document. Include: 1) The main topic and purpose, 2) Key findings, arguments, or points, 3) Conclusions or implications. Use clear headings and bullet points.",
        explain: "Please explain the main concepts and ideas in this document. Break down complex topics into simple, understandable language. Use examples and analogies where helpful. Structure your explanation clearly.",
        qa: "Please analyze this document and be prepared to answer questions about it."
    };

    return prompts[action] || prompts.qa;
}

/**
 * Process PDF with Gemini API
 */
async function processDocument(pdfBase64, userPrompt, action, apiKey) {
    console.log(`Processing document with action: ${action}`);

    // Get system instruction and default prompt for this action
    const systemInstruction = getSystemInstruction(action);
    const defaultPrompt = getDefaultPrompt(action);

    // Use user prompt if provided, otherwise use default
    const finalPrompt = userPrompt && userPrompt.trim() ? userPrompt : defaultPrompt;

    const requestData = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: "application/pdf",
                        data: pdfBase64
                    }
                },
                {
                    text: finalPrompt
                }
            ]
        }],
        systemInstruction: {
            parts: [{
                text: systemInstruction
            }]
        }
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
 * Process document asynchronously (invoked by Lambda self-invocation)
 */
async function processDocumentAsync(sessionId, timestamp, documentId) {
    try {
        console.log(`📄 Starting async document processing for documentId: ${documentId}`);

        // Retrieve document metadata from DynamoDB
        const result = await dynamodb.get({
            TableName: DYNAMODB_TABLE,
            Key: {
                sessionId: sessionId,
                timestamp: timestamp
            }
        }).promise();

        if (!result.Item) {
            throw new Error('Document data not found in DynamoDB');
        }

        const { s3Key, userPrompt: prompt, action, filename } = result.Item;

        console.log(`📄 Retrieved document metadata: ${filename}, action: ${action}`);

        // Retrieve PDF from S3
        const s3Object = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: s3Key
        }).promise();

        // Convert PDF buffer back to base64
        const pdfBase64 = s3Object.Body.toString('base64');
        console.log(`📄 Retrieved PDF from S3: ${s3Key}`);

        // Get Gemini API key from SSM Parameter Store
        const apiKeyParam = await ssm.getParameter({
            Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
            WithDecryption: true
        }).promise();

        const apiKey = apiKeyParam.Parameter.Value;

        // Process document with Gemini API
        const response = await processDocument(pdfBase64, prompt, action, apiKey);

        // Update DynamoDB with completed status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'document',
                action: action,
                filename: filename || 'unknown.pdf',
                userPrompt: prompt || '',
                aiResponse: response,
                status: 'completed',
                documentId: documentId
                // s3Key is removed - PDF will be deleted from S3
            }
        }).promise();

        // Delete PDF from S3 to save storage costs
        await s3.deleteObject({
            Bucket: S3_BUCKET,
            Key: s3Key
        }).promise();

        console.log(`✅ Document processing complete! PDF deleted from S3: ${s3Key}`);

    } catch (error) {
        console.error('❌ Error in async document processing:', error);

        // Get filename and S3 key from context for error reporting and cleanup
        let errorFilename = 'unknown.pdf';
        let errorAction = 'unknown';
        let errorS3Key = null;
        try {
            const result = await dynamodb.get({
                TableName: DYNAMODB_TABLE,
                Key: { sessionId: sessionId, timestamp: timestamp }
            }).promise();
            if (result.Item) {
                errorFilename = result.Item.filename || 'unknown.pdf';
                errorAction = result.Item.action || 'unknown';
                errorS3Key = result.Item.s3Key;
            }
        } catch (getError) {
            console.error('Failed to get document info for error:', getError);
        }

        // Delete PDF from S3 even on error
        if (errorS3Key) {
            try {
                await s3.deleteObject({
                    Bucket: S3_BUCKET,
                    Key: errorS3Key
                }).promise();
                console.log(`🗑️ Deleted PDF from S3 after error: ${errorS3Key}`);
            } catch (s3Error) {
                console.error('Failed to delete PDF from S3:', s3Error);
            }
        }

        // Update DynamoDB with error status
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'document',
                action: errorAction,
                filename: errorFilename,
                status: 'failed',
                error: error.message,
                documentId: documentId
            }
        }).promise();
    }
}

exports.handler = async (event) => {
    console.log('Document processing request:', JSON.stringify(event, null, 2));

    try {
        // Check if this is an async processing event (from Lambda self-invocation)
        if (event.asyncProcessing) {
            const { sessionId, timestamp, documentId } = event;
            await processDocumentAsync(sessionId, timestamp, documentId);
            return { statusCode: 200, body: 'Processing complete' };
        }

        // Parse request body (from API Gateway)
        const body = JSON.parse(event.body || '{}');
        const { pdfBase64, prompt, sessionId, action, filename, checkStatus } = body;

        // If this is a status check request
        if (checkStatus) {
            const documentId = body.documentId;
            if (!documentId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Missing documentId for status check' })
                };
            }

            // Query DynamoDB for document status
            const result = await dynamodb.get({
                TableName: DYNAMODB_TABLE,
                Key: {
                    sessionId: sessionId,
                    timestamp: parseInt(documentId)
                }
            }).promise();

            if (!result.Item) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ error: 'Document request not found' })
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

        // Validate input for new document request
        if (!pdfBase64 || !sessionId || !action) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Missing required fields: pdfBase64, sessionId, and action are required'
                })
            };
        }

        // Validate action
        const validActions = ['summarize', 'explain', 'qa'];
        if (!validActions.includes(action)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: `Invalid action. Must be one of: ${validActions.join(', ')}`
                })
            };
        }

        const timestamp = Date.now();
        const documentId = timestamp.toString();

        // Store PDF in S3 (DynamoDB has 400KB item size limit)
        const s3Key = `documents/${sessionId}/${documentId}.pdf`;
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: Buffer.from(pdfBase64, 'base64'),
            ContentType: 'application/pdf'
        }).promise();

        console.log(`📄 PDF uploaded to S3: ${s3Key}`);

        // Save initial "processing" status to DynamoDB with S3 reference
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'document',
                action: action,
                filename: filename || 'unknown.pdf',
                userPrompt: prompt || '',
                status: 'processing',
                documentId: documentId,
                s3Key: s3Key  // Store S3 key instead of PDF data
            }
        }).promise();

        console.log(`📄 Document processing initiated: ${filename}, action: ${action}`);

        // Invoke Lambda asynchronously to process document in background
        // Don't include pdfBase64 in payload - Lambda will retrieve from DynamoDB
        await lambda.invoke({
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
            InvocationType: 'Event', // Asynchronous invocation
            Payload: JSON.stringify({
                asyncProcessing: true,
                sessionId: sessionId,
                timestamp: timestamp,
                documentId: documentId
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
                message: 'Document processing started. This may take 1-2 minutes.',
                documentId: documentId,
                sessionId: sessionId,
                timestamp: timestamp,
                action: action,
                filename: filename
            })
        };

    } catch (error) {
        console.error('❌ Error in document handler:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to process document request',
                details: error.message
            })
        };
    }
};
