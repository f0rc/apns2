import { ApnsClient } from "./main";
import { ApnsError } from "./notification/errors";
import { Notification } from "./notification/notification";

const APN_TEAM_ID = "";

const APN_KEY_ID = "";
const APNS_SIGNING_KEY = ``;

const client = new ApnsClient({
  team: APN_TEAM_ID,
  keyId: APN_KEY_ID,
  signingKey: APNS_SIGNING_KEY,
  defaultTopic: `com.app`,
});

console.log(client.host);

const notification = new Notification("device-token", { alert: "hello world" });

async function main() {
  try {
    await client.send(notification);
  } catch (error) {
    if (error instanceof ApnsError) {
      console.error(`error: ${error.reason}`);
    }
  }
}

main();
