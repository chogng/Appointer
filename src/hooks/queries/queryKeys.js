export const queryKeys = {
  devices: () => ["devices"],
  userBlocklist: (userId) => ["users", userId, "blocklist"],
  reservationsRange: ({ deviceId, from, to, active }) => [
    "reservations",
    "range",
    { deviceId, from, to, active: Boolean(active) },
  ],
};
