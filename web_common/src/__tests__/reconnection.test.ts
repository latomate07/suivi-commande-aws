import { OrderWebSocketClient, computeBackoff } from '../OrderWebSocketClient';
import { ConnectionState } from '../types';

// ── Mock WebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    readonly url: string;
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    sentMessages: string[] = [];

    static instances: MockWebSocket[] = [];

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sentMessages.push(data);
    }

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ type: 'close' } as CloseEvent);
    }

    simulateOpen(): void {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.({ type: 'open' } as Event);
    }

    simulateClose(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ type: 'close' } as CloseEvent);
    }

    simulateMessage(data: string): void {
        this.onmessage?.({ data, type: 'message' } as MessageEvent);
    }
}

// ── computeBackoff unit tests ────────────────────────────────────────────────

describe('computeBackoff', () => {
    it('doubles base delay each attempt', () => {
        expect(computeBackoff(1, 30_000, 0)).toBe(1000);
        expect(computeBackoff(2, 30_000, 0)).toBe(2000);
        expect(computeBackoff(3, 30_000, 0)).toBe(4000);
        expect(computeBackoff(4, 30_000, 0)).toBe(8000);
    });

    it('caps at maxDelay', () => {
        expect(computeBackoff(10, 5000, 0)).toBe(5000);
        expect(computeBackoff(20, 5000, 0)).toBe(5000);
    });

    it('adds jitter proportional to random', () => {
        expect(computeBackoff(1, 30_000, 0.5)).toBe(1500);
        expect(computeBackoff(2, 30_000, 1)).toBe(3000);
    });

    it('jitter is always between 0 and 1000ms', () => {
        const base = computeBackoff(1, 30_000, 0);
        const top = computeBackoff(1, 30_000, 1);
        expect(top - base).toBe(1000);
    });
});

// ── OrderWebSocketClient reconnection tests ──────────────────────────────────

describe('OrderWebSocketClient reconnection', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        MockWebSocket.instances = [];
        (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    });

    afterEach(() => {
        jest.useRealTimers();
        delete (global as unknown as { WebSocket?: unknown }).WebSocket;
    });

    it('connects and transitions to open state', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com' });
        const states: ConnectionState[] = [];
        client.onStateChange(s => states.push(s));

        client.connect('PRD-001');
        expect(states).toContain('connecting');

        MockWebSocket.instances[0].simulateOpen();
        expect(states).toContain('open');
        expect(client.state).toBe('open');

        client.disconnect();
    });

    it('transitions to reconnecting after unexpected close', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com', maxRetries: 3 });
        const states: ConnectionState[] = [];
        client.onStateChange(s => states.push(s));

        client.connect('PRD-001');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateClose();

        expect(states).toContain('reconnecting');
        client.disconnect();
    });

    it('opens a new WebSocket after reconnect delay', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com', maxRetries: 3, maxDelay: 30_000 });
        client.connect('PRD-001');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateClose();

        expect(MockWebSocket.instances.length).toBe(1);
        jest.runAllTimers();
        expect(MockWebSocket.instances.length).toBe(2);

        client.disconnect();
    });

    it('stops reconnecting after maxRetries consecutive failures', () => {
        // maxRetries=2 means: initial attempt + 2 retries = 3 WebSocket instances total
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com', maxRetries: 2, maxDelay: 100 });

        client.connect('PRD-001');

        // Attempt 0 fails without opening
        MockWebSocket.instances[0].simulateClose();
        jest.runAllTimers(); // schedules retry 1

        // Retry 1 fails without opening
        MockWebSocket.instances[1].simulateClose();
        jest.runAllTimers(); // schedules retry 2

        // Retry 2 fails — retryCount now equals maxRetries → closed
        MockWebSocket.instances[2].simulateClose();

        expect(client.state).toBe('closed');
        expect(MockWebSocket.instances.length).toBe(3);
        client.disconnect();
    });

    it('disconnect() stops pending reconnect', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com', maxRetries: 5 });
        client.connect('PRD-001');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateClose();

        client.disconnect();
        jest.runAllTimers();

        expect(MockWebSocket.instances.length).toBe(1);
        expect(client.state).toBe('closed');
    });

    it('emits parsed message events', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com' });
        const received: unknown[] = [];
        client.onMessage(e => received.push(e));

        client.connect('PRD-001');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({
            type: 'OrderStatusChanged',
            orderId: 'PRD-001',
            status: 'expedie',
            previousStatus: 'preparation',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T01:00:00.000Z',
        }));

        expect(received).toHaveLength(1);
        expect((received[0] as { type: string }).type).toBe('OrderStatusChanged');

        client.disconnect();
    });

    it('silently drops invalid messages', () => {
        const client = new OrderWebSocketClient({ wsUrl: 'wss://example.com' });
        const received: unknown[] = [];
        client.onMessage(e => received.push(e));

        client.connect('PRD-001');
        MockWebSocket.instances[0].simulateOpen();
        MockWebSocket.instances[0].simulateMessage('not json');
        MockWebSocket.instances[0].simulateMessage(JSON.stringify({ type: 'Unknown' }));

        expect(received).toHaveLength(0);
        client.disconnect();
    });
});
