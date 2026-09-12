// sw.js — must be uploaded to the SAME folder as routine5-1.html, at the site's root
// (e.g. https://yourdomain.com/sw.js), so its default scope covers the whole app.
//
// This is the piece that makes notifications arrive even when the app/browser is fully
// closed: the OS wakes this worker up whenever your backend server sends a push message
// through the browser's push service (Chrome/FCM, Firefox/Mozilla push, or Apple's push
// service on iOS 16.4+ installed PWAs) — completely independent of whether any tab or the
// app itself is open.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Fired by the browser the moment a push message from our backend (server/scheduler.js)
// arrives. The payload is small JSON: { title, body, tag, url }.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: 'روند', body: event.data ? event.data.text() : 'یادآوری' };
  }
  const title = data.title || 'روند — یادآوری عادت';
  const options = {
    body: data.body || '',
    tag: data.tag || title,
    renotify: true,
    vibrate: [80, 40, 80],
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab if there is one, otherwise opens a
// fresh one — same behavior as the old foreground-only notification click handler.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// If the browser ever rotates/invalidates a push subscription on its own, re-subscribe and
// tell our backend about the new one so reminders keep working without the user noticing.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
      .then((newSub) => {
        // No fetch API base available inside the worker's own config — postMessage the page
        // if one is open; if the app is fully closed when this happens, the next time it's
        // opened it will detect the subscription and re-sync via subscribeToPush() as usual.
        return self.clients.matchAll().then((clients) => {
          clients.forEach((c) => c.postMessage({ type: 'push-resubscribed', subscription: newSub }));
        });
      })
      .catch(() => {})
  );
});
