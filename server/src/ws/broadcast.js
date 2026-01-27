export function createBroadcast(io, { log = true } = {}) {
  return function broadcast(event, data) {
    io.emit(event, data);
    if (log) {
      console.log(`📣 broadcast: ${event}`, data);
    }
  };
}
