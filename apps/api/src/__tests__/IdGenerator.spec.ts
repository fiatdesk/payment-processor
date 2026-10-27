// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { GenerateId, GenerateToken } from '../utils/IdGenerator';

describe('IdGenerator', () => {
  describe('GenerateId', () => {
    it('should insert the brand id infix after the prefix', () => {
      expect(GenerateId('po')).toMatch(/^po_fd_[0-9A-Za-z]{16}$/);
      expect(GenerateId('acct')).toMatch(/^acct_fd_/);
    });

    it('should keep multi-part prefixes and honour the length', () => {
      expect(GenerateId('sk_live', 99)).toMatch(/^sk_live_fd_[0-9A-Za-z]{99}$/);
      expect(GenerateId('al', 32)).toMatch(/^al_fd_[0-9A-Za-z]{32}$/);
    });

    it('should return a different id on each call', () => {
      expect(GenerateId('po')).not.toBe(GenerateId('po'));
    });
  });

  describe('GenerateToken', () => {
    it('should not insert the brand id infix', () => {
      expect(GenerateToken('req')).toMatch(/^req_[0-9A-Za-z]{16}$/);
      expect(GenerateToken('pi_fd_abc_secret', 24)).toMatch(
        /^pi_fd_abc_secret_[0-9A-Za-z]{24}$/
      );
    });
  });
});
