import { describe, expect, test } from 'vitest';
import { makeId } from './id';

describe('makeId', () => {
	test('returns unique ids when crypto.randomUUID is unavailable (insecure context)', () => {
		const original = crypto.randomUUID;
		// @ts-expect-error - simulating plain-HTTP/non-localhost contexts where this is missing
		crypto.randomUUID = undefined;

		try {
			const a = makeId();
			const b = makeId();
			expect(a).not.toBe(b);
			expect(a).toMatch(/^[0-9a-f-]{36}$/);
		} finally {
			crypto.randomUUID = original;
		}
	});
});
