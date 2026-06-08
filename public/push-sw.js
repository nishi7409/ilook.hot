// Push notification service worker for iLook.hot
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'iLook.hot', body: event.data.text() };
  }

  var title = data.title || '🏋️ iLook.hot';
  var options = {
    body: data.body || 'You have a workout today!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/workouts' },
    tag: 'workout-reminder',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = (event.notification.data && event.notification.data.url) || '/workouts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.focus) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: url });
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
