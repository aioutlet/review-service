/**
 * Console color utilities for better log readability
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

/**
 * Colorize message based on log level
 * @param {string} level - Log level
 * @param {string} message - Message to colorize
 * @returns {string} - Colorized message
 */
export function colorizeLevel(level, message) {
  if (process.env.NO_COLOR === 'true' || process.env.NODE_ENV === 'production') {
    return message;
  }

  switch (level.toLowerCase()) {
    case 'error':
    case 'fatal':
      return `${colors.red}${message}${colors.reset}`;
    case 'warn':
      return `${colors.yellow}${message}${colors.reset}`;
    case 'info':
      return `${colors.cyan}${message}${colors.reset}`;
    case 'debug':
      return `${colors.green}${message}${colors.reset}`;
    default:
      return message;
  }
}

/**
 * Apply specific color to text
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @returns {string} - Colorized text
 */
export function colorize(text, color) {
  if (process.env.NO_COLOR === 'true' || process.env.NODE_ENV === 'production') {
    return text;
  }

  const colorCode = colors[color];
  return colorCode ? `${colorCode}${text}${colors.reset}` : text;
}

export default {
  colorizeLevel,
  colorize,
};
