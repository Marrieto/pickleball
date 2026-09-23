/**
 * crypto.randomUUID is only defined in secure contexts (HTTPS or localhost).
 * This app is often opened over plain HTTP on a LAN IP (a phone hitting the
 * Docker host courtside), so fall back to a non-cryptographic UUID there.
 */
export function makeId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
