self.addEventListener("push", function (event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || "Notification";
  var options = {
    body: data.message || "You have a new notification",
    icon: "/logo.webp",
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    (async function () {
      var clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (var i = 0; i < clientList.length; i++) {
        var windowClient = clientList[i];
        if (windowClient.url === event.notification.data && "focus" in windowClient) {
          return windowClient.focus();
        }
      }
      if (self.clients.openWindow && event.notification.data) {
        return self.clients.openWindow(event.notification.data);
      }
    })(),
  );
});
