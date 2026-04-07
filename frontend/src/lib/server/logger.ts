export type LogContext = Record<string, unknown>;

function log(level: 'info' | 'warn' | 'error', message: string, context?: LogContext): void {
  const payload = context ? ` ${JSON.stringify(context)}` : '';
  console[level](`[jeff-the-cook] ${message}${payload}`);
}

export const logger = {
  info(message: string, context?: LogContext) {
    log('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    log('warn', message, context);
  },
  error(message: string, context?: LogContext) {
    log('error', message, context);
  },
};
