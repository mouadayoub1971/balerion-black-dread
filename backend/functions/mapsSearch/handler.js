// Maps Search Handler - Location-based search with Google Maps grounding
const AWS = require('aws-sdk');
const https = require('https');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'ChatMessages';

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
 * Perform maps search with Google Maps grounding
 */
async function performMapsSearch(query, latitude, longitude, apiKey) {
    console.log(`🗺️ Performing maps search: ${query} at (${latitude}, ${longitude})`);

    const requestData = {
        contents: [{
            parts: [{
                text: query
            }]
        }],
        tools: [{
            googleMaps: {}
        }]
    };

    // Add location context if provided
    if (latitude !== null && longitude !== null) {
        requestData.toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: latitude,
                    longitude: longitude
                }
            }
        };
    }

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

    // Extract text and grounding metadata
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;

    if (!text) {
        throw new Error('No response text from Gemini API');
    }

    // Extract map sources if available
    let sources = [];
    if (groundingMetadata?.groundingChunks) {
        sources = groundingMetadata.groundingChunks
            .filter(chunk => chunk.maps)
            .map(chunk => ({
                title: chunk.maps.title,
                uri: chunk.maps.uri
            }));
    }

    return {
        text,
        sources,
        groundingMetadata
    };
}

exports.handler = async (event) => {
    console.log('Maps search request:', JSON.stringify(event, null, 2));

    try {
        // Parse request body
        const body = JSON.parse(event.body || '{}');
        const { query, sessionId, latitude, longitude } = body;

        // Validate input
        if (!query || !sessionId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Missing required fields: query and sessionId are required'
                })
            };
        }

        // Get Gemini API key from SSM Parameter Store
        const apiKeyParam = await ssm.getParameter({
            Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
            WithDecryption: true
        }).promise();

        const apiKey = apiKeyParam.Parameter.Value;

        console.log(`🗺️ Searching maps: "${query}"`);

        // Perform maps search
        const searchResult = await performMapsSearch(
            query,
            latitude || null,
            longitude || null,
            apiKey
        );

        const timestamp = Date.now();

        // Save to DynamoDB
        await dynamodb.put({
            TableName: DYNAMODB_TABLE,
            Item: {
                sessionId: sessionId,
                timestamp: timestamp,
                type: 'maps',
                userQuery: query,
                aiResponse: searchResult.text,
                sources: searchResult.sources,
                location: (latitude && longitude) ? {
                    latitude: latitude,
                    longitude: longitude
                } : null,
                groundingMetadata: searchResult.groundingMetadata || null
            }
        }).promise();

        console.log('✅ Maps search completed successfully');

        // Return success response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                response: searchResult.text,
                sources: searchResult.sources,
                groundingMetadata: searchResult.groundingMetadata,
                query: query,
                timestamp: timestamp,
                sessionId: sessionId
            })
        };

    } catch (error) {
        console.error('❌ Error performing maps search:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to perform maps search',
                details: error.message
            })
        };
    }
};
