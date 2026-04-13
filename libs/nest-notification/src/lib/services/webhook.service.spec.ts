import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { NOTIFICATION_MODULE_OPTIONS } from '../constants/notification.constants';

describe('WebhookService', () => {
  let service: WebhookService;

  const mockFetch = jest.fn();

  beforeEach(async () => {
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: {
            webhook: {
              secret: 'my-secret',
              timeoutMs: 3000,
            },
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should POST payload to the target URL', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await service.send({
      url: 'https://example.com/hook',
      payload: { event: 'user.created', userId: '42' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ event: 'user.created', userId: '42' }),
      })
    );
  });

  it('should include X-Webhook-Secret header when secret is configured', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await service.send({ url: 'https://example.com/hook', payload: {} });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers['X-Webhook-Secret']).toBe('my-secret');
  });

  it('should merge custom headers', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await service.send({
      url: 'https://example.com/hook',
      payload: {},
      headers: { 'X-Custom': 'value' },
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers['X-Custom']).toBe('value');
  });

  it('should throw when response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      service.send({ url: 'https://example.com/hook', payload: {} })
    ).rejects.toThrow('Webhook request failed with status 500');
  });

  it('should reject non-http/https protocols', async () => {
    await expect(
      service.send({ url: 'file:///etc/passwd', payload: {} })
    ).rejects.toThrow('Webhook URL must use http or https protocol');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should reject invalid URLs', async () => {
    await expect(
      service.send({ url: 'not-a-url', payload: {} })
    ).rejects.toThrow('Invalid webhook URL');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should reject hosts not in allowedHosts when configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: {
            webhook: {
              allowedHosts: ['hooks.allowed.com'],
            },
          },
        },
      ],
    }).compile();

    const restrictedService = module.get<WebhookService>(WebhookService);

    await expect(
      restrictedService.send({ url: 'https://evil.com/hook', payload: {} })
    ).rejects.toThrow('not in the allowed list');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should allow hosts in the allowedHosts list', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: NOTIFICATION_MODULE_OPTIONS,
          useValue: {
            webhook: {
              allowedHosts: ['hooks.allowed.com'],
            },
          },
        },
      ],
    }).compile();

    const restrictedService = module.get<WebhookService>(WebhookService);

    await expect(
      restrictedService.send({ url: 'https://hooks.allowed.com/event', payload: {} })
    ).resolves.not.toThrow();
  });
});
