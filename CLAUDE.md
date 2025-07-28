# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MedIntel** is a sophisticated medical research platform built on a foundation of Model Context Protocol (MCP) integration. It provides advanced medical AI capabilities with HIPAA compliance, multi-modal analysis, and clinical decision support tools.

The platform integrates Google Gemini 2.5 Pro for medical AI analysis, multiple MCP clients for medical data access, comprehensive HIPAA compliance features, and secure medical image analysis capabilities.

## Architecture

### Backend (`/backend/`) - Medical Services Architecture

**Core Services:**
- **Express.js** server with HIPAA-compliant security middleware
- **Multi-MCP Integration** via `@modelcontextprotocol/sdk` for medical data sources
- **Medical AI Processing** using Google Gemini 2.5 Pro with Groq fallback
- **Medical Intent Analysis** for clinical query classification
- **HIPAA Compliance Service** with encryption, audit logging, and PHI protection
- **Medical Image Analysis** with AI-powered diagnostic assistance
- **Differential Diagnosis Engine** using clinical reasoning frameworks

**Key Service Files:**
- `server.js` - Main Express server with medical endpoints and security
- `services/medical-mcp.service.js` - Multi-client MCP management (PubMed, Clinical Trials, etc.)
- `services/medical-ai.service.js` - Gemini 2.5 Pro integration for medical analysis
- `services/medical-image.service.js` - Secure medical image processing and analysis
- `services/differential-diagnosis.service.js` - Clinical reasoning and diagnostic workflows  
- `services/hipaa-compliance.service.js` - Security, encryption, and audit compliance
- `controllers/medical-chat.controller.js` - Medical conversation handling
- `middleware/hipaa-audit.middleware.js` - Request auditing and security validation
- `utils/medical-intent.util.js` - Advanced medical query classification
- `utils/logger.util.js` - HIPAA-compliant logging with PHI protection

### Frontend (`/frontend/`) - Medical Interface

**Medical Components:**
- **Vanilla JavaScript** with medical-specific UI components
- **Secure Session Management** with JWT tokens and session monitoring
- **Medical Image Upload** with DICOM support and validation
- **Real-time Medical Chat** with clinical context and safety alerts
- **Patient Context Management** for clinical data collection
- **Medical Tools Integration** for diagnostic workflows

**Key Frontend Files:**
- `index.html` - Medical platform interface with HIPAA compliance indicators
- `js/medical-api.service.js` - Secure API communication with session management
- `js/medical-chat.component.js` - Enhanced medical chat with image analysis
- `css/medical-theme.css` - Professional healthcare styling and responsive design

### MCP Integration Architecture

The platform requires multiple MCP clients for comprehensive medical data access:
- **Algolia MCP** - Medical literature search and indexing
- **PubMed MCP** - Research paper and clinical study access  
- **Clinical Trials MCP** - Trial search and eligibility matching
- **Medical Database MCP** - Drug interactions, ICD codes, guidelines
- **Medical Imaging MCP** - DICOM processing and analysis tools

## Development Commands

### Backend Development
```bash
cd backend
npm install
npm run dev              # Starts MedIntel server on http://127.0.0.1:3000
npm start                # Production start with full security
npm run test:medical     # Run medical-specific tests
npm run security-audit   # Security and dependency audit
npm run lint             # Code quality check
```

### Frontend Development  
```bash
cd frontend
npm install
npm run dev    # Starts live-server on http://127.0.0.1:5000
```

## Environment Setup

### Required Environment Variables (`backend/.env`)

**AI Configuration:**
- `GOOGLE_AI_API_KEY` - Google Gemini 2.5 Pro API key (primary)
- `GROQ_API_KEY` - Groq API key (fallback model)

**Medical MCP Paths:**
- `ALGOLIA_MCP_NODE_PATH` - Path to Algolia MCP application
- `PUBMED_MCP_NODE_PATH` - Path to PubMed MCP integration
- `CLINICAL_TRIALS_MCP_PATH` - Path to Clinical Trials MCP
- `MEDICAL_DB_MCP_PATH` - Path to Medical Database MCP
- `IMAGING_MCP_PATH` - Path to Medical Imaging MCP

**Database Configuration:**
- `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY` - Algolia search credentials
- `ALGOLIA_MEDICAL_INDEX` - Medical literature index name
- `PUBMED_API_KEY`, `NCBI_API_KEY` - PubMed/NCBI access
- `CLINICAL_TRIALS_API_KEY` - ClinicalTrials.gov API access

**Security & HIPAA Compliance:**
- `ENCRYPTION_KEY` - 256-bit encryption key for PHI protection
- `JWT_SECRET` - JWT signing key for session tokens
- `SESSION_SECRET` - Session encryption secret
- `HIPAA_AUDIT_ENABLED` - Enable audit logging (true/false)

**Medical AI Configuration:**
- `AI_MODEL_PREFERENCE` - Primary AI model (gemini/groq)
- `AI_CONFIDENCE_THRESHOLD` - Minimum confidence for medical responses (0.7)
- `ENABLE_MEDICAL_SAFETY_FILTERS` - Enable medical safety checks
- `MAX_IMAGE_SIZE_MB` - Maximum medical image size (50)
- `SUPPORTED_IMAGE_FORMATS` - Allowed formats (jpg,jpeg,png,dicom,tiff)

## Key Implementation Details

### Medical Intent Analysis System
The `medical-intent.util.js` provides sophisticated medical query classification:

**Clinical Intent Categories:**
- **Image Analysis**: `RADIOLOGY_ANALYSIS`, `DERMATOLOGY_ANALYSIS`, `PATHOLOGY_ANALYSIS`
- **Clinical Queries**: `DIFFERENTIAL_DIAGNOSIS`, `SYMPTOM_ANALYSIS`, `TREATMENT_OPTIONS`
- **Research**: `LITERATURE_SEARCH`, `CLINICAL_TRIALS`, `GUIDELINES_LOOKUP`
- **Safety**: `DRUG_INTERACTION`, `EMERGENCY_ASSESSMENT`
- **Specialty-Specific**: `CARDIOLOGY_ANALYSIS`, `NEUROLOGY_ANALYSIS`, `ONCOLOGY_ANALYSIS`

### Multi-MCP Tool Execution
Medical queries execute across multiple MCP clients simultaneously:
```javascript
// Parallel execution with graceful fallback
const mcpResults = await Promise.allSettled([
  mcpService.searchMedicalLiterature(query),
  mcpService.searchClinicalTrials(condition, demographics),
  mcpService.checkDrugInteractions(medications),
  mcpService.analyzeMedicalImage(imageData, specialty)
]);
```

### HIPAA Compliance Implementation
**Data Protection:**
- AES-256 encryption for all medical data
- PHI detection and sanitization in logs
- Secure session management with JWT tokens
- Audit logging for all medical interactions
- Rate limiting and access controls

**Security Middleware:**
- Request validation and sanitization
- Session authentication for medical endpoints
- File upload validation for medical images
- Automated PHI redaction in responses

### Medical Image Analysis Pipeline
1. **Upload Validation** - File type, size, and security checks
2. **Image Processing** - Format standardization with Sharp.js
3. **AI Analysis** - Gemini Vision API for medical image interpretation
4. **MCP Integration** - Additional analysis via medical imaging MCP
5. **Results Synthesis** - Combined analysis with confidence scoring
6. **Secure Storage** - Temporary encrypted storage with cleanup

### Differential Diagnosis Engine
**Clinical Reasoning Frameworks:**
- **Symptom-Based Analysis** - Systematic symptom evaluation
- **System-Based Analysis** - Organ system review methodology  
- **Demographic-Based Analysis** - Age/gender-specific considerations
- **Temporal Analysis** - Acute vs chronic presentation patterns

**Evidence Integration:**
- Medical literature search and synthesis
- Clinical guidelines consultation
- Risk factor assessment and weighting
- Urgency level classification

## API Endpoints

### Medical Endpoints (Require Authentication)
- `POST /api/medical-chat` - Medical conversation with image support
- `POST /api/medical/differential-diagnosis` - Generate differential diagnosis
- `POST /api/medical/clinical-trials` - Search clinical trials
- `POST /api/medical/drug-interactions` - Check medication interactions
- `POST /api/medical/image-analysis` - Analyze medical images
- `GET /api/medical/health` - Medical system health check
- `GET /api/medical/tools` - Available medical tools
- `GET /api/medical/compliance-report` - HIPAA compliance metrics

### Public Endpoints
- `POST /api/session` - Create secure medical session
- `GET /api/health` - General system health
- `GET /` - Platform information

## Dependencies

### Backend Medical Services
- `@google/generative-ai` - Gemini 2.5 Pro integration
- `@modelcontextprotocol/sdk` - Multi-MCP client management
- `express` + `helmet` - Secure web server
- `multer` + `sharp` - Medical image processing
- `crypto-js` + `jsonwebtoken` - Security and encryption
- `winston` - HIPAA-compliant audit logging
- `joi` + `express-validator` - Input validation
- `groq-sdk` - Fallback AI model

### Frontend Medical Interface
- `live-server` - Development server
- Medical API service classes for secure communication
- Enhanced chat components with medical context
- Professional healthcare UI theme

## Security & Compliance

### HIPAA Requirements Met
- ✅ **Administrative Safeguards** - Access controls and audit procedures
- ✅ **Physical Safeguards** - Secure data handling and storage
- ✅ **Technical Safeguards** - Encryption, access controls, audit logs
- ✅ **PHI Protection** - Automated detection and sanitization
- ✅ **Breach Notification** - Comprehensive audit and monitoring

### Security Features
- JWT-based session authentication with expiration
- AES-256 encryption for all medical data
- Rate limiting and DoS protection
- Input validation and sanitization
- Secure file upload with virus scanning
- PHI detection and automated redaction
- Comprehensive audit logging

## Testing Strategy

Medical platform testing should include:
- **Unit Tests** - Individual service and utility testing
- **Integration Tests** - MCP client and API endpoint testing  
- **Security Tests** - HIPAA compliance and penetration testing
- **Medical Accuracy Tests** - Clinical scenario validation
- **Performance Tests** - Load testing with medical workflows

Run medical tests:
```bash
npm run test:medical     # Medical functionality tests
npm run security-audit   # Security and compliance audit
```

## Development Guidelines

### Medical Code Standards
- All medical endpoints must require authentication
- Medical data must be encrypted at rest and in transit
- PHI must be detected and sanitized in all logs
- Medical responses must include appropriate disclaimers
- Confidence levels must be provided for AI analyses
- Emergency situations must be flagged immediately

### Error Handling
- Medical errors must not expose PHI in error messages
- Failed medical analyses must provide safe fallback responses
- Session timeouts must be handled gracefully
- MCP client failures must not crash the medical workflow

This sophisticated medical platform maintains the robust MCP architecture while adding comprehensive healthcare capabilities, security compliance, and clinical decision support tools.