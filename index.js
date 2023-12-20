const VAPID_PUBLIC_KEY = "BMGfrGJm_PBo9EqCJ-QNtD4cRfZRey2teI4xcMMDNmJfmsUM4KeNGiXR6jlexwHpptyVSwxVv692XrF77xCBto8";
const subscribeButton = document.getElementById("subscribe");
const unsubscribeButton = document.getElementById("unsubscribe");
const notifyMeButton = document.getElementById("notify-me");

async function subscribeButtonHandler() {
  // TODO
  // TODO
  // Prevent the user from clicking the subscribe button multiple times.
  subscribeButton.disabled = true;
  const result = await Notification.requestPermission();
  if (result === "denied") {
    console.error("The user explicitly denied the permission request.");
    return;
  }
  if (result === "granted") {
    console.info("The user accepted the permission request.");
  }
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    unsubscribeButton.disabled = false;
    document.querySelector("#code").innerHTML = await createCurlCommand(subscription.endpoint)
    return;
  }
  const subscriptionInfo = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  notifyMeButton.disabled = false;
  document.querySelector("#code").innerHTML = await createCurlCommand(subscriptionInfo.endpoint)

}

async function unsubscribeButtonHandler() {
  // TODO
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  fetch("/remove-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  const unsubscribed = await subscription.unsubscribe();
  if (unsubscribed) {
    console.info("Successfully unsubscribed from push notifications.");
    unsubscribeButton.disabled = true;
    subscribeButton.disabled = false;
    notifyMeButton.disabled = true;
  }
}

// Convert a base64 string to Uint8Array.
// Must do this so the server can understand the VAPID_PUBLIC_KEY.
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Startup logic.

// TODO add startup logic here
if ("serviceWorker" in navigator && "PushManager" in window) {
  navigator.serviceWorker
    .register("/service-worker.js")
    .then((serviceWorkerRegistration) => {
      console.info("Service worker was registered.");
      console.info({ serviceWorkerRegistration });
    })
    .catch((error) => {
      console.error("An error occurred while registering the service worker.");
      console.error(error);
    });
  subscribeButton.disabled = false;
} else {
  console.error("Browser does not support service workers or push messages.");
}

subscribeButton.addEventListener("click", subscribeButtonHandler);
unsubscribeButton.addEventListener("click", unsubscribeButtonHandler);

function uint8ArrayToBase64Url(uint8Array, start, end) {
  start = start || 0;
  end = end || uint8Array.byteLength;

  const base64 = globalThis.btoa(
    String.fromCharCode.apply(null, uint8Array.subarray(start, end))
  );
  return base64
    .replace(/\=/g, "") // eslint-disable-line no-useless-escape
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Converts the URL-safe base64 encoded |base64UrlData| to an Uint8Array buffer.
function base64UrlToUint8Array(base64UrlData) {
  const padding = "=".repeat((4 - (base64UrlData.length % 4)) % 4);
  const base64 = (base64UrlData + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = globalThis.atob(base64);
  const buffer = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

async function createCurlCommand(endpoint) {
  const vapidKeys = {
    publicKey:
      "BMGfrGJm_PBo9EqCJ-QNtD4cRfZRey2teI4xcMMDNmJfmsUM4KeNGiXR6jlexwHpptyVSwxVv692XrF77xCBto8",
    privateKey: "6ov9wGxU2FOIaehILSdghHMxHfOyv1tH0z3vn4tEtsg",
  };
  const subject = "mailto:simple-push-demo@gauntface.co.uk";
  if (!endpoint) {
    return Promise.reject(
      new Error("Audience must be the origin of the " + "server")
    );
  }

  if (!subject) {
    return Promise.reject(
      new Error("Subject must be either a mailto or " + "http link")
    );
  }
  const  exp = Math.floor(Date.now() / 1000 + 12 * 60 * 60); 

  const publicApplicationServerKey = base64UrlToUint8Array(vapidKeys.publicKey);
  const privateApplicationServerKey = base64UrlToUint8Array(
    vapidKeys.privateKey
  );

  // Ensure the audience is just the origin
  const audience = new URL(endpoint).origin;

  const tokenHeader = {
    typ: "JWT",
    alg: "ES256",
  };

  const tokenBody = {
    aud: audience,
    exp: exp,
    sub: subject,
  };

  // Utility function for UTF-8 encoding a string to an ArrayBuffer.
  const utf8Encoder = new TextEncoder("utf-8");

  // The unsigned token is the concatenation of the URL-safe base64 encoded
  // header and body.
  const unsignedToken =
    uint8ArrayToBase64Url(utf8Encoder.encode(JSON.stringify(tokenHeader))) +
    "." +
    uint8ArrayToBase64Url(utf8Encoder.encode(JSON.stringify(tokenBody)));

  // Sign the |unsignedToken| using ES256 (SHA-256 over ECDSA).
  const keyData = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64Url(publicApplicationServerKey.subarray(1, 33)),
    y: uint8ArrayToBase64Url(publicApplicationServerKey.subarray(33, 65)),
    d: uint8ArrayToBase64Url(privateApplicationServerKey),
  };

  // Sign the |unsignedToken| with the server's private key to generate
  // the signature.
  const key = await crypto.subtle.importKey(
    "jwk",
    keyData,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: {
        name: "SHA-256",
      },
    },
    key,
    utf8Encoder.encode(unsignedToken)
  );

  const jsonWebToken =
    unsignedToken + "." + uint8ArrayToBase64Url(new Uint8Array(signature));
  const p256ecdsa = uint8ArrayToBase64Url(publicApplicationServerKey);

  return `curl "${endpoint}" --request POST --header "TTL: 60" --header "Content-Length: 0" --header "Authorization: vapid t=${jsonWebToken}, k=${p256ecdsa}"`;
}
