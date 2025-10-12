/**
 * Message Broker Interface
 * Defines the contract for all message broker implementations (RabbitMQ, Kafka, etc.)
 * This abstraction allows easy switching between different message brokers without changing business logic.
 */

class IMessageBroker {
  /**
   * Establish connection to the message broker
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented');
  }

  /**
   * Start consuming messages from configured queues/topics
   * @returns {Promise<void>}
   */
  async startConsuming() {
    throw new Error('startConsuming() must be implemented');
  }

  /**
   * Register event handler for specific event types
   * @param {String} eventType - The type of event to handle
   * @param {Function} handler - Function to process the event (eventData, correlationId) => Promise<void>
   */
  registerEventHandler(eventType, handler) {
    throw new Error('registerEventHandler() must be implemented');
  }

  /**
   * Close connection to the message broker
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented');
  }

  /**
   * Check if the broker connection is healthy
   * @returns {Boolean} true if connected and ready, false otherwise
   */
  isReady() {
    throw new Error('isReady() must be implemented');
  }

  /**
   * Get queue/topic statistics (optional, for monitoring)
   * @returns {Promise<Object>} Statistics object
   */
  async getHealthStatus() {
    throw new Error('getHealthStatus() must be implemented');
  }
}

export default IMessageBroker;
