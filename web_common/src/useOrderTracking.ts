import { useEffect, useRef, useState } from 'react';
import { OrderWebSocketClient, OrderWebSocketClientConfig } from './OrderWebSocketClient';
import { ConnectionState, OrderEvent, OrderStatus } from './types';

export interface UseOrderTrackingResult {
    connectionState: ConnectionState;
    lastEvent: OrderEvent | null;
    status: OrderStatus | null;
}

export function useOrderTracking(
    orderId: string | null,
    wsUrl: string,
    options?: Pick<OrderWebSocketClientConfig, 'maxRetries' | 'maxDelay' | 'heartbeatInterval'>,
): UseOrderTrackingResult {
    const [connectionState, setConnectionState] = useState<ConnectionState>('closed');
    const [lastEvent, setLastEvent] = useState<OrderEvent | null>(null);
    const [status, setStatus] = useState<OrderStatus | null>(null);
    // Keep options in a ref so changes don't re-trigger the effect (no reconnect on option change)
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        if (!orderId) return;

        const client = new OrderWebSocketClient({ wsUrl, ...optionsRef.current });
        const unsubState = client.onStateChange(setConnectionState);
        const unsubMsg = client.onMessage((evt) => {
            setLastEvent(evt);
            setStatus(evt.status);
        });

        client.connect(orderId);

        return () => {
            unsubState();
            unsubMsg();
            client.disconnect();
        };
    }, [orderId, wsUrl]);

    return { connectionState, lastEvent, status };
}
