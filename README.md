# apns

Another Client for Apple Push Notification Service (APNs) but this one works in Cloudflare Workers.

This utilizes the default fetch function which in cloudflare workers is HTTP/2 by default.
[cloudflare](https://github.com/cloudflare/cloudflare-docs/pull/4752/files#diff-cee73cc436ddd5b37966ad349818e4497c6a509a88b4293819d0dd9e5f58f979R12)

## Usage

```typescript
const client = new ApnsClient({
  team: APN_TEAM_ID,
  keyId: APN_KEY_ID,
  signingKey: APNS_SIGNING_KEY, // String format from cloudflare secrets
  defaultTopic: BUNDLE_ID,
});
```

## Send notification

```typescript
const notification = new Notification("device-token", { alert: "hello world" });

try {
  await client.send(notification);
} catch (error) {
  if (error instanceof ApnsError) {
    console.error(`error: ${error.reason}`);
  }
}
```

## Credit:

- [apns2](https://github.com/AndrewBarba/apns2) basically this but for nodejs
- [apple documentation](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns)
