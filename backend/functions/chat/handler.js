// Chat Handler - Process user messages with Gemini API
const AWS = require('aws-sdk');
const https = require('https');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

exports.handler = async (event) => {
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const { message, sessionId } = body;

    // Validate input
    if (!message || !sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing required fields: message, sessionId' })
      };
    }

    // Get Gemini API key from SSM Parameter Store
    const apiKeyParam = await ssm.getParameter({
      Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
      WithDecryption: true
    }).promise();

    const apiKey = apiKeyParam.Parameter.Value;

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(message, apiKey);

    // Extract AI response
    const aiResponse = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('Invalid response from Gemini API');
    }

    // Save conversation to DynamoDB
    const timestamp = Date.now();
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE || 'ChatMessages',
      Item: {
        sessionId,
        timestamp,
        userMessage: message,
        aiResponse: aiResponse,
        type: 'chat'
      }
    }).promise();

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        response: aiResponse,
        timestamp,
        sessionId
      })
    };
  } catch (error) {
    console.error('Error in chat handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to process chat message',
        details: error.message
      })
    };
  }
};

/**
 * Call Google Gemini API to generate chat response
 * @param {string} message - User message
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Gemini API response
 */
function callGeminiAPI(message, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`Gemini API error: ${response.error?.message || 'Unknown error'}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse Gemini API response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}
