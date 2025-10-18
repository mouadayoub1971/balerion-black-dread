// Get History - Retrieve conversation history from DynamoDB
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    // Get sessionId from path parameters
    const sessionId = event.pathParameters?.sessionId;

    // Validate input
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Missing sessionId in path parameters' })
      };
    }

    // Query DynamoDB for all messages in this session
    const result = await dynamodb.query({
      TableName: process.env.DYNAMODB_TABLE || 'ChatMessages',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      },
      ScanIndexForward: true // Sort by timestamp ascending (oldest first)
    }).promise();

    // Format the messages for frontend consumption
    const messages = result.Items.map(item => {
      if (item.type === 'chat') {
        return {
          type: 'chat',
          timestamp: item.timestamp,
          userMessage: item.userMessage,
          aiResponse: item.aiResponse
        };
      } else if (item.type === 'image') {
        return {
          type: 'image',
          timestamp: item.timestamp,
          prompt: item.prompt,
          imageKey: item.imageKey,
          filename: item.filename
        };
      }
      return item;
    });

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessionId,
        messageCount: messages.length,
        messages
      })
    };
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to retrieve chat history',
        details: error.message
      })
    };
  }
};
