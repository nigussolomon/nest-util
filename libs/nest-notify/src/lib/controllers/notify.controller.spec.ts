import { CreateNotifyController } from './notify.controller';
import { AUTH_PERMISSIONS_METADATA_KEY } from '../constants';

describe('CreateNotifyController', () => {
  const mockService = {
    registerDeviceToken: jest.fn(),
    listDeviceTokens: jest.fn(),
    unregisterDeviceToken: jest.fn(),
    push: jest.fn(),
    pushToToken: jest.fn(),
    email: jest.fn(),
    getNotifications: jest.fn(),
  };

  const ControllerClass = CreateNotifyController({
    permissions: {
      devices: 'notify.devices',
      push: 'notify.push',
      email: 'notify.email',
      history: 'notify.history',
    },
  });

  function buildController() {
    return new (ControllerClass as unknown as new (
      ...args: unknown[]
    ) => unknown)(mockService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines all expected handlers', () => {
    const controller = buildController() as Record<string, unknown>;
    expect(controller.registerDevice).toBeDefined();
    expect(controller.listDevices).toBeDefined();
    expect(controller.unregisterDevice).toBeDefined();
    expect(controller.push).toBeDefined();
    expect(controller.email).toBeDefined();
    expect(controller.history).toBeDefined();
  });

  it('applies permission metadata to each route', () => {
    const controller = buildController() as Record<string, (...a: unknown[]) => unknown>;

    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.registerDevice)
    ).toEqual(['notify.devices']);
    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.listDevices)
    ).toEqual(['notify.devices']);
    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.unregisterDevice)
    ).toEqual(['notify.devices']);

    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.push)
    ).toEqual(['notify.push']);
    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.email)
    ).toEqual(['notify.email']);
    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.history)
    ).toEqual(['notify.history']);
  });

  it('does not set permission metadata when no permissions are configured', () => {
    const PlainController = CreateNotifyController();
    const controller = new (PlainController as unknown as new (
      ...args: unknown[]
    ) => unknown)(mockService) as Record<string, (...a: unknown[]) => unknown>;

    expect(
      Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, controller.push)
    ).toBeUndefined();
  });

  it('forwards register device calls with the current user id', async () => {
    const controller = buildController() as Record<string, (...a: unknown[]) => unknown>;
    mockService.registerDeviceToken.mockResolvedValue({ id: 'dt1' });

    const result = await (controller.registerDevice as (...a: unknown[]) => unknown)(
      { id: 42 },
      { token: 't1', platform: 'android' }
    );

    expect(mockService.registerDeviceToken).toHaveBeenCalledWith(
      '42',
      't1',
      'android',
      undefined
    );
    expect(result).toEqual({ id: 'dt1' });
  });

  it('forwards push calls defaulting to the current user', async () => {
    const controller = buildController() as Record<string, (...a: unknown[]) => unknown>;
    mockService.push.mockResolvedValue({ successCount: 1, failureCount: 0, results: [] });

    await (controller.push as (...a: unknown[]) => unknown)(
      { id: 'user-7' },
      { title: 'Hi', body: 'B' }
    );

    expect(mockService.push).toHaveBeenCalledWith('user-7', {
      title: 'Hi',
      body: 'B',
      imageUrl: undefined,
      clickAction: undefined,
      data: undefined,
    });
  });

  it('forwards email calls with the recipient userId', async () => {
    const controller = buildController() as Record<string, (...a: unknown[]) => unknown>;
    mockService.email.mockResolvedValue({ success: true });

    await (controller.email as (...a: unknown[]) => unknown)(
      { id: 'user-7' },
      { userId: 'target-user', to: 'x@example.com', subject: 'S' }
    );

    expect(mockService.email).toHaveBeenCalledWith(
      {
        to: 'x@example.com',
        subject: 'S',
        text: undefined,
        html: undefined,
        cc: undefined,
        bcc: undefined,
        replyTo: undefined,
      },
      'target-user'
    );
  });

  it('forwards history queries scoped to the current user', async () => {
    const controller = buildController() as Record<string, (...a: unknown[]) => unknown>;
    mockService.getNotifications.mockResolvedValue({ data: [], meta: {} });

    await (controller.history as (...a: unknown[]) => unknown)(
      { id: 'user-7' },
      { channel: 'push', page: 2, limit: 10 }
    );

    expect(mockService.getNotifications).toHaveBeenCalledWith({
      userId: 'user-7',
      channel: 'push',
      page: 2,
      limit: 10,
    });
  });
});
