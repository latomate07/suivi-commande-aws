import { DynamoDBStreamHandler } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';

const eb = new EventBridgeClient({});
const EVENT_BUS = process.env.EVENT_BUS_NAME!;
const EVENT_SOURCE = process.env.EVENT_SOURCE!;

export const handler: DynamoDBStreamHandler = async (event) => {
    const entries = event.Records
        .filter(r => r.eventName === 'INSERT' || r.eventName === 'MODIFY')
        .flatMap(record => {
            const newImage = record.dynamodb?.NewImage;
            if (!newImage) return [];
            const item = unmarshall(newImage as Record<string, AttributeValue>);
            const detailType = record.eventName === 'INSERT' ? 'OrderCreated' : 'OrderStatusChanged';
            return [{
                EventBusName: EVENT_BUS,
                Source: EVENT_SOURCE,
                DetailType: detailType,
                Detail: JSON.stringify(item),
            }];
        });

    if (entries.length === 0) return;

    const result = await eb.send(new PutEventsCommand({ Entries: entries }));

    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        console.error(JSON.stringify({ level: 'ERROR', msg: 'PutEvents partial failure', result }));
        throw new Error(`EventBridge PutEvents: ${result.FailedEntryCount} failed`);
    }

    console.log(JSON.stringify({ level: 'INFO', msg: 'Events published', count: entries.length }));
};
