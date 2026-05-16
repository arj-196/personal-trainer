export type LogContext = Record<string, unknown>;

export type Logger = {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

function log(moduleName: string, level: 'info' | 'warn' | 'error', message: string, context?: LogContext): void {
  const payload = context ? ` ${JSON.stringify(context)}` : '';
  console[level](`[${moduleName}] ${message}${payload}`);
}

export function createLogger(moduleName: string): Logger {
  return {
    info(message: string, context?: LogContext) {
      log(moduleName, 'info', message, context);
    },
    warn(message: string, context?: LogContext) {
      log(moduleName, 'warn', message, context);
    },
    error(message: string, context?: LogContext) {
      log(moduleName, 'error', message, context);
    },
  };
}

export const logger = createLogger('app_web');
