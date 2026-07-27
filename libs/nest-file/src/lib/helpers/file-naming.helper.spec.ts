import { generateStoredName, generateS3Key } from './file-naming.helper';

describe('file-naming.helper', () => {
  describe('generateStoredName', () => {
    it('should generate stored name with timestamp prefix', () => {
      const result = generateStoredName('test-file.jpg');

      expect(result).toMatch(/^\d+-test-file\.jpg$/);
    });

    it('should sanitize special characters', () => {
      const result = generateStoredName('My Photo (1).jpg');

      expect(result).toMatch(/^\d+-my-photo-1-\.jpg$/);
    });

    it('should handle multiple dashes', () => {
      const result = generateStoredName('test---file.jpg');

      expect(result).toMatch(/^\d+-test-file\.jpg$/);
    });

    it('should lowercase the filename', () => {
      const result = generateStoredName('TestFile.JPG');

      expect(result).toMatch(/^\d+-testfile\.jpg$/);
    });
  });

  describe('generateS3Key', () => {
    it('should generate key with default prefix', () => {
      const result = generateS3Key('123-test-file.jpg');

      expect(result).toBe('uploads/123-test-file.jpg');
    });

    it('should generate key with custom prefix', () => {
      const result = generateS3Key('123-test-file.jpg', 'files');

      expect(result).toBe('files/123-test-file.jpg');
    });

    it('should handle trailing slash in prefix', () => {
      const result = generateS3Key('123-test-file.jpg', 'files/');

      expect(result).toBe('files/123-test-file.jpg');
    });
  });
});
