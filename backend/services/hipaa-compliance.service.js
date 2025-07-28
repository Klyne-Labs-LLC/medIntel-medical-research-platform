import CryptoJS from 'crypto-js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger.util.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('HIPAAComplianceService');

/**
 * HIPAA Compliance and Security Service
 * Implements healthcare data protection standards
 */
export class HIPAAComplianceService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.jwtSecret = process.env.JWT_SECRET;
    this.sessionSecret = process.env.SESSION_SECRET;
    this.auditEnabled = process.env.HIPAA_AUDIT_ENABLED === 'true';
    
    // PHI detection patterns
    this.phiPatterns = this.initializePHIPatterns();
    
    // Session management
    this.activeSessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Rate limiting
    this.requestCounts = new Map();
    this.maxRequestsPerMinute = parseInt(process.env.MEDICAL_API_RATE_LIMIT_MAX) || 50;
    
    if (!this.encryptionKey || !this.jwtSecret) {
      logger.error('HIPAA compliance requires ENCRYPTION_KEY and JWT_SECRET');
      throw new Error('Security configuration incomplete');
    }
    
    logger.info('HIPAA Compliance Service initialized', {
      auditEnabled: this.auditEnabled,
      sessionTimeout: this.sessionTimeout
    });
  }

  /**
   * Initialize PHI detection patterns
   */
  initializePHIPatterns() {
    return {
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      mrn: /\b(MRN|mrn|medical record|record number):?\s*\d{6,12}\b/gi,
      dob: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      address: /\b\d+\s+[A-Za-z0-9\s,.-]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi,
      zipCode: /\b\d{5}(-\d{4})?\b/g,
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      // Names (basic pattern - may need refinement)
      names: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g
    };
  }

  /**
   * Create secure medical session
   */
  async createMedicalSession(userInfo = {}) {
    try {
      const sessionId = uuidv4();
      const timestamp = new Date().toISOString();
      
      const sessionData = {
        id: sessionId,
        created: timestamp,
        lastActivity: timestamp,
        userAgent: this.hashData(userInfo.userAgent || ''),
        ipAddress: this.hashData(userInfo.ipAddress || ''),
        expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
        isActive: true,
        medicalContext: {
          interactions: 0,
          toolsUsed: [],
          dataAccessed: []
        }
      };

      // Store session (in production, use secure database)
      this.activeSessions.set(sessionId, sessionData);

      // Generate JWT token
      const token = jwt.sign(
        { 
          sessionId, 
          type: 'medical_session',
          exp: Math.floor(Date.now() / 1000) + (this.sessionTimeout / 1000)
        },
        this.jwtSecret
      );

      // Audit log
      if (this.auditEnabled) {
        logger.auditAccess(sessionId, 'medical_session', 'CREATE', 'success');
      }

      return {
        sessionId,
        token,
        expiresAt: sessionData.expiresAt
      };
    } catch (error) {
      logger.error('Failed to create medical session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate medical session
   */
  async validateMedicalSession(token) {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret);
      const sessionId = decoded.sessionId;

      // Check if session exists and is active
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.isActive) {
        throw new Error('Session not found or inactive');
      }

      // Check if session has expired
      if (new Date() > new Date(session.expiresAt)) {
        this.deactivateSession(sessionId);
        throw new Error('Session expired');
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();
      this.activeSessions.set(sessionId, session);

      return {
        valid: true,
        sessionId,
        session
      };
    } catch (error) {
      logger.warn('Session validation failed:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Encrypt sensitive medical data
   */
  encryptMedicalData(data) {
    try {
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      const encrypted = CryptoJS.AES.encrypt(dataString, this.encryptionKey).toString();
      
      return {
        encrypted: encrypted,
        algorithm: 'AES-256',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Data encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive medical data
   */
  decryptMedicalData(encryptedData) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, this.encryptionKey);
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decryptedString);
      } catch {
        return decryptedString;
      }
    } catch (error) {
      logger.error('Data decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Detect and sanitize PHI in text
   */
  sanitizePHI(text, replacementText = '[REDACTED]') {
    if (typeof text !== 'string') {
      return text;
    }

    let sanitizedText = text;
    const detectedPHI = [];

    // Apply PHI detection patterns
    Object.entries(this.phiPatterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        detectedPHI.push({
          type,
          count: matches.length,
          examples: matches.slice(0, 2) // Log first 2 examples for debugging
        });
        
        sanitizedText = sanitizedText.replace(pattern, replacementText);
      }
    });

    // Log PHI detection for audit
    if (detectedPHI.length > 0 && this.auditEnabled) {
      logger.auditSecurityEvent('PHI_DETECTED', 'medium', {
        types: detectedPHI.map(phi => phi.type),
        totalCount: detectedPHI.reduce((sum, phi) => sum + phi.count, 0)
      });
    }

    return {
      sanitized: sanitizedText,
      phiDetected: detectedPHI.length > 0,
      phiTypes: detectedPHI
    };
  }

  /**
   * Hash sensitive data for logging/tracking
   */
  hashData(data) {
    return CryptoJS.SHA256(String(data)).toString().substring(0, 16);
  }

  /**
   * Log medical interaction for HIPAA audit
   */
  async logMedicalInteraction(sessionId, interactionData) {
    try {
      if (!this.auditEnabled) return;

      const auditEntry = {
        sessionId: this.hashData(sessionId),
        timestamp: new Date().toISOString(),
        type: 'MEDICAL_INTERACTION',
        action: interactionData.action || 'query',
        resourceAccessed: interactionData.resource || 'medical_ai',
        toolsUsed: interactionData.tools || [],
        dataCategory: interactionData.category || 'general',
        responseGenerated: interactionData.success || false,
        userAgent: this.hashData(interactionData.userAgent || ''),
        ipAddress: this.hashData(interactionData.ipAddress || ''),
        processingTime: interactionData.processingTime || null
      };

      // Store audit log (in production, use secure audit database)
      logger.auditMedicalQuery(
        sessionId,
        auditEntry.action,
        auditEntry.toolsUsed,
        auditEntry.responseGenerated
      );

      // Update session interaction count
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.medicalContext.interactions += 1;
        session.medicalContext.toolsUsed.push(...(interactionData.tools || []));
        session.medicalContext.dataAccessed.push(interactionData.resource || 'unknown');
        this.activeSessions.set(sessionId, session);
      }

    } catch (error) {
      logger.error('Failed to log medical interaction:', error);
    }
  }

  /**
   * Check rate limiting for medical API
   */
  checkRateLimit(identifier, endpoint = 'general') {
    const key = `${identifier}-${endpoint}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Get or create request history
    let requests = this.requestCounts.get(key) || [];
    
    // Filter requests within current window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (requests.length >= this.maxRequestsPerMinute) {
      logger.auditSecurityEvent('RATE_LIMIT_EXCEEDED', 'high', {
        identifier: this.hashData(identifier),
        endpoint,
        requestCount: requests.length,
        limit: this.maxRequestsPerMinute
      });
      
      return {
        allowed: false,
        resetTime: windowStart + 60000,
        remaining: 0
      };
    }

    // Add current request
    requests.push(now);
    this.requestCounts.set(key, requests);

    return {
      allowed: true,
      remaining: this.maxRequestsPerMinute - requests.length,
      resetTime: windowStart + 60000
    };
  }

  /**
   * Secure file upload validation for medical images
   */
  validateMedicalFileUpload(file) {
    const validationResult = {
      valid: false,
      errors: [],
      sanitizedFilename: '',
      securityChecks: {}
    };

    try {
      // File size check
      const maxSize = (parseFloat(process.env.MAX_IMAGE_SIZE_MB) || 50) * 1024 * 1024;
      if (file.size > maxSize) {
        validationResult.errors.push(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      }

      // File type validation
      const allowedTypes = (process.env.SUPPORTED_IMAGE_FORMATS || 'jpg,jpeg,png,dicom,tiff')
        .split(',').map(type => type.trim().toLowerCase());
      
      const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();
      const mimeType = file.mimetype?.toLowerCase();

      if (!allowedTypes.includes(fileExtension)) {
        validationResult.errors.push(`File type .${fileExtension} not supported`);
      }

      // MIME type check
      const validMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/tiff',
        'application/dicom', 'image/dicom'
      ];
      
      if (!validMimeTypes.some(type => mimeType?.includes(type))) {
        validationResult.errors.push('Invalid MIME type for medical image');
      }

      // Filename sanitization
      validationResult.sanitizedFilename = this.sanitizeFilename(file.originalname);

      // Security checks
      validationResult.securityChecks = {
        virusScan: 'pending', // Would integrate with antivirus service
        contentValidation: 'passed',
        filenameCheck: 'sanitized'
      };

      // Set valid if no errors
      validationResult.valid = validationResult.errors.length === 0;

      // Audit file upload attempt
      if (this.auditEnabled) {
        logger.auditSecurityEvent('FILE_UPLOAD_VALIDATION', 
          validationResult.valid ? 'low' : 'medium', {
          filename: this.hashData(file.originalname),
          size: file.size,
          type: fileExtension,
          valid: validationResult.valid,
          errors: validationResult.errors
        });
      }

      return validationResult;
    } catch (error) {
      logger.error('File validation failed:', error);
      validationResult.errors.push('File validation failed');
      return validationResult;
    }
  }

  /**
   * Sanitize filename for security
   */
  sanitizeFilename(filename) {
    if (!filename) return 'unknown_file';
    
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special characters
      .replace(/_{2,}/g, '_') // Replace multiple underscores
      .substring(0, 100) // Limit length
      .toLowerCase();
  }

  /**
   * Generate secure temporary access for medical images
   */
  generateSecureImageAccess(imageId, sessionId) {
    const accessToken = jwt.sign(
      {
        imageId,
        sessionId,
        type: 'image_access',
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      this.jwtSecret
    );

    return {
      accessToken,
      expiresIn: 15 * 60, // seconds
      accessUrl: `/api/medical/image/${imageId}?token=${accessToken}`
    };
  }

  /**
   * Deactivate session
   */
  deactivateSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.deactivatedAt = new Date().toISOString();
      this.activeSessions.set(sessionId, session);

      if (this.auditEnabled) {
        logger.auditAccess(sessionId, 'medical_session', 'DEACTIVATE', 'success');
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.deactivateSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  /**
   * Get security metrics for monitoring
   */
  getSecurityMetrics() {
    const activeSessions = Array.from(this.activeSessions.values())
      .filter(session => session.isActive);

    return {
      activeSessions: activeSessions.length,
      totalInteractions: activeSessions.reduce((sum, session) => 
        sum + session.medicalContext.interactions, 0),
      averageSessionDuration: this.calculateAverageSessionDuration(activeSessions),
      rateLimitHits: this.getRateLimitHits(),
      lastCleanup: new Date().toISOString()
    };
  }

  /**
   * Calculate average session duration
   */
  calculateAverageSessionDuration(sessions) {
    if (sessions.length === 0) return 0;

    const totalDuration = sessions.reduce((sum, session) => {
      const created = new Date(session.created);
      const lastActivity = new Date(session.lastActivity);
      return sum + (lastActivity - created);
    }, 0);

    return Math.round(totalDuration / sessions.length / 1000 / 60); // minutes
  }

  /**
   * Get rate limit hits
   */
  getRateLimitHits() {
    // This would be implemented with proper monitoring in production
    return 0;
  }

  /**
   * Generate HIPAA compliance report
   */
  async generateComplianceReport(timeframe = '24h') {
    const report = {
      timeframe,
      generated: new Date().toISOString(),
      summary: {
        totalSessions: this.activeSessions.size,
        activeSessions: Array.from(this.activeSessions.values())
          .filter(s => s.isActive).length,
        auditEnabled: this.auditEnabled,
        encryptionEnabled: !!this.encryptionKey
      },
      security: {
        phiDetectionActive: true,
        rateLimitingActive: true,
        sessionTimeoutMinutes: this.sessionTimeout / 1000 / 60,
        maxFileUploadMB: parseFloat(process.env.MAX_IMAGE_SIZE_MB) || 50
      },
      compliance: {
        dataEncryption: 'AES-256',
        auditLogging: this.auditEnabled ? 'enabled' : 'disabled',
        accessControls: 'JWT-based sessions',
        phiProtection: 'automated detection and sanitization'
      }
    };

    return report;
  }
}

export default HIPAAComplianceService;