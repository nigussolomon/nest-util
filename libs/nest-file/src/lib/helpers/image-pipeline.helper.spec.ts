import {
  isImageMime,
  getMimeTypeExtension,
  IMAGE_MIME_PREFIXES,
} from './image-pipeline.helper';

describe('image-pipeline.helper', () => {
  describe('isImageMime', () => {
    it('should return true for image MIME types', () => {
      expect(isImageMime('image/jpeg')).toBe(true);
      expect(isImageMime('image/png')).toBe(true);
      expect(isImageMime('image/webp')).toBe(true);
      expect(isImageMime('image/gif')).toBe(true);
    });

    it('should return false for non-image MIME types', () => {
      expect(isImageMime('application/pdf')).toBe(false);
      expect(isImageMime('text/plain')).toBe(false);
      expect(isImageMime('video/mp4')).toBe(false);
    });
  });

  describe('getMimeTypeExtension', () => {
    it('should return correct extensions', () => {
      expect(getMimeTypeExtension('image/jpeg')).toBe('jpg');
      expect(getMimeTypeExtension('image/png')).toBe('png');
      expect(getMimeTypeExtension('image/webp')).toBe('webp');
      expect(getMimeTypeExtension('application/pdf')).toBe('pdf');
    });

    it('should return "bin" for unknown types', () => {
      expect(getMimeTypeExtension('unknown/type')).toBe('bin');
    });
  });

  describe('IMAGE_MIME_PREFIXES', () => {
    it('should include image/', () => {
      expect(IMAGE_MIME_PREFIXES).toContain('image/');
    });
  });
});
