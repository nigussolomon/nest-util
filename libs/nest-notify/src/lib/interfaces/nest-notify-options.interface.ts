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
    };
  };
}
