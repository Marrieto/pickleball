import { afterEach, expect, test, vi } from 'vitest';
import { base } from '$app/paths';
import { zoeziApi, ZoeziApiError } from './api';
import { ZOEZI_ORIGIN } from './import';

const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

test('static hosting keeps manual import when the API returns HTML or a 404', async () => {
	for (const response of [new Response('<html>app shell</html>', { headers: { 'content-type': 'text/html' } }), new Response('', { status: 404 })]) {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		expect(await zoeziApi.status(signal())).toEqual({ enabled: false, authenticated: false });
	}
});

test('uses same-origin credentials and never puts login information in the URL', async () => {
	const fetch = vi.fn().mockResolvedValue(Response.json({ authenticated: true }));
	vi.stubGlobal('fetch', fetch);
	await zoeziApi.login('alice@example.test', 'test-password', signal());
	expect(fetch.mock.calls[0][0]).toBe(`${base}/api/zoezi/login`);
	expect(fetch.mock.calls[0][1]).toMatchObject({
		method: 'POST', credentials: 'same-origin', cache: 'no-store',
		body: JSON.stringify({ login: 'alice@example.test', password: 'test-password' })
	});
});

test('validates imported identities and preserves authentication failures', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
		version: 1, origin: ZOEZI_ORIGIN,
		workout: { id: 266, title: 'Pickleball', startTime: '2026-11-02 18:00:00' },
		participants: [{ id: 18, name: 'Alice' }, { id: 18, name: 'Alice' }]
	})));
	await expect(zoeziApi.participants(266, signal())).rejects.toThrow('repeated member IDs');
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Log in to Zoezi again.' }, { status: 401 })));
	await expect(zoeziApi.workouts('2026-11-02', signal())).rejects.toMatchObject({ status: 401, message: 'Log in to Zoezi again.' });
	expect(new ZoeziApiError(403, 'Permission denied')).toBeInstanceOf(Error);
});
