import assert from 'node:assert';
import { describe, it } from 'vitest';
import { isValidEntityPhrase } from './entity-phrase.js';
describe('isValidEntityPhrase', () => {
    it('rejects mid-clause fragments', () => {
        assert.strictEqual(isValidEntityPhrase('will have the right to sell to B'), false);
        assert.strictEqual(isValidEntityPhrase('is under no obligation to sell any securities to B'), false);
        assert.strictEqual(isValidEntityPhrase('Gelesis Holdings, Inc.'), true);
        assert.strictEqual(isValidEntityPhrase(null), false);
    });
});
//# sourceMappingURL=entity-phrase.test.js.map