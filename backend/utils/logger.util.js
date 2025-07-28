import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * HIPAA-compliant logging utility
 * Ensures medical data is properly anonymized and audit trails are maintained
 */

// Define log levels for medical applications
const medicalLogLevels = {
  levels: {
    emergency: 0,   // System unusable, immediate attention required
    alert: 1,       // Action required immediately (security breach, system failure)
    critical: 2,    // Critical conditions (data corruption, major errors)
    error: 3,       // Error conditions (failed operations, exceptions)
    warning: 4,     // Warning conditions (deprecated features, potential issues)
    notice: 5,      // Normal but significant condition (user actions, system events)
    info: 6,        // Informational messages (normal operations)
    debug: 7        // Debug-level messages (detailed system information)
  },
  colors: {
    emergency: 'red',
    alert: 'red',
    critical: 'red',
    error: 'red',
    warning: 'yellow',
    notice: 'green',
    info: 'cyan',
    debug: 'magenta'
  }
};

winston.addColors(medicalLogLevels.colors);

/**
 * Custom format for medical logging with PHI protection
 */
const medicalLogFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, sessionId, ...meta }) => {
    // Anonymize sensitive data
    const sanitizedMeta = sanitizeLogData(meta);
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'MedIntel',
      sessionId: sessionId ? hashSensitiveData(sessionId) : undefined,
      message: sanitizePHI(message),
      ...sanitizedMeta
    };

    return JSON.stringify(logEntry);
  })
);

/**
 * Sanitize PHI (Protected Health Information) from log messages
 */
function sanitizePHI(message) {
  if (typeof message !== 'string') return message;
  
  // Remove common PHI patterns
  return message
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    // Remove phone numbers
    .replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE_REDACTED]')
    // Remove SSN patterns
    .replace(/\d{3}-?\d{2}-?\d{4}/g, '[SSN_REDACTED]')
    // Remove medical record numbers (assuming 6-10 digits)
    .replace(/\b\d{6,10}\b/g, '[MRN_REDACTED]')
    // Remove potential names (basic pattern)
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME_REDACTED]');
}

/**
 * Sanitize metadata to remove PHI
 */
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveFields = [
    'email', 'phone', 'ssn', 'mrn', 'firstName', 'lastName', 'fullName',
    'address', 'zipCode', 'patientId', 'userId', 'ip', 'userAgent'
  ];
  
  const sanitized = { ...data };
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  });
  
  return sanitized;
}

/**
 * Hash sensitive data for tracking without exposing PHI
 */
function hashSensitiveData(data) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(String(data)).digest('hex').substring(0, 16);
}

/**
 * Create logger instance for a specific service
 */
export function createLogger(serviceName) {
  const logLevel = process.env.AUDIT_LOG_LEVEL || 'info';
  const isProduction = process.env.NODE_ENV === 'production';
  
  const transports = [];
  
  // Console transport for development
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    );
  }
  
  // File transport for all environments
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/medical-app.log'),
      level: logLevel,
      format: medicalLogFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    })
  );
  
  // Audit log for HIPAA compliance
  if (process.env.HIPAA_AUDIT_ENABLED === 'true') {
    transports.push(
      new winston.transports.File({
        filename: path.join(__dirname, '../logs/hipaa-audit.log'),
        level: 'notice',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 50,
        tailable: true
      })
    );
  }
  
  // Error log
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: medicalLogFormat,
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 5,
      tailable: true
    })
  );

  const logger = winston.createLogger({
    levels: medicalLogLevels.levels,
    level: logLevel,
    format: medicalLogFormat,
    defaultMeta: { service: serviceName },
    transports,
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(__dirname, '../logs/exceptions.log'),
        format: medicalLogFormat
      })
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(__dirname, '../logs/rejections.log'),
        format: medicalLogFormat
      })
    ]
  });

  // Add HIPAA audit logging methods
  logger.auditAccess = function(sessionId, resource, action, result) {
    this.notice('HIPAA_AUDIT', {
      type: 'ACCESS',
      sessionId,
      resource: sanitizePHI(resource),
      action,
      result,
      timestamp: new Date().toISOString()
    });
  };

  logger.auditDataModification = function(sessionId, dataType, operation, recordCount) {
    this.notice('HIPAA_AUDIT', {
      type: 'DATA_MODIFICATION',
      sessionId,
      dataType,
      operation,
      recordCount,
      timestamp: new Date().toISOString()
    });
  };

  logger.auditMedicalQuery = function(sessionId, queryType, toolsUsed, responseGenerated) {
    this.notice('HIPAA_AUDIT', {
      type: 'MEDICAL_QUERY',
      sessionId,
      queryType,
      toolsUsed,
      responseGenerated,
      timestamp: new Date().toISOString()
    });
  };

  logger.auditSecurityEvent = function(eventType, severity, details) {
    this.alert('SECURITY_EVENT', {
      type: 'SECURITY',
      eventType,
      severity,
      details: sanitizeLogData(details),
      timestamp: new Date().toISOString()
    });
  };

  return logger;
}

/**
 * Create directory structure for logs if it doesn't exist
 */
import fs from 'fs';
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default { createLogger };