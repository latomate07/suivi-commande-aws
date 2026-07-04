import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    const connectionId = event.requestContext.connectionId;

    await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { connectionId },
    }));

    console.log(JSON.stringify({ level: 'INFO', event: 'disconnect', connectionId }));
    return { statusCode: 200, body: 'Disconnected' };
};
