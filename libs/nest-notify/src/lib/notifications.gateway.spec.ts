import type { Server, Socket } from 'socket.io';
import { createNotifyGateway } from './notifications.gateway';
import { NOTIFY_GATEWAY } from './constants';

type Handshake = {
  auth: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
};

type MockClient = {
  handshake: Handshake;
  data: Record<string, unknown>;
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

interface GatewayHarness {
  gateway: {
    server?: Partial<Server>;
    handleConnection: (client: unknown) => Promise<void>;
    handleDisconnect: (client: unknown) => void;
    emitToUser: (userId: string, event: string, payload: unknown) => void;
  };
  jwtService: { verifyAsync: jest.Mock };
  authService: { validateUser: jest.Mock };
}

const buildGateway = (
  socketOptions: Record<string, unknown>,
  jwtService?: { verifyAsync: jest.Mock },
  authService?: { validateUser: jest.Mock }
): GatewayHarness => {
  const Gateway = createNotifyGateway({} as never);
  const instance = new Gateway(
    { socket: socketOptions } as never,
    (jwtService ?? { verifyAsync: jest.fn() }) as never,
    (authService ?? { validateUser: jest.fn() }) as never
  );
  return {
    gateway: instance as unknown as GatewayHarness['gateway'],
    jwtService: (jwtService ?? { verifyAsync: jest.fn() }) as never,
    authService: (authService ?? { validateUser: jest.fn() }) as never,
  };
};

const makeClient = (): MockClient => ({
  handshake: { auth: {}, query: {}, headers: {} },
  data: {},
  join: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
});

describe('notifications.gateway', () => {
  describe('handleConnection', () => {
    it('authenticates via JwtService + AuthService and joins the user room', async () => {
      const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1', nonce: 'n1' }) };
      const authService = { validateUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
      const { gateway } = buildGateway({ enable: true }, jwtService, authService);

      const client = makeClient();
      client.handshake.auth.token = 'jwt-token';

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('jwt-token');
      expect(authService.validateUser).toHaveBeenCalledWith({ sub: 'u1', nonce: 'n1' });
      expect(client.join).toHaveBeenCalledWith('notify:u1');
      expect(client.data.userId).toBe('u1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('uses the custom authorize callback when provided', async () => {
      const authorize = jest.fn().mockResolvedValue({ userId: 'u2' });
      const jwtService = { verifyAsync: jest.fn() };
      const { gateway } = buildGateway({ enable: true, authorize }, jwtService);

      const client = makeClient();
      client.handshake.query.token = 'custom-token';

      await gateway.handleConnection(client as unknown as Socket);

      expect(authorize).toHaveBeenCalledWith('custom-token');
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('notify:u2');
    });

    it('reads the token from the Authorization header', async () => {
      const jwtService = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u3', nonce: 'n3' }) };
      const authService = { validateUser: jest.fn().mockResolvedValue({ id: 'u3' }) };
      const { gateway } = buildGateway({ enable: true }, jwtService, authService);

      const client = makeClient();
      client.handshake.headers.authorization = 'Bearer header-token';

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token');
    });

    it('disconnects when no token is provided', async () => {
      const jwtService = { verifyAsync: jest.fn() };
      const { gateway } = buildGateway({ enable: true }, jwtService);

      const client = makeClient();

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized' });
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when the socket is disabled', async () => {
      const { gateway } = buildGateway({ enable: false });

      const client = makeClient();
      client.handshake.auth.token = 'jwt-token';

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when auth fails', async () => {
      const jwtService = { verifyAsync: jest.fn().mockRejectedValue(new Error('expired')) };
      const { gateway } = buildGateway({ enable: true }, jwtService);

      const client = makeClient();
      client.handshake.auth.token = 'bad-token';

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized' });
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw when no user is attached', () => {
      const { gateway } = buildGateway({ enable: true });
      const client = makeClient();
      expect(() => gateway.handleDisconnect(client as unknown as Socket)).not.toThrow();
    });
  });

  describe('emitToUser', () => {
    it('emits the payload to the user room', () => {
      const { gateway } = buildGateway({ enable: true });
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as Partial<Server>;

      const payload = { id: 'n1', title: 'Hi' };
      gateway.emitToUser('u1', 'notification:created', payload);

      expect(to).toHaveBeenCalledWith('notify:u1');
      expect(emit).toHaveBeenCalledWith('notification:created', payload);
    });

    it('is a no-op when the socket server is not initialized', () => {
      const { gateway } = buildGateway({ enable: true });
      expect(() => gateway.emitToUser('u1', 'notification:created', {})).not.toThrow();
    });
  });

  it('exposes the NOTIFY_GATEWAY token', () => {
    expect(NOTIFY_GATEWAY).toBe('NOTIFY_GATEWAY');
  });

  it('marks the built class as a NestJS websocket gateway', () => {
    const Gateway = createNotifyGateway({} as never);
    expect(Reflect.getMetadata('websockets:is_gateway', Gateway)).toBe(true);
    const options = Reflect.getMetadata('websockets:gateway_options', Gateway) as Record<string, unknown>;
    expect(options.namespace).toBe('/notify');
    expect(options.path).toBe('/socket.io');
  });

  it('uses the configured namespace and path', () => {
    const Gateway = createNotifyGateway({
      socket: { namespace: '/my-notify', path: '/ws' },
    } as never);
    const options = Reflect.getMetadata('websockets:gateway_options', Gateway) as Record<string, unknown>;
    expect(options.namespace).toBe('/my-notify');
    expect(options.path).toBe('/ws');
  });
});
