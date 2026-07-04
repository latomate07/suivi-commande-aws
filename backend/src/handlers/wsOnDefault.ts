import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';

// Handles incoming messages from clients (heartbeat pings, future use).
export const handler: APIGatewayProxyWebsocketHandlerV2 = async () => ({
    statusCode: 200,
    body: 'OK',
});
