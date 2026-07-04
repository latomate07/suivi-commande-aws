import { ConnectionState, OrderEvent } from './types';

export type { ConnectionState, OrderEvent };

export interface OrderWebSocketClientConfig {
    wsUrl: string;
    maxRetries?: number;
    maxDelay?: number;
    heartbeatInterval?: number;
}

type MessageCallback = (event: OrderEvent) => void;
type StateCallback = (state: ConnectionState) => void;

export function parseMessage(raw: unknown): OrderEvent | null {
    try {
        const data = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
        if (typeof data !== 'object' || data === null) return null;
        const d = data as Record<string, unknown>;
        if (d['type'] !== 'OrderCreated' && d['type'] !== 'OrderStatusChanged') return null;
        if (typeof d['orderId'] !== 'string') return null;
        return data as OrderEvent;
    } catch {
        return null;
    }
}

// Returns delay in ms for the given attempt (1-based).
// Signature allows passing a fixed `random` value for deterministic tests.
export function computeBackoff(attempt: number, maxDelay: number, random = Math.random()): number {
    const base = Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
    return base + random * 1000;
}

export class OrderWebSocketClient {
    private ws: WebSocket | null = null;
    private orderId: string | null = null;
    private readonly cfg: Required<OrderWebSocketClientConfig>;
    private retryCount = 0;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private messageCallbacks: MessageCallback[] = [];
    private stateCallbacks: StateCallback[] = [];
    private _state: ConnectionState = 'closed';
    private aborted = false;

    constructor(config: OrderWebSocketClientConfig) {
        this.cfg = {
            maxRetries: 10,
            maxDelay: 30_000,
            heartbeatInterval: 9 * 60 * 1000,
            ...config,
        };
    }

    get state(): ConnectionState {
        return this._state;
    }

    onMessage(cb: MessageCallback): () => void {
        this.messageCallbacks.push(cb);
        return () => { this.messageCallbacks = this.messageCallbacks.filter(c => c !== cb); };
    }

    onStateChange(cb: StateCallback): () => void {
        this.stateCallbacks.push(cb);
        return () => { this.stateCallbacks = this.stateCallbacks.filter(c => c !== cb); };
    }

    connect(orderId: string): void {
        this.orderId = orderId;
        this.aborted = false;
        this.retryCount = 0;
        this.openConnection();
    }

    disconnect(): void {
        this.aborted = true;
        this.clearTimers();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setState('closed');
    }

    private openConnection(): void {
        if (this.aborted || !this.orderId) return;

        const url = `${this.cfg.wsUrl}?orderId=${encodeURIComponent(this.orderId)}`;
        this.setState(this.retryCount === 0 ? 'connecting' : 'reconnecting');

        const ws = new WebSocket(url);
        this.ws = ws;

        ws.onopen = () => {
            this.retryCount = 0;
            this.setState('open');
            this.startHeartbeat();
        };

        ws.onmessage = (evt) => {
            const parsed = parseMessage(evt.data as unknown);
            if (parsed) this.messageCallbacks.forEach(cb => cb(parsed));
        };

        ws.onerror = () => { /* onclose fires right after */ };

        ws.onclose = () => {
            this.clearHeartbeat();
            if (!this.aborted) this.scheduleReconnect();
        };
    }

    private scheduleReconnect(): void {
        if (this.retryCount >= this.cfg.maxRetries) {
            this.setState('closed');
            return;
        }
        this.retryCount++;
        this.setState('reconnecting');
        const delay = computeBackoff(this.retryCount, this.cfg.maxDelay);
        this.retryTimer = setTimeout(() => this.openConnection(), delay);
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ action: 'ping' }));
            }
        }, this.cfg.heartbeatInterval);
    }

    private clearHeartbeat(): void {
        if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    }

    private clearTimers(): void {
        if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
        this.clearHeartbeat();
    }

    private setState(state: ConnectionState): void {
        if (this._state !== state) {
            this._state = state;
            this.stateCallbacks.forEach(cb => cb(state));
        }
    }
}
