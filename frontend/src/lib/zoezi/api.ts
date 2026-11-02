import { base } from '$app/paths';
import { parseImport, type ZoeziImport } from './import';

export interface Workout { id: number; title: string; startTime: string }
export interface ConnectionStatus { enabled: boolean; authenticated: boolean }

export class ZoeziApiError extends Error {
	constructor(public status: number, message: string) { super(message); }
}

async function request(path: string, signal: AbortSignal, body?: object): Promise<Response> {
	return fetch(`${base}/api/zoezi${path}`, {
		method: body ? 'POST' : 'GET',
		credentials: 'same-origin', cache: 'no-store', signal,
		...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
	});
}

async function json(response: Response) {
	const data = await response.json();
	if (!response.ok) throw new ZoeziApiError(response.status, data.message || 'Could not contact Zoezi. Try again.');
	return data;
}

export const zoeziApi = {
	async status(signal: AbortSignal): Promise<ConnectionStatus> {
		const response = await request('/status', signal);
		// Static hosting returns either a 404 or its HTML app shell for unknown URLs.
		if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) {
			return { enabled: false, authenticated: false };
		}
		return json(response);
	},
	async login(login: string, password: string, signal: AbortSignal): Promise<void> {
		await json(await request('/login', signal, { login, password }));
	},
	async logout(signal: AbortSignal): Promise<void> {
		const response = await request('/logout', signal, {});
		if (!response.ok) await json(response);
	},
	async workouts(date: string, signal: AbortSignal): Promise<Workout[]> {
		const data = await json(await request(`/workouts?date=${encodeURIComponent(date)}`, signal));
		return data.workouts;
	},
	async participants(id: number, signal: AbortSignal): Promise<ZoeziImport> {
		const data = await json(await request(`/workouts/${id}/participants`, signal));
		return parseImport(JSON.stringify(data));
	}
};
