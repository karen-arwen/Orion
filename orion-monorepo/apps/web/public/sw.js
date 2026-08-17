const ORION_CACHE = "orion-shell-v1";
const SHELL_ASSETS = ["/", "/orion.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ORION_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== ORION_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.open(ORION_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const fetched = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      return cached ?? fetched;
    }));
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/"))));
});

/* ═══════════════════════════════════════════════════════════════════
   WEB PUSH NOTIFICATIONS — ORION notifica mesmo com app fechado.
═══════════════════════════════════════════════════════════════════ */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "O.R.I.O.N", body: event.data.text() };
  }

  const options = {
    body: payload.body || "",
    icon: "/orion.svg",
    badge: "/orion.svg",
    tag: payload.tag || "orion-notification",
    renotify: payload.renotify ?? true,
    data: {
      url: payload.url || "/",
      alertId: payload.alertId,
      module: payload.module,
    },
    actions: payload.actions || [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Dispensar" },
    ],
    vibrate: [100, 50, 100],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(payload.title || "O.R.I.O.N", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  if (event.action === "dismiss") return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url,
            alertId: event.notification.data?.alertId,
            module: event.notification.data?.module,
          });
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    }),
  );
});
