/**
 * Event Handlers Registry
 * Maps event types to their handlers
 *
 * Naming Convention:
 * - Handler files: <domain>.<event>.handler.js (e.g., order.completed.handler.js)
 * - Export function: handle<Domain><Event> (e.g., handleOrderCompleted)
 * - Event type: <domain>.<event> (e.g., order.completed)
 *
 * This follows Single Responsibility Principle - one handler per event
 */

import { handleOrderCompleted } from './order.completed.handler.js';
import { handleUserDeleted } from './user.deleted.handler.js';
import { handleProductDeleted } from './product.deleted.handler.js';

export default {
  'order.completed': handleOrderCompleted,
  'user.deleted': handleUserDeleted,
  'product.deleted': handleProductDeleted,
};
