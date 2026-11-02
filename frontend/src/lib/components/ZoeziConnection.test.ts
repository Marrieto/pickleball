import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ZoeziConnection from './ZoeziConnection.svelte';
import { ZoeziApiError, zoeziApi } from '$lib/zoezi/api';
import { ZOEZI_ORIGIN, type ZoeziImport } from '$lib/zoezi/import';

vi.mock('$lib/zoezi/api', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/zoezi/api')>(),
	zoeziApi: { status: vi.fn(), login: vi.fn(), logout: vi.fn(), workouts: vi.fn(), participants: vi.fn() }
}));

const workout = { id: 266, title: 'Pickleball', startTime: '2026-11-02 18:00:00' };
const payload: ZoeziImport = { version: 1, origin: ZOEZI_ORIGIN, workout, participants: [{ id: 18, name: 'Alice' }] };
beforeEach(() => {
	vi.mocked(zoeziApi.status).mockResolvedValue({ enabled: true, authenticated: false });
	vi.mocked(zoeziApi.login).mockResolvedValue();
	vi.mocked(zoeziApi.logout).mockResolvedValue();
	vi.mocked(zoeziApi.workouts).mockResolvedValue([workout]);
	vi.mocked(zoeziApi.participants).mockResolvedValue(payload);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

test('logs in, clears the password, previews participants and disconnects without starting a tournament', async () => {
	const onpreview = vi.fn(), ondisconnect = vi.fn();
	render(ZoeziConnection, { onpreview, ondisconnect });
	await fireEvent.input(await screen.findByLabelText('Zoezi email or username'), { target: { value: 'alice@example.test' } });
	const password = screen.getByLabelText('Zoezi password') as HTMLInputElement;
	await fireEvent.input(password, { target: { value: 'test-password' } });
	await fireEvent.click(screen.getByRole('button', { name: 'Log in to Zoezi' }));
	await screen.findByRole('button', { name: 'Preview participants' });
	expect(password.value).toBe('');
	expect(zoeziApi.login).toHaveBeenCalledWith('alice@example.test', 'test-password', expect.any(AbortSignal));
	await fireEvent.click(screen.getByRole('button', { name: 'Preview participants' }));
	await waitFor(() => expect(onpreview).toHaveBeenLastCalledWith(payload));
	await fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
	await screen.findByRole('button', { name: 'Log in to Zoezi' });
	expect(ondisconnect).toHaveBeenCalledOnce();
});

test('clears imported previews when the Zoezi session expires', async () => {
	vi.mocked(zoeziApi.status).mockResolvedValue({ enabled: true, authenticated: true });
	vi.mocked(zoeziApi.participants).mockRejectedValue(new ZoeziApiError(401, 'Log in to Zoezi again.'));
	const onpreview = vi.fn(), ondisconnect = vi.fn();
	render(ZoeziConnection, { onpreview, ondisconnect });
	await fireEvent.click(await screen.findByRole('button', { name: 'Preview participants' }));
	await screen.findByRole('button', { name: 'Log in to Zoezi' });
	expect(ondisconnect).toHaveBeenCalledOnce();
	expect(onpreview).toHaveBeenLastCalledWith(null);
	expect(screen.getByRole('alert').textContent).toContain('Log in to Zoezi again.');
});

test('discards an old response after the selected date changes', async () => {
	vi.mocked(zoeziApi.status).mockResolvedValue({ enabled: true, authenticated: true });
	let finish!: (value: typeof payload) => void;
	vi.mocked(zoeziApi.participants).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
	const onpreview = vi.fn();
	render(ZoeziConnection, { onpreview, ondisconnect: vi.fn() });
	await fireEvent.click(await screen.findByRole('button', { name: 'Preview participants' }));
	await fireEvent.input(screen.getByLabelText('Session date'), { target: { value: '2026-11-03' } });
	await fireEvent.change(screen.getByLabelText('Session date'));
	await waitFor(() => expect(zoeziApi.workouts).toHaveBeenLastCalledWith('2026-11-03', expect.any(AbortSignal)));
	finish(payload);
	await new Promise(resolve => setTimeout(resolve, 0));
	expect(onpreview).not.toHaveBeenCalledWith(payload);
});
