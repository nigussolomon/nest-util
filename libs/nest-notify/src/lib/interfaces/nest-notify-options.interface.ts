/**
 * Options for the `@nest-util/nest-notify` module.
 */
export interface NestNotifyOptions {
  /** Firebase Cloud Messaging (push) configuration */
  fcm?: {
    /** Enable push notifications. Default: false */
    enabled?: boolean;
    /**
     * An already-initialized `firebase-admin` App instance.
     * Either provide `app` OR the service-account fields below.
     */
    app?: unknown;
    /** Firebase project ID (service account) */
    projectId?: string;
    /** Firebase service account client email */
    clientEmail?: string;
    /** Firebase service account private key */
    privateKey?: string;
  };

  /** SMTP email configuration */
  smtp?: {
    /** Enable email notifications. Default: false */
    enabled?: boolean;
    /**
     * A pre-built nodemailer transport.
     * Either provide `transport` OR `host`/`port` (+ `user`/`pass`).
     */
    transport?: unknown;
    /** SMTP host */
    host?: string;
    /** SMTP port */
    port?: number;
    /** Use TLS. Default: false */
    secure?: boolean;
    /** SMTP username (auth) */
    user?: string;
    /** SMTP password (auth) */
    pass?: string;
    /** Default sender */
    from?: { name?: string; address: string };
  };

  /** Real-time Socket.IO gateway configuration */
  socket?: {
    /** Enable the notifications gateway. Default: false */
    enable?: boolean;
    /** Socket.IO namespace. Default: '/notify' */
    namespace?: string;
    /** Socket.IO path. Default: '/socket.io' */
    path?: string;
    /** Socket.IO CORS options */
    cors?: {
      origin?: string | string[] | RegExp;
      credentials?: boolean;
      methods?: string[];
    };
    /**
     * Handshake field carrying the bearer token.
     * Checked as `handshake.auth[tokenQueryParam]`, then `handshake.query[tokenQueryParam]`.
     * Default: 'token'
     */
    tokenQueryParam?: string;
    /**
     * Custom handshake authenticator. When provided, it takes precedence over the
     * default JWT verification (which requires `@nest-util/nest-auth` + `@nestjs/jwt`).
     * Return `null` to reject the connection.
     */
    authorize?: (token: string) => Promise<{ userId: string } | null>;
  };

  /** Auto-registered controller configuration */
  controller?: {
    /** Enable the auto-registered controller. Default: true */
    enable?: boolean;
    /** Controller route prefix. Default: 'notify' */
    path?: string;
    /** RBAC permission keys */
    permissions?: {
      devices?: string;
      push?: string;
      email?: string;
      history?: string;
      mine?: string;
    };
  };
}
