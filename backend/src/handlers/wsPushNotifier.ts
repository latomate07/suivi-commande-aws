import { SQSHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
    GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE!;

const apigw = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT!,
});

export const handler: SQSHandler = async (event) => {
    const failures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body) as {
                'detail-type': string;
                detail: Record<string, unknown>;
            };

            const orderId = body.detail?.orderId as string | undefined;
            if (!orderId) {
                console.warn(JSON.stringify({ level: 'WARN', msg: 'No orderId in event detail', body }));
                continue;
            }

            const { Items = [] } = await ddb.send(new QueryCommand({
                TableName: TABLE,
                IndexName: 'orderId-index',
                KeyConditionExpression: 'orderId = :oid',
                ExpressionAttributeValues: { ':oid': orderId },
            }));

            if (Items.length === 0) continue;

            const message = Buffer.from(JSON.stringify({
                type: body['detail-type'],
                ...body.detail,
            }));

            await Promise.all(Items.map(async (item) => {
                const connectionId = item.connectionId as string;
                try {
                    await apigw.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: message }));
                    console.log(JSON.stringify({ level: 'INFO', event: 'push', connectionId, orderId }));
                } catch (err) {
                    const isGone = err instanceof GoneException || (err as { statusCode?: number })?.statusCode === 410;
                    if (isGone) {
                        await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { connectionId } }));
                        console.log(JSON.stringify({ level: 'INFO', event: 'stale_removed', connectionId }));
                    } else {
                        console.error(JSON.stringify({ level: 'ERROR', event: 'push_failed', connectionId, err: String(err) }));
                        throw err;
                    }
                }
            }));
        } catch (err) {
            console.error(JSON.stringify({ level: 'ERROR', msg: 'Record processing failed', messageId: record.messageId, err: String(err) }));
            failures.push({ itemIdentifier: record.messageId });
        }
    }

    // ReportBatchItemFailures: only failed messages are retried
    return { batchItemFailures: failures };
};
