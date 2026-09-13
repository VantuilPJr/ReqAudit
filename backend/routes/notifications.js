export function registerNotificationRoutes(app, { service: s }) {
  app.patch('/api/notifications/read', (req, res) => {
    s.run(
      'UPDATE notifications SET readAt=? WHERE userId=? AND readAt IS NULL',
      new Date().toISOString(),
      req.actor.id,
    );
    res.json({ ok: true });
  });
}