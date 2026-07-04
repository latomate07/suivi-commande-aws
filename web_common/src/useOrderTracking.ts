import { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from './types';
import { pollOrder, POLL_INTERVAL_MS } from './pollOrder';

export interface UseOrderTrackingOptions {
    /** Intervalle de polling en ms (défaut : POLL_INTERVAL_MS = 5 s) */
    interval?: number;
}

export interface UseOrderTrackingResult {
    order: Order | null;
    status: OrderStatus | null;
    loading: boolean;
    error: string | null;
}

export function useOrderTracking(
    orderId: string | null,
    apiUrl: string,
    options?: UseOrderTrackingOptions,
): UseOrderTrackingResult {
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    useEffect(() => {
        if (!orderId) {
            setOrder(null);
            setError(null);
            return;
        }

        setLoading(true);

        const stop = pollOrder(orderId, apiUrl, (data) => {
            setOrder(data);
            setError(null);
            setLoading(false);
        }, {
            interval: optionsRef.current?.interval ?? POLL_INTERVAL_MS,
            onError: (err) => {
                setError(err.message);
                setLoading(false);
            },
        });

        return stop;
    }, [orderId, apiUrl]);

    return { order, status: order?.status ?? null, loading, error };
}
