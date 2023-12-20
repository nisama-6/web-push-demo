self.addEventListener("push", (event) => {
  // TODO
  // TODO
  console.log(event)
 
  const image =
    "https://cdn.glitch.com/614286c9-b4fc-4303-a6a9-a4cef0601b74%2Flogo.png?v=1605150951230";
  const options = {
    body: "11111",
    icon: image,
  };
  self.registration.showNotification("hahaha", options);
});

self.addEventListener("notificationclick", (event) => {
  // TODO
  // TODO
  event.notification.close();
  event.waitUntil(self.clients.openWindow("https://web.dev"));
});
