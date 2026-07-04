import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export const handler: APIGatewayProxyHandler = async (event) => {
    const orderId = event.pathParameters?.orderId;
    if (!orderId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ message: 'orderId requis' }) };
    }

    const result = await ddb.send(new GetCommand({
        TableName: process.env.ORDERS_TABLE!,
        Key: { orderId },
    }));

    if (!result.Item) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ message: 'Commande introuvable' }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(result.Item) };
};
