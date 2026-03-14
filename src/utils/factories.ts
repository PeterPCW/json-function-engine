import type { FileSystem, Logger } from '../types/index.js';

/**
 * Create a default FileSystem implementation using Node.js fs
 */
export function createDefaultFileSystem(): FileSystem {
  return {
    readFile: async (path: string, encoding: BufferEncoding) => {
      const { readFile } = await import('fs/promises');
      return readFile(path, encoding);
    },
    readdir: async (path: string) => {
      const { readdir } = await import('fs/promises');
      return readdir(path);
    },
    stat: async (path: string) => {
      const { stat } = await import('fs/promises');
      const stats = await stat(path);
      return { isDirectory: () => stats.isDirectory() };
    }
  };
}

/**
 * Create a default console-based logger
 */
export function createDefaultLogger(): Logger {
  return {
    warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
    info: (message: string, ...args: unknown[]) => console.info(message, ...args),
    error: (message: string, ...args: unknown[]) => console.error(message, ...args)
  };
}

/**
 * Create a structured logger with timestamps and levels
 */
export interface StructuredLoggerOptions {
  prefix?: string;
  includeTimestamp?: boolean;
  includeLevel?: boolean;
}

export function createStructuredLogger(options: StructuredLoggerOptions = {}): Logger {
  const { prefix = '', includeTimestamp = true, includeLevel = true } = options;

  const formatMessage = (level: string, message: string): string => {
    const parts: string[] = [];
    if (includeTimestamp) {
      parts.push(new Date().toISOString());
    }
    if (includeLevel) {
      parts.push(level.toUpperCase());
    }
    if (prefix) {
      parts.push(prefix);
    }
    parts.push(message);
    return parts.join(' | ');
  };

  return {
    warn: (message: string, ...args: unknown[]) => console.warn(formatMessage('warn', message), ...args),
    info: (message: string, ...args: unknown[]) => console.info(formatMessage('info', message), ...args),
    error: (message: string, ...args: unknown[]) => console.error(formatMessage('error', message), ...args)
  };
}

/**
 * Create a no-op logger for testing or silent mode
 */
export function createSilentLogger(): Logger {
  return {
    warn: () => { },
    info: () => { },
    error: () => { }
  };
}
