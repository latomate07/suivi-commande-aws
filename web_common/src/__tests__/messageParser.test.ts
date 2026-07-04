import { parseMessage } from '../OrderWebSocketClient';

describe('parseMessage', () => {
    it('parses a valid OrderCreated event', () => {
        const raw = JSON.stringify({
            type: 'OrderCreated',
            orderId: 'PRD-001',
            status: 'preparation',
            previousStatus: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
        const result = parseMessage(raw);
        expect(result?.type).toBe('OrderCreated');
        expect(result?.orderId).toBe('PRD-001');
    });

    it('parses a valid OrderStatusChanged event', () => {
        const raw = JSON.stringify({
            type: 'OrderStatusChanged',
            orderId: 'PRD-001',
            status: 'expedie',
            previousStatus: 'preparation',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T01:00:00.000Z',
        });
        const result = parseMessage(raw);
        expect(result?.type).toBe('OrderStatusChanged');
        expect(result?.orderId).toBe('PRD-001');
    });

    it('returns null for invalid JSON', () => {
        expect(parseMessage('not { valid json')).toBeNull();
    });

    it('returns null for unknown event type', () => {
        expect(parseMessage(JSON.stringify({ type: 'UnknownEvent', orderId: 'x' }))).toBeNull();
    });

    it('returns null when orderId is missing', () => {
        expect(parseMessage(JSON.stringify({ type: 'OrderCreated' }))).toBeNull();
    });

    it('returns null for non-string orderId', () => {
        expect(parseMessage(JSON.stringify({ type: 'OrderCreated', orderId: 42 }))).toBeNull();
    });

    it('returns null for null input', () => {
        expect(parseMessage(null)).toBeNull();
    });

    it('returns null for non-object input', () => {
        expect(parseMessage('"just a string"')).toBeNull();
    });
});
