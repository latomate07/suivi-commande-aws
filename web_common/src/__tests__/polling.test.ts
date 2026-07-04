import { pollOrder, POLL_INTERVAL_MS } from '../pollOrder';
import { Order } from '../types';

const MOCK_ORDER: Order = {
    orderId: 'CMD-001',
    status: 'preparation',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

const okResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
});

// Promise.resolve() n'est pas affecté par les fake timers — flush la microtask queue
const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('POLL_INTERVAL_MS', () => {
    it('exports a positive default interval', () => {
        expect(POLL_INTERVAL_MS).toBeGreaterThan(0);
    });
});

describe('pollOrder', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (global as unknown as { fetch: jest.Mock }).fetch = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('calls fetch immediately with the right URL', () => {
        (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // ne résout pas
        pollOrder('CMD-001', 'https://api', jest.fn());
        expect(global.fetch).toHaveBeenCalledWith('https://api/track/CMD-001');
    });

    it('calls onUpdate with the parsed order on success', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(okResponse(MOCK_ORDER));
        const onUpdate = jest.fn();

        pollOrder('CMD-001', 'https://api', onUpdate);
        await flush();

        expect(onUpdate).toHaveBeenCalledWith(MOCK_ORDER);
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('polls again after the configured interval', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(okResponse(MOCK_ORDER));

        pollOrder('CMD-001', 'https://api', jest.fn(), { interval: 3_000 });
        await flush();
        expect(global.fetch).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(3_000);
        await flush();
        expect(global.fetch).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(3_000);
        await flush();
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('stops polling after stop() is called', async () => {
        (global.fetch as jest.Mock).mockResolvedValue(okResponse(MOCK_ORDER));

        const stop = pollOrder('CMD-001', 'https://api', jest.fn(), { interval: 3_000 });
        await flush();
        stop();

        jest.advanceTimersByTime(9_000);
        await flush();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('calls onError on network failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
        const onError = jest.fn();

        pollOrder('CMD-001', 'https://api', jest.fn(), { onError });
        await flush();

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Network error' }));
    });

    it('calls onError on non-ok HTTP status', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
        const onError = jest.fn();

        pollOrder('CMD-001', 'https://api', jest.fn(), { onError });
        await flush();

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'HTTP 404' }));
    });

    it('does not call onUpdate after stop()', async () => {
        let resolveFirst!: (v: unknown) => void;
        (global.fetch as jest.Mock).mockReturnValueOnce(
            new Promise(resolve => { resolveFirst = resolve; }),
        );

        const onUpdate = jest.fn();
        const stop = pollOrder('CMD-001', 'https://api', onUpdate);
        stop(); // stop avant que fetch ne résout

        resolveFirst(okResponse(MOCK_ORDER));
        await flush();

        expect(onUpdate).not.toHaveBeenCalled();
    });
});
