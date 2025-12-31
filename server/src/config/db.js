import { db } from '../../db-adapter.js';

// Central place to initialize and share the database adapter
// Consumers should import { db } from this file instead of using db-adapter directly.
export { db };
