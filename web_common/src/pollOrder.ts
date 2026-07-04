import { Order } from './types';

/** Intervalle de polling par défaut — modifier cette valeur pour changer globalement */
export const POLL_INTERVAL_MS = 5_000;

export interface PollOrderOptions {
    /** Intervalle entre deux polls en ms (défaut : POLL_INTERVAL_MS) */
    interval?: number;
    /** Appelé à chaque erreur réseau ou HTTP */
    onError?: (err: Error) => void;
}

/**
 * Lance un polling périodique sur GET /track/{orderId}.
 * Appelle onUpdate à chaque réponse réussie.
 * Retourne une fonction stop() à appeler pour arrêter le polling.
 */
export function pollOrder(
    orderId: string,
    apiUrl: string,
    onUpdate: (order: Order) => void,
    options?: PollOrderOptions,
): () => void {
    const interval = options?.interval ?? POLL_INTERVAL_MS;
    let active = true;

    const tick = async () => {
        if (!active) return;
        try {
            const res = await fetch(`${apiUrl}/track/${orderId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: Order = await res.json();
            if (active) onUpdate(data);
        } catch (err) {
            if (active) options?.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    };

    tick();
    const id = setInterval(tick, interval);

    return () => {
        active = false;
        clearInterval(id);
    };
}
