import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const VALID_STATUSES = ['preparation', 'expedie', 'livre', 'annule'] as const;

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

    let body: { status?: string };
    try {
        body = JSON.parse(event.body ?? '{}');
    } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ message: 'Corps JSON invalide' }) };
    }

    const { status } = body;
    if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
        return {
            statusCode: 400,
            headers: CORS,
            body: JSON.stringify({ message: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` }),
        };
    }

    try {
        const result = await ddb.send(new UpdateCommand({
            TableName: process.env.ORDERS_TABLE!,
            Key: { orderId },
            UpdateExpression: 'SET #s = :s, updatedAt = :u',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':s': status, ':u': new Date().toISOString() },
            ConditionExpression: 'attribute_exists(orderId)',
            ReturnValues: 'ALL_NEW',
        }));

        return { statusCode: 200, headers: CORS, body: JSON.stringify(result.Attributes) };
    } catch (err: unknown) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
            return { statusCode: 404, headers: CORS, body: JSON.stringify({ message: 'Commande introuvable' }) };
        }
        throw err;
    }
};
