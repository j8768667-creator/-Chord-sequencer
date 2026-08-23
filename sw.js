/* ChordFlow cache reset worker.
 * This intentionally unregisters itself so Safari cannot keep an obsolete module graph.
 */
self.addEventListener("install", (event) => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
