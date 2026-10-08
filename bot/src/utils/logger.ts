type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }
  
  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }
  
  debug(message: string): void {
    if (this.shouldLog('debug')) console.log(this.format('debug', message));
  }
  
  info(message: string): void {
    if (this.shouldLog('info')) console.log(this.format('info', message));
  }
  
  warn(message: string): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message));
  }
  
  error(message: string): void {
    if (this.shouldLog('error')) console.error(this.format('error', message));
  }
}

export const logger = new Logger();