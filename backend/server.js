import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { createLogger } from "./utils/logger.util.js";
import MedicalMCPService from "./services/medical-mcp.service.js";
import HIPAAComplianceService from "./services/hipaa-compliance.service.js";
import { auditRequest, validateSession, rateLimit as medicalRateLimit, validateFileUpload, sanitizePHI } from "./middleware/hipaa-audit.middleware.js";
import { 
  handleMedicalChat, 
  handleDifferentialDiagnosis, 
  handleClinicalTrials, 
  handleDrugInteractions, 
  handleImageAnalysis,
  healthCheck as medicalHealthCheck
} from "./controllers/medical-chat.controller.js";
import dotenv from "dotenv";

dotenv.config();

const logger = createLogger('MedIntelServer');
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

// Initialize services
let mcpService;
let hipaaService;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration for medical application
const corsOptions = {
  origin: (process.env.CORS_ORIGINS || "http://127.0.0.1:5000").split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Rate limiting
const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration for medical images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseFloat(process.env.MAX_IMAGE_SIZE_MB) || 50) * 1024 * 1024, // 50MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.SUPPORTED_IMAGE_FORMATS || 'jpg,jpeg,png,dicom,tiff')
      .split(',').map(type => type.trim().toLowerCase());
    
    const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${fileExtension} not supported for medical imaging`));
    }
  }
});

// HIPAA compliance middleware
app.use(auditRequest());
app.use(sanitizePHI());

// Public endpoints (no session required)
app.get("/", (req, res) => {
  res.json({
    name: "MedIntel Medical Research Platform",
    version: "1.0.0",
    description: "Advanced medical AI platform with HIPAA compliance",
    status: "operational",
    timestamp: new Date().toISOString()
  });
});

// Session creation endpoint
app.post("/api/session", async (req, res) => {
  try {
    const userInfo = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    };
    
    const session = await hipaaService.createMedicalSession(userInfo);
    
    logger.info('Medical session created', {
      sessionId: hipaaService.hashData(session.sessionId)
    });
    
    res.json({
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt
      },
      message: "Medical session created successfully"
    });
  } catch (error) {
    logger.error('Session creation failed:', error);
    res.status(500).json({
      error: 'Failed to create medical session',
      code: 'SESSION_CREATION_ERROR'
    });
  }
});

// Protected medical endpoints (require valid session)
app.use('/api/medical*', validateSession());
app.use('/api/medical*', medicalRateLimit());

// Medical chat endpoint with optional image upload
app.post("/api/medical-chat", upload.single('medicalImage'), validateFileUpload(), handleMedicalChat);

// Differential diagnosis endpoint
app.post("/api/medical/differential-diagnosis", handleDifferentialDiagnosis);

// Clinical trials search endpoint
app.post("/api/medical/clinical-trials", handleClinicalTrials);

// Drug interactions check endpoint
app.post("/api/medical/drug-interactions", handleDrugInteractions);

// Medical image analysis endpoint
app.post("/api/medical/image-analysis", upload.single('medicalImage'), validateFileUpload(), handleImageAnalysis);

// Legacy chat endpoint (backwards compatibility)
app.post("/api/chat", async (req, res) => {
  logger.warn('Legacy chat endpoint accessed - redirecting to medical chat');
  res.status(301).json({
    message: "This endpoint has been upgraded. Please use /api/medical-chat with proper session authentication.",
    newEndpoint: "/api/medical-chat",
    migrationGuide: "https://docs.medintel.ai/migration"
  });
});

// Health check endpoints
app.get("/api/health", async (req, res) => {
  try {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services: {
        gemini: process.env.GOOGLE_AI_API_KEY ? "configured" : "not configured",
        groq: process.env.GROQ_API_KEY ? "configured" : "not configured",
        encryption: process.env.ENCRYPTION_KEY ? "configured" : "not configured",
        hipaaCompliance: process.env.HIPAA_AUDIT_ENABLED === 'true' ? "enabled" : "disabled"
      }
    };

    // Check MCP connections
    if (mcpService) {
      const mcpStatus = mcpService.getConnectionSummary();
      health.services.mcp = {
        connected: mcpStatus.connected,
        total: mcpStatus.total,
        capabilities: mcpStatus.capabilities
      };
    } else {
      health.services.mcp = "not initialized";
    }

    // Check security metrics
    if (hipaaService) {
      const securityMetrics = hipaaService.getSecurityMetrics();
      health.security = {
        activeSessions: securityMetrics.activeSessions,
        totalInteractions: securityMetrics.totalInteractions
      };
    }

    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Detailed medical system health check
app.get("/api/medical/health", validateSession(), medicalHealthCheck);

// Get available MCP tools
app.get("/api/medical/tools", validateSession(), async (req, res) => {
  try {
    if (!mcpService) {
      return res.status(500).json({ 
        error: "MCP service not initialized",
        code: "MCP_NOT_INITIALIZED"
      });
    }

    const capabilities = mcpService.getAvailableCapabilities();
    const connectionSummary = mcpService.getConnectionSummary();
    
    res.json({
      capabilities,
      connections: connectionSummary,
      availableTools: capabilities.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Tools endpoint error:", error);
    res.status(500).json({
      error: "Failed to get medical tools",
      code: "TOOLS_ERROR",
      details: error.message,
    });
  }
});

// HIPAA compliance report endpoint
app.get("/api/medical/compliance-report", validateSession(), async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';
    const report = await hipaaService.generateComplianceReport(timeframe);
    
    res.json({
      report,
      generatedFor: req.sessionId,
      disclaimer: "This report contains aggregated, anonymized compliance metrics only."
    });
  } catch (error) {
    logger.error('Compliance report generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate compliance report',
      code: 'COMPLIANCE_REPORT_ERROR'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled application error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: isDevelopment ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    availableEndpoints: [
      'POST /api/session',
      'POST /api/medical-chat',
      'POST /api/medical/differential-diagnosis',
      'POST /api/medical/clinical-trials',
      'POST /api/medical/drug-interactions',
      'POST /api/medical/image-analysis',
      'GET /api/health',
      'GET /api/medical/health',
      'GET /api/medical/tools'
    ],
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    logger.info('Starting MedIntel Medical Research Platform...');
    
    // Initialize HIPAA compliance service
    hipaaService = new HIPAAComplianceService();
    logger.info('HIPAA compliance service initialized');
    
    // Initialize MCP service
    mcpService = new MedicalMCPService();
    await mcpService.initializeAllClients();
    logger.info('Medical MCP services initialized');
    
    // Start server
    app.listen(PORT, HOST, () => {
      logger.info(`MedIntel server running on http://${HOST}:${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        hipaaEnabled: process.env.HIPAA_AUDIT_ENABLED === 'true',
        mcpClients: mcpService.getConnectionSummary().connected
      });
    });
    
    // Setup periodic cleanup
    setInterval(() => {
      hipaaService.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
    
  } catch (error) {
    logger.error("Failed to start MedIntel server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down MedIntel server gracefully...`);
  
  try {
    // Close MCP connections
    if (mcpService) {
      await mcpService.closeAllConnections();
    }
    
    // Cleanup sessions
    if (hipaaService) {
      hipaaService.cleanupExpiredSessions();
    }
    
    logger.info('MedIntel server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

startServer();
