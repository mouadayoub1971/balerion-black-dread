// Function Calling Handler - Execute tools using Gemini's native function calling
const AWS = require('aws-sdk');
const https = require('https');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ssm = new AWS.SSM();

// Define available tools for Gemini
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather information for a specific location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or location (e.g., "Paris", "New York", "London")'
        }
      },
      required: ['location']
    }
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations and evaluate expressions',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "5 * 10")'
        }
      },
      required: ['expression']
    }
  },
  {
    name: 'search_web',
    description: 'Search the web for information using DuckDuckGo',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to look up on the web'
        }
      },
      required: ['query']
    }
  }
];

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

    // Get API key from SSM
    const apiKeyParam = await ssm.getParameter({
      Name: process.env.GEMINI_API_KEY_PARAM || '/chatbot/gemini-api-key',
      WithDecryption: true
    }).promise();

    const apiKey = apiKeyParam.Parameter.Value;

    // Call Gemini with function declarations
    let geminiResponse = await callGeminiWithTools(message, tools, apiKey);

    // Check if Gemini wants to call a function
    const functionCall = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    let functionResult = null;
    if (functionCall) {
      console.log('Gemini requested function call:', functionCall.name);

      // Execute the requested function
      functionResult = await executeFunction(functionCall.name, functionCall.args);
      console.log('Function result:', functionResult);

      // Send function result back to Gemini for final response
      geminiResponse = await sendFunctionResult(
        message,
        tools,
        functionCall,
        functionResult,
        apiKey
      );
    }

    // Extract final response
    const finalResponse = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!finalResponse) {
      throw new Error('Invalid response from Gemini API');
    }

    // Save interaction to DynamoDB
    const timestamp = Date.now();
    await dynamodb.put({
      TableName: process.env.DYNAMODB_TABLE || 'ChatMessages',
      Item: {
        sessionId,
        timestamp,
        userMessage: message,
        aiResponse: finalResponse,
        functionCalled: functionCall?.name || null,
        functionResult: functionResult || null,
        type: 'function_call'
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
        response: finalResponse,
        functionCalled: functionCall?.name || null,
        timestamp,
        sessionId
      })
    };
  } catch (error) {
    console.error('Error in function calling handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to process function call',
        details: error.message
      })
    };
  }
};

/**
 * Execute the function requested by Gemini
 */
async function executeFunction(functionName, args) {
  try {
    switch (functionName) {
      case 'get_weather':
        return await getWeather(args.location);
      case 'calculate':
        return calculate(args.expression);
      case 'search_web':
        return await searchWeb(args.query);
      default:
        return { error: 'Unknown function' };
    }
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get weather information using OpenWeatherMap API
 */
async function getWeather(location) {
  // Get OpenWeatherMap API key from environment variable
  // If not set, return mock data for testing
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('OpenWeatherMap API key not set, returning mock data');
    return {
      location: location,
      temperature: 20,
      description: 'partly cloudy',
      humidity: 65,
      note: 'This is mock data. Set OPENWEATHER_API_KEY for real weather data.'
    };
  }

  return new Promise((resolve) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;

    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.cod === 200) {
            resolve({
              location: data.name,
              temperature: data.main.temp,
              description: data.weather[0].description,
              humidity: data.main.humidity,
              windSpeed: data.wind.speed
            });
          } else {
            resolve({ error: `Could not find weather for ${location}` });
          }
        } catch (e) {
          resolve({ error: 'Failed to parse weather data' });
        }
      });
    }).on('error', () => resolve({ error: 'Weather API unavailable' }));
  });
}

/**
 * Calculate mathematical expression
 */
function calculate(expression) {
  try {
    // Safe evaluation using Function constructor
    // Only allow basic math operations
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    const result = Function('"use strict"; return (' + sanitized + ')')();

    if (typeof result === 'number' && !isNaN(result)) {
      return { result: result };
    } else {
      return { error: 'Invalid calculation result' };
    }
  } catch (error) {
    return { error: 'Invalid mathematical expression' };
  }
}

/**
 * Search the web using DuckDuckGo API (no API key needed)
 */
async function searchWeb(query) {
  return new Promise((resolve) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({
            abstract: data.Abstract || 'No results found',
            abstractSource: data.AbstractSource || 'N/A',
            abstractURL: data.AbstractURL || '',
            relatedTopics: data.RelatedTopics?.slice(0, 3).map(t => t.Text || t.FirstURL) || []
          });
        } catch (e) {
          resolve({ error: 'Failed to parse search results' });
        }
      });
    }).on('error', () => resolve({ error: 'Search API unavailable' }));
  });
}

/**
 * Call Gemini with function declarations
 */
function callGeminiWithTools(message, tools, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [{
        parts: [{ text: message }]
      }],
      tools: [{
        function_declarations: tools
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
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

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send function result back to Gemini to get final response
 */
function sendFunctionResult(originalMessage, tools, functionCall, result, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      contents: [
        {
          parts: [{ text: originalMessage }]
        },
        {
          parts: [{
            functionCall: {
              name: functionCall.name,
              args: functionCall.args
            }
          }]
        },
        {
          parts: [{
            functionResponse: {
              name: functionCall.name,
              response: result
            }
          }]
        }
      ],
      tools: [{
        function_declarations: tools
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.0-flash:generateContent',
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
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

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
