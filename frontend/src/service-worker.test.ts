import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('$service-worker', () => ({ build: ['/asset.js'], files: [], version: 'test' }));

let fetchHandler: (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void;
const put = vi.fn();
beforeEach(async () => {
	vi.resetModules();
	vi.stubGlobal('self', {
		location: { origin: 'https://pickleball.example' },
		addEventListener: (type: string, handler: typeof fetchHandler) => { if (type === 'fetch') fetchHandler = handler; }
	});
	vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn(), put }) });
	await import('./service-worker');
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('never intercepts Zoezi API requests, including under a deployment base path', () => {
	for (const path of ['/api/zoezi/status', '/api/zoezi/workouts/266/participants', '/pickleball/api/zoezi/status']) {
		const respondWith = vi.fn();
		fetchHandler({ request: new Request(`https://pickleball.example${path}`), respondWith });
		expect(respondWith).not.toHaveBeenCalled();
	}
});

test('does not cache no-store responses while still returning the network response', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private', { headers: { 'cache-control': 'no-store' } })));
	let result!: Promise<Response>;
	fetchHandler({ request: new Request('https://pickleball.example/private'), respondWith: response => { result = response; } });
	expect(await (await result).text()).toBe('private');
	expect(put).not.toHaveBeenCalled();
});
