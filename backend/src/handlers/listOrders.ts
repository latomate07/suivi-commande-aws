import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

export const handler: APIGatewayProxyHandler = async () => {
    const result = await ddb.send(new ScanCommand({
        TableName: process.env.ORDERS_TABLE!,
    }));

    return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ orders: result.Items ?? [] }),
    };
};
