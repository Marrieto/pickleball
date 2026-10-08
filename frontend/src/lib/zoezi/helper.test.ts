import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import helper from './helper.js.txt?raw';
import { parseImport } from './import';

let root: ShadowRoot;
let fetchMock: ReturnType<typeof vi.fn>;
const sessions = { workouts: [{ id: 266, workoutType: { name: 'Pickleball' }, status: 'Ok', startTime: '2026-10-10 11:00:00', extra_title: 'Drop in', courses: [] }] };
const response = (data: unknown, status = 200) => ({ ok: status === 200, status, json: async () => data });
const button = (label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label)!;
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
async function start() {
	await new Function('location', 'return ' + helper)({ origin: 'https://korpenkalmarpickleballklubb.zoezi.se' });
	root = document.querySelector('#dink-city-zoezi-helper > div')!.shadowRoot!;
}
beforeEach(() => {
	HTMLDialogElement.prototype.showModal = vi.fn();
	fetchMock = vi.fn().mockResolvedValue(response(sessions)); vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('fetches today, previews only confirmed participants, and exports valid data safely', async () => {
	await start();
	expect(fetchMock.mock.calls[0][0]).toMatch(/fromDate=\d{4}-\d{2}-\d{2}&toDate=/);
	fetchMock.mockResolvedValue(response([
		{ id: 18, name: '<img src=x onerror=alert(1)>', booking: true, inQueue: false },
		{ id: 19, name: 'Waiting', booking: true, inQueue: true },
		{ id: 20, name: 'Invitation', booking: false, inQueue: false }
	]));
	button('Preview participants').click(); await flush();
	const output = root.querySelector('textarea')!;
	expect(parseImport(output.value).participants).toEqual([{ id: 18, name: '<img src=x onerror=alert(1)>' }]);
	expect(root.querySelector('img')).toBeNull();
	expect(fetchMock.mock.calls[1][1].credentials).toBe('same-origin');
	button('Copy import data').click(); await flush();
	expect(root.textContent).toContain('Copy the selected text manually');
});

test('explains login failures and never enables copying stale data', async () => {
	await start(); fetchMock.mockResolvedValue(response({}, 401));
	button('Preview participants').click(); await flush();
	expect(root.textContent).toContain('Log in to Zoezi');
	expect(button('Copy import data').disabled).toBe(true);
});

test('handles an empty date and discards responses for a previous session selection', async () => {
	await start();
	let resolve!: (value: unknown) => void;
	fetchMock.mockReturnValueOnce(new Promise(r => { resolve = r; }));
	button('Preview participants').click();
	fetchMock.mockResolvedValue(response({ workouts: [] }));
	button('Find sessions').click(); await flush();
	resolve(response([{ id: 18, name: 'Stale', booking: true, inQueue: false }])); await flush();
	expect(root.textContent).toContain('No pickleball sessions');
	expect(root.querySelector('textarea')!.value).toBe('');
	expect(button('Preview participants').disabled).toBe(true);
});
