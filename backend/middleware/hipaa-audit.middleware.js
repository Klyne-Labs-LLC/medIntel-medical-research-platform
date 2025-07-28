import { createLogger } from '../utils/logger.util.js';
import HIPAAComplianceService from '../services/hipaa-compliance.service.js';

const logger = createLogger('HIPAAAuditMiddleware');

/**
 * HIPAA Audit Middleware
 * Tracks all medical data access and modifications
 */
class HIPAAAuditMiddleware {
  constructor() {
    this.hipaaService = new HIPAAComplianceService();
  }

  /**
   * General audit middleware for all requests
   */
  auditRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Capture request details
      const requestDetails = {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        sessionId: req.sessionId,
        timestamp: new Date().toISOString()
      };

      // Sanitize sensitive data from logs
      const sanitizedBody = this.sanitizeRequestData(req.body);
      const sanitizedQuery = this.sanitizeRequestData(req.query);

      // Log request initiation
      logger.info('HTTP request initiated', {
        method: req.method,
        url: req.url,
        sessionId: req.sessionId ? this.hipaaService.hashData(req.sessionId) : 'anonymous',
        hasBody: Object.keys(req.body || {}).length > 0,
        hasQuery: Object.keys(req.query || {}).length > 0
      });

      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data) {
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Log response
        logger.info('HTTP request completed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          processingTime,
          sessionId: req.sessionId ? this.hipaaService.hashData(req.sessionId) : 'anonymous',
          responseSize: JSON.stringify(data).length
        });

        // Audit medical endpoints
        if (req.url.includes('/api/medical') || req.url.includes('/api/medical-chat')) {
          this.auditMedicalEndpoint(req, res, data, processingTime);
        }

        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * Medical endpoint specific auditing
   */
  auditMedicalEndpoint(req, res, responseData, processingTime) {
    try {
      const auditData = {
        action: this.getActionFromEndpoint(req.url),
        resource: this.getResourceFromEndpoint(req.url),
        tools: responseData.mcpTools || [],
        success: res.statusCode >= 200 && res.statusCode < 300,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        processingTime,
        category: this.getCategoryFromRequest(req)
      };

      this.hipaaService.logMedicalInteraction(req.sessionId, auditData);

      // Additional logging for specific endpoints
      if (req.url.includes('/image-analysis')) {
        logger.auditAccess(req.sessionId, 'medical_image', 'ANALYZE', auditData.success ? 'success' : 'failure');
      }

      if (req.url.includes('/differential-diagnosis')) {
        logger.auditAccess(req.sessionId, 'diagnostic_analysis', 'GENERATE', auditData.success ? 'success' : 'failure');
      }

    } catch (error) {
      logger.error('Medical endpoint audit failed:', error);
    }
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return async (req, res, next) => {
      try {
        // Extract session token from headers or query
        const token = req.headers.authorization?.replace('Bearer ', '') || 
                      req.query.token ||
                      req.body?.sessionToken;

        if (!token) {
          logger.warn('Request without session token', {
            url: req.url,
            ip: this.hipaaService.hashData(req.ip)
          });
          
          return res.status(401).json({
            error: 'Session token required',
            code: 'NO_SESSION_TOKEN'
          });
        }

        // Validate session
        const validation = await this.hipaaService.validateMedicalSession(token);
        
        if (!validation.valid) {
          logger.warn('Invalid session token', {
            url: req.url,
            error: validation.error,
            ip: this.hipaaService.hashData(req.ip)
          });
          
          return res.status(401).json({
            error: 'Invalid or expired session',
            code: 'INVALID_SESSION'
          });
        }

        // Add session info to request
        req.sessionId = validation.sessionId;
        req.session = validation.session;

        // Audit successful authentication
        logger.auditAccess(validation.sessionId, 'medical_system', 'AUTHENTICATE', 'success');

        next();
      } catch (error) {
        logger.error('Session validation failed:', error);
        logger.auditSecurityEvent('AUTHENTICATION_ERROR', 'high', {
          error: error.message,
          ip: this.hipaaService.hashData(req.ip)
        });
        
        res.status(500).json({
          error: 'Authentication system error',
          code: 'AUTH_SYSTEM_ERROR'
        });
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit() {
    return (req, res, next) => {
      try {
        const identifier = req.sessionId || req.ip;
        const endpoint = this.getEndpointCategory(req.url);
        
        const rateLimitCheck = this.hipaaService.checkRateLimit(identifier, endpoint);
        
        if (!rateLimitCheck.allowed) {
          logger.warn('Rate limit exceeded', {
            identifier: this.hipaaService.hashData(identifier),
            endpoint,
            resetTime: rateLimitCheck.resetTime
          });
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            resetTime: rateLimitCheck.resetTime,
            remaining: rateLimitCheck.remaining
          });
        }

        // Add rate limit headers
        res.set({
          'X-RateLimit-Remaining': rateLimitCheck.remaining,
          'X-RateLimit-Reset': rateLimitCheck.resetTime
        });

        next();
      } catch (error) {
        logger.error('Rate limiting failed:', error);
        next(); // Don't block request on rate limiting error
      }
    };
  }

  /**
   * File upload security middleware
   */
  validateFileUpload() {
    return (req, res, next) => {
      try {
        if (req.file) {
          const validation = this.hipaaService.validateMedicalFileUpload(req.file);
          
          if (!validation.valid) {
            logger.warn('Invalid file upload attempt', {
              sessionId: req.sessionId ? this.hipaaService.hashData(req.sessionId) : 'anonymous',
              errors: validation.errors,
              filename: this.hipaaService.hashData(req.file.originalname)
            });
            
            return res.status(400).json({
              error: 'File validation failed',
              code: 'INVALID_FILE',
              details: validation.errors
            });
          }

          // Add validation results to request
          req.fileValidation = validation;
          
          // Audit successful file upload
          logger.auditAccess(req.sessionId, 'medical_file', 'UPLOAD', 'success');
        }

        next();
      } catch (error) {
        logger.error('File upload validation failed:', error);
        res.status(500).json({
          error: 'File validation system error',
          code: 'FILE_VALIDATION_ERROR'
        });
      }
    };
  }

  /**
   * PHI sanitization middleware
   */
  sanitizePHI() {
    return (req, res, next) => {
      try {
        // Sanitize request body
        if (req.body) {
          req.body = this.sanitizeObjectPHI(req.body);
        }

        // Sanitize query parameters
        if (req.query) {
          req.query = this.sanitizeObjectPHI(req.query);
        }

        // Override response to sanitize outgoing data
        const originalJson = res.json;
        res.json = function(data) {
          const sanitizedData = this.sanitizeObjectPHI(data);
          return originalJson.call(this, sanitizedData);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('PHI sanitization failed:', error);
        next(); // Don't block request on sanitization error
      }
    };
  }

  /**
   * Sanitize request data for logging
   */
  sanitizeRequestData(data) {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password', 'token', 'sessionToken', 'apiKey', 
      'email', 'phone', 'ssn', 'patientId', 'mrn'
    ];

    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize object for PHI
   */
  sanitizeObjectPHI(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObjectPHI(item));
    }

    const sanitized = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const sanitizationResult = this.hipaaService.sanitizePHI(value);
        sanitized[key] = sanitizationResult.sanitized;
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObjectPHI(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  /**
   * Get action from endpoint URL
   */
  getActionFromEndpoint(url) {
    if (url.includes('/medical-chat')) return 'medical_query';
    if (url.includes('/image-analysis')) return 'image_analysis';
    if (url.includes('/differential-diagnosis')) return 'differential_diagnosis';
    if (url.includes('/clinical-trials')) return 'clinical_trials_search';
    if (url.includes('/drug-interactions')) return 'drug_interaction_check';
    return 'medical_api_access';
  }

  /**
   * Get resource from endpoint URL
   */
  getResourceFromEndpoint(url) {
    if (url.includes('/medical-chat')) return 'medical_ai';
    if (url.includes('/image')) return 'medical_image';
    if (url.includes('/diagnosis')) return 'diagnostic_system';
    if (url.includes('/trials')) return 'clinical_trials_db';
    if (url.includes('/drug')) return 'drug_database';
    return 'medical_system';
  }

  /**
   * Get category from request
   */
  getCategoryFromRequest(req) {
    if (req.body?.analysisType) return req.body.analysisType;
    if (req.url.includes('/emergency')) return 'emergency';
    if (req.url.includes('/image')) return 'imaging';
    if (req.url.includes('/diagnosis')) return 'diagnosis';
    return 'general';
  }

  /**
   * Get endpoint category for rate limiting
   */
  getEndpointCategory(url) {
    if (url.includes('/medical-chat')) return 'medical_chat';
    if (url.includes('/image-analysis')) return 'image_analysis';
    if (url.includes('/diagnosis')) return 'diagnosis';
    return 'general';
  }
}

// Export middleware functions
const hipaaAudit = new HIPAAAuditMiddleware();

export const auditRequest = hipaaAudit.auditRequest.bind(hipaaAudit);
export const validateSession = hipaaAudit.validateSession.bind(hipaaAudit);
export const rateLimit = hipaaAudit.rateLimit.bind(hipaaAudit);
export const validateFileUpload = hipaaAudit.validateFileUpload.bind(hipaaAudit);
export const sanitizePHI = hipaaAudit.sanitizePHI.bind(hipaaAudit);

export default hipaaAudit;