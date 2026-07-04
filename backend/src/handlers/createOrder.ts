import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

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

    const now = new Date().toISOString();
    const item = { orderId, status: 'preparation', createdAt: now, updatedAt: now };

    try {
        await ddb.send(new PutCommand({
            TableName: process.env.ORDERS_TABLE!,
            Item: item,
            ConditionExpression: 'attribute_not_exists(orderId)',
        }));
    } catch (err: unknown) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
            return { statusCode: 409, headers: CORS, body: JSON.stringify({ message: 'Commande déjà existante' }) };
        }
        throw err;
    }

    return { statusCode: 201, headers: CORS, body: JSON.stringify(item) };
};
