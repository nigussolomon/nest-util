import { ChapaProvider } from './chapa.provider';

describe('ChapaProvider', () => {
  let provider: ChapaProvider;

  beforeEach(() => {
    provider = new ChapaProvider('test-secret-key');
  });

  describe('createCheckoutSession', () => {
    it('should throw when API returns non-success', async () => {
      const mockResponse = {
        status: 'error',
        message: 'Invalid API key',
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      await expect(
        provider.createCheckoutSession({
          amount: 200,
          currency: 'ETB',
          customerEmail: 'test@example.com',
        })
      ).rejects.toThrow(/Invalid API key/);
    });

    it('should return checkout URL on success', async () => {
      const mockResponse = {
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/pay/abc123' },
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: async () => mockResponse,
      } as Response);

      const result = await provider.createCheckoutSession({
        amount: 200,
        currency: 'ETB',
        customerEmail: 'test@example.com',
        callbackUrl: 'https://example.com/callback',
        returnUrl: 'https://example.com/return',
      });

      expect(result.checkoutUrl).toBe(
        'https://checkout.chapa.co/pay/abc123'
      );
      expect(result.providerReference).toBeDefined();
      expect(result.metadata?.txRef).toBeDefined();
    });

    it('should include customization when description is provided', async () => {
      let requestBody: Record<string, unknown> = {};

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: async () => ({
          status: 'success',
          data: { checkout_url: 'https://checkout.chapa.co/pay/abc' },
        }),
      } as Response);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn(async (url, opts) => {
        requestBody = JSON.parse((opts as RequestInit).body as string);
        return {
          json: async () => ({
            status: 'success',
            data: { checkout_url: 'https://checkout.chapa.co/pay/abc' },
          }),
        } as Response;
      });

      await provider.createCheckoutSession({
        amount: 100,
        currency: 'ETB',
        customerEmail: 'a@b.com',
        description: 'Test payment',
      });

      expect(requestBody['customization[title]']).toBe('Test payment');
      expect(requestBody['customization[description]']).toBe('Test payment');

      globalThis.fetch = originalFetch;
    });
  });

  describe('getPaymentStatus', () => {
    it('should return null when API call fails', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.getPaymentStatus('tx-ref-123');
      expect(result).toBeNull();
    });

    it('should return null on non-success API response', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        json: async () => ({ status: 'error' }),
      } as Response);

      const result = await provider.getPaymentStatus('tx-ref-123');
      expect(result).toBeNull();
    });

    it('should map chapa status to PaymentStatus', async () => {
      const testCases: [string, string][] = [
        ['success', 'succeeded'],
        ['failed', 'failed'],
        ['pending', 'pending'],
        ['unknown', 'pending'],
      ];

      const mockFetch = jest.fn();
      globalThis.fetch = mockFetch;

      for (const [chapaStatus, expected] of testCases) {
        mockFetch.mockResolvedValueOnce({
          json: async () => ({
            status: 'success',
            data: { status: chapaStatus },
          }),
        } as Response);

        const result = await provider.getPaymentStatus('tx-ref-123');
        expect(result).toBe(expected);
      }
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse chapa callback payload', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          trx_ref: 'tx-ref-456',
          status: 'success',
        })
      );

      const result = await provider.parseWebhookEvent(rawBody, {});

      expect(result.provider).toBe('chapa');
      expect(result.providerPaymentId).toBe('tx-ref-456');
      expect(result.status).toBe('succeeded');
    });

    it('should fallback to ref_id when trx_ref is missing', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({ ref_id: 'ref-999', status: 'success' })
      );

      const result = await provider.parseWebhookEvent(rawBody, {});

      expect(result.providerPaymentId).toBe('ref-999');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should always return true', () => {
      expect(provider.verifyWebhookSignature(Buffer.from(''), {})).toBe(true);
    });
  });
});
