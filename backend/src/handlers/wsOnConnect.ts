import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE!;
const TTL_SECONDS = parseInt(process.env.CONNECTION_TTL_SECONDS ?? '7200', 10);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;
    const orderId = event.queryStringParameters?.orderId;

    if (!orderId) {
        console.warn(JSON.stringify({ level: 'WARN', msg: 'Missing orderId', connectionId }));
        return { statusCode: 400, body: 'Missing orderId query parameter' };
    }

    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { connectionId, orderId, ttl },
    }));

    console.log(JSON.stringify({ level: 'INFO', event: 'connect', connectionId, orderId }));
    return { statusCode: 200, body: 'Connected' };
};
