import * as jwt from "@tsndr/cloudflare-worker-jwt";

import {
  ApnsError,
  type ApnsResponseError,
  Errors,
} from "./notification/errors";
import { type Notification, Priority } from "./notification/notification";

// APNS version
const API_VERSION = 3;
const SIGNING_ALGORITHM = "ES256";

// Reset our signing token every 55 minutes as reccomended by Apple
const RESET_TOKEN_INTERVAL_MS = 55 * 60 * 1000;

export enum Host {
  production = "api.push.apple.com",
  development = "api.sandbox.push.apple.com",
}

export interface SigningToken {
  value: string;
  timestamp: number;
}

export interface ApnsOptions {
  team: string;
  signingKey: string;
  keyId: string;
  defaultTopic?: string;
  host?: Host | string;
  requestTimeout?: number;
  keepAlive?: boolean;
}

export class ApnsClient {
  readonly team: string;
  readonly keyId: string;
  readonly host: Host | string;
  readonly signingKey: string;
  readonly defaultTopic?: string;
  readonly keepAlive: boolean;

  private _token: SigningToken | null;

  constructor(options: ApnsOptions) {
    this.team = options.team;
    this.keyId = options.keyId;
    this.signingKey = options.signingKey;
    this.defaultTopic = options.defaultTopic;
    this.host = options.host ?? Host.production;
    this.keepAlive = options.keepAlive ?? true;
    this._token = null;
  }

  sendMany(notifications: Notification[]) {
    const promises = notifications.map((notification) =>
      this.send(notification).catch((error: ApnsError) => ({ error }))
    );
    return Promise.all(promises);
  }

  async send(notification: Notification) {
    try {
      const token = await this._getSigningToken();
      const headers: Record<string, string | undefined> = {
        authorization: `bearer ${token}`,
        "apns-push-type": notification.pushType,
        "apns-topic": notification.options.topic ?? this.defaultTopic ?? "",
      };
      console.log(headers);
      if (notification.priority !== Priority.immediate) {
        headers["apns-priority"] = notification.priority.toString();
      }

      const expiration = notification.options.expiration;
      if (typeof expiration !== "undefined") {
        headers["apns-expiration"] =
          typeof expiration === "number"
            ? expiration.toFixed(0)
            : (expiration.getTime() / 1000).toFixed(0);
      }

      if (notification.options.collapseId) {
        headers["apns-collapse-id"] = notification.options.collapseId;
      }

      const res = await fetch(
        `https://${this.host}/${API_VERSION}/device/${encodeURIComponent(
          notification.deviceToken
        )}`,
        {
          method: "POST",
          headers: {
            authorization: `bearer ${token}`,
            "apns-push-type": notification.pushType,
            "apns-topic": notification.options.topic ?? this.defaultTopic ?? "",
            "apns-expiration": "0",
          },
          body: JSON.stringify(notification.buildApnsOptions()),
        }
      );

      console.log(res);

      return this._handleServerResponse(res, notification);
    } catch (e) {
      console.log(e);
    }
  }

  private async _handleServerResponse(
    res: Response,
    notification: Notification
  ) {
    if (res.status === 200) {
      return notification;
    }

    const responseError = await res.json().catch(() => ({
      reason: Errors.unknownError,
      timestamp: Date.now(),
    }));

    const error = new ApnsError({
      statusCode: res.status,
      notification: notification,
      response: responseError as ApnsResponseError,
    });

    if (error.reason === Errors.expiredProviderToken) {
      this._token = null;
    }

    throw error;
  }

  private async _getSigningToken(): Promise<string> {
    if (
      this._token &&
      Date.now() - this._token.timestamp < RESET_TOKEN_INTERVAL_MS
    ) {
      return this._token.value;
    }

    const claims = {
      iss: this.team,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = await jwt.sign(claims, this.signingKey, {
      algorithm: SIGNING_ALGORITHM,
      header: {
        kid: this.keyId,
      },
    });

    this._token = {
      value: token,
      timestamp: Date.now(),
    };

    return token;
  }
}
