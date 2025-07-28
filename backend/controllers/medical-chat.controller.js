import { createLogger } from '../utils/logger.util.js';
import { MedicalIntentAnalyzer } from '../utils/medical-intent.util.js';
import MedicalAIService from '../services/medical-ai.service.js';
import MedicalMCPService from '../services/medical-mcp.service.js';
import MedicalImageService from '../services/medical-image.service.js';
import DifferentialDiagnosisService from '../services/differential-diagnosis.service.js';
import HIPAAComplianceService from '../services/hipaa-compliance.service.js';

const logger = createLogger('MedicalChatController');

/**
 * Medical Chat Controller
 * Handles advanced medical conversations with multi-modal analysis
 */
export class MedicalChatController {
  constructor() {
    this.intentAnalyzer = new MedicalIntentAnalyzer();
    this.aiService = new MedicalAIService();
    this.mcpService = new MedicalMCPService();
    this.imageService = new MedicalImageService();
    this.diagnosisService = new DifferentialDiagnosisService();
    this.hipaaService = new HIPAAComplianceService();
    
    logger.info('Medical Chat Controller initialized');
  }

  /**
   * Handle medical chat with optional image upload
   */
  async handleMedicalChat(req, res) {
    const startTime = Date.now();
    
    try {
      const { message, patientContext, conversationHistory } = req.body;
      const uploadedFile = req.file;
      const sessionId = req.sessionId;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          error: 'Message is required',
          code: 'MISSING_MESSAGE'
        });
      }

      logger.info('Processing medical chat request', {
        sessionId: this.hipaaService.hashData(sessionId),
        hasMessage: !!message,
        hasImage: !!uploadedFile,
        hasPatientContext: !!patientContext,
        messageLength: message.length
      });

      // Analyze medical intent
      const intentAnalysis = this.intentAnalyzer.analyzeMedicalIntent(
        message,
        uploadedFile ? [uploadedFile] : [],
        patientContext ? JSON.parse(patientContext) : {}
      );

      // Process medical image if uploaded
      let imageAnalysis = null;
      if (uploadedFile) {
        try {
          imageAnalysis = await this.imageService.processUploadedImage(
            uploadedFile,
            sessionId,
            {
              analysisType: this.getImageAnalysisType(intentAnalysis),
              specialty: intentAnalysis.medicalSpecialty,
              confidenceThreshold: 0.7
            }
          );
        } catch (error) {
          logger.error('Image analysis failed:', error);
          imageAnalysis = {
            error: 'Image analysis failed',
            message: error.message
          };
        }
      }

      // Execute MCP tools based on intent
      const mcpResults = await this.executeMCPTools(
        intentAnalysis.requiredMCPTools,
        message,
        patientContext ? JSON.parse(patientContext) : {},
        imageAnalysis
      );

      // Generate AI response with medical context
      const aiResponse = await this.generateMedicalResponse(
        message,
        intentAnalysis,
        mcpResults,
        imageAnalysis,
        patientContext ? JSON.parse(patientContext) : {},
        conversationHistory || []
      );

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Prepare response
      const response = {
        response: aiResponse.content,
        medicalAnalysis: {
          intent: intentAnalysis,
          aiAnalysis: aiResponse.structuredData,
          imageAnalysis: imageAnalysis ? {
            imageId: imageAnalysis.imageId,
            analysis: imageAnalysis.analysis,
            secureAccess: imageAnalysis.secureAccess
          } : null,
          mcpResults: mcpResults,
          confidence: aiResponse.confidence || 0.5
        },
        recommendations: intentAnalysis.recommendations,
        safetyAlerts: this.generateSafetyAlerts(intentAnalysis, aiResponse),
        mcpTools: intentAnalysis.requiredMCPTools,
        processingTime,
        timestamp: new Date().toISOString(),
        disclaimer: aiResponse.disclaimer
      };

      // Audit successful medical interaction
      await this.hipaaService.logMedicalInteraction(sessionId, {
        action: 'medical_chat',
        resource: 'medical_ai',
        tools: intentAnalysis.requiredMCPTools,
        success: true,
        category: intentAnalysis.medicalSpecialty,
        processingTime
      });

      res.json(response);
    } catch (error) {
      logger.error('Medical chat request failed:', error);
      
      // Audit failed interaction
      await this.hipaaService.logMedicalInteraction(req.sessionId, {
        action: 'medical_chat',
        resource: 'medical_ai',
        success: false,
        error: error.message
      });

      res.status(500).json({
        error: 'Medical analysis failed',
        code: 'MEDICAL_ANALYSIS_ERROR',
        message: 'Unable to process medical request at this time',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle differential diagnosis request
   */
  async handleDifferentialDiagnosis(req, res) {
    try {
      const { clinicalData } = req.body;
      const sessionId = req.sessionId;

      if (!clinicalData) {
        return res.status(400).json({
          error: 'Clinical data is required',
          code: 'MISSING_CLINICAL_DATA'
        });
      }

      logger.info('Processing differential diagnosis request', {
        sessionId: this.hipaaService.hashData(sessionId),
        hasSymptoms: !!clinicalData.symptoms,
        hasHistory: !!clinicalData.history
      });

      const differential = await this.diagnosisService.generateDifferentialDiagnosis(
        clinicalData,
        sessionId
      );

      res.json({
        differential,
        generatedAt: new Date().toISOString(),
        disclaimer: {
          text: "This differential diagnosis is for educational and decision support purposes only. Clinical correlation and professional medical evaluation are required.",
          importance: "critical"
        }
      });
    } catch (error) {
      logger.error('Differential diagnosis failed:', error);
      res.status(500).json({
        error: 'Differential diagnosis generation failed',
        code: 'DIAGNOSIS_ERROR'
      });
    }
  }

  /**
   * Handle clinical trials search
   */
  async handleClinicalTrials(req, res) {
    try {
      const { condition, patientCriteria } = req.body;
      const sessionId = req.sessionId;

      if (!condition) {
        return res.status(400).json({
          error: 'Medical condition is required',
          code: 'MISSING_CONDITION'
        });
      }

      logger.info('Processing clinical trials search', {
        sessionId: this.hipaaService.hashData(sessionId),
        condition: condition,
        hasCriteria: !!patientCriteria
      });

      const trials = await this.mcpService.searchClinicalTrials(
        condition,
        patientCriteria || {}
      );

      res.json({
        condition,
        trials,
        searchTimestamp: new Date().toISOString(),
        disclaimer: {
          text: "Clinical trial information is for reference only. Consult with healthcare providers for eligibility and enrollment guidance.",
          importance: "high"
        }
      });
    } catch (error) {
      logger.error('Clinical trials search failed:', error);
      res.status(500).json({
        error: 'Clinical trials search failed',
        code: 'TRIALS_SEARCH_ERROR'
      });
    }
  }

  /**
   * Handle drug interactions check
   */
  async handleDrugInteractions(req, res) {
    try {
      const { medications, newDrug } = req.body;
      const sessionId = req.sessionId;

      if (!medications || !Array.isArray(medications)) {
        return res.status(400).json({
          error: 'Medications list is required',
          code: 'MISSING_MEDICATIONS'
        });
      }

      logger.info('Processing drug interactions check', {
        sessionId: this.hipaaService.hashData(sessionId),
        medicationCount: medications.length,
        hasNewDrug: !!newDrug
      });

      const interactions = await this.mcpService.checkDrugInteractions(
        medications,
        newDrug
      );

      res.json({
        interactions,
        medications: medications.map(med => typeof med === 'string' ? med : med.name),
        newDrug,
        checkTimestamp: new Date().toISOString(),
        disclaimer: {
          text: "Drug interaction information is for reference only. Always consult with pharmacists or healthcare providers before making medication changes.",
          importance: "critical"
        }
      });
    } catch (error) {
      logger.error('Drug interactions check failed:', error);
      res.status(500).json({
        error: 'Drug interactions check failed',
        code: 'DRUG_INTERACTIONS_ERROR'
      });
    }
  }

  /**
   * Handle medical image analysis
   */
  async handleImageAnalysis(req, res) {
    try {
      const { clinicalContext, analysisOptions } = req.body;
      const uploadedFile = req.file;
      const sessionId = req.sessionId;

      if (!uploadedFile) {
        return res.status(400).json({
          error: 'Medical image is required',
          code: 'MISSING_IMAGE'
        });
      }

      logger.info('Processing medical image analysis', {
        sessionId: this.hipaaService.hashData(sessionId),
        imageSize: uploadedFile.size,
        imageType: uploadedFile.mimetype
      });

      const imageAnalysis = await this.imageService.processUploadedImage(
        uploadedFile,
        sessionId,
        JSON.parse(analysisOptions || '{}')
      );

      res.json({
        imageId: imageAnalysis.imageId,
        analysis: imageAnalysis.analysis,
        secureAccess: imageAnalysis.secureAccess,
        processingMetadata: imageAnalysis.processingMetadata,
        clinicalContext: clinicalContext || '',
        analysisTimestamp: new Date().toISOString(),
        disclaimer: {
          text: "Medical image analysis is AI-assisted and requires professional radiologist review. Not intended for sole diagnostic use.",
          importance: "critical"
        }
      });
    } catch (error) {
      logger.error('Medical image analysis failed:', error);
      res.status(500).json({
        error: 'Medical image analysis failed',
        code: 'IMAGE_ANALYSIS_ERROR',
        details: error.message
      });
    }
  }

  /**
   * Execute MCP tools based on intent analysis
   */
  async executeMCPTools(requiredTools, message, patientContext, imageAnalysis) {
    const mcpResults = {};
    const toolPromises = [];

    // Execute tools in parallel where possible
    requiredTools.forEach(tool => {
      switch (tool) {
        case 'pubmed_search':
        case 'medical_literature_search':
          toolPromises.push(
            this.mcpService.searchMedicalLiterature(message, {
              limit: 5,
              filters: { evidenceLevel: ['high', 'moderate'] }
            }).then(result => ({ tool: 'literature', result }))
          );
          break;

        case 'clinical_trials_search':
          if (patientContext.condition) {
            toolPromises.push(
              this.mcpService.searchClinicalTrials(
                patientContext.condition,
                patientContext.demographics || {}
              ).then(result => ({ tool: 'clinical_trials', result }))
            );
          }
          break;

        case 'drug_interactions':
          if (patientContext.medications) {
            toolPromises.push(
              this.mcpService.checkDrugInteractions(
                patientContext.medications
              ).then(result => ({ tool: 'drug_interactions', result }))
            );
          }
          break;

        case 'medical_guidelines':
          toolPromises.push(
            this.mcpService.getMedicalGuidelines(
              message,
              patientContext.specialty
            ).then(result => ({ tool: 'guidelines', result }))
          );
          break;
      }
    });

    try {
      const results = await Promise.allSettled(toolPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          mcpResults[result.value.tool] = result.value.result;
        }
      });
    } catch (error) {
      logger.error('MCP tools execution failed:', error);
    }

    return mcpResults;
  }

  /**
   * Generate medical response with all context
   */
  async generateMedicalResponse(message, intentAnalysis, mcpResults, imageAnalysis, patientContext, conversationHistory) {
    try {
      // Determine analysis type based on intent
      let analysisType = 'general';
      if (intentAnalysis.detectedIntents.includes('DIFFERENTIAL_DIAGNOSIS')) {
        analysisType = 'differential_diagnosis';
      } else if (intentAnalysis.detectedIntents.includes('TREATMENT_OPTIONS')) {
        analysisType = 'treatment_planning';
      } else if (imageAnalysis) {
        analysisType = 'image_analysis';
      }

      // Prepare comprehensive context
      const comprehensiveContext = {
        ...patientContext,
        sessionId: 'medical_session',
        medicalSpecialty: intentAnalysis.medicalSpecialty,
        urgencyLevel: intentAnalysis.urgencyLevel,
        imageAnalysis: imageAnalysis?.analysis || null,
        conversationHistory: conversationHistory.slice(-5) // Last 5 messages for context
      };

      const aiResponse = await this.aiService.generateMedicalResponse(
        message,
        mcpResults,
        comprehensiveContext,
        analysisType
      );

      return aiResponse;
    } catch (error) {
      logger.error('Medical response generation failed:', error);
      throw error;
    }
  }

  /**
   * Get image analysis type from intent
   */
  getImageAnalysisType(intentAnalysis) {
    if (intentAnalysis.detectedIntents.includes('RADIOLOGY_ANALYSIS')) {
      return 'diagnostic_radiology';
    } else if (intentAnalysis.detectedIntents.includes('DERMATOLOGY_ANALYSIS')) {
      return 'dermatological_assessment';
    } else if (intentAnalysis.detectedIntents.includes('PATHOLOGY_ANALYSIS')) {
      return 'pathological_analysis';
    }
    return 'general_medical_imaging';
  }

  /**
   * Generate safety alerts based on analysis
   */
  generateSafetyAlerts(intentAnalysis, aiResponse) {
    const alerts = [];

    // Emergency situation alerts
    if (intentAnalysis.urgencyLevel === 'critical') {
      alerts.push({
        type: 'EMERGENCY',
        level: 'critical',
        message: 'This query indicates a potential medical emergency. Seek immediate medical attention.',
        action: 'Call emergency services or go to the nearest emergency room immediately'
      });
    }

    // Image analysis alerts
    if (intentAnalysis.hasImageUpload) {
      alerts.push({
        type: 'IMAGE_ANALYSIS',
        level: 'high',
        message: 'Medical image analysis requires professional review.',
        action: 'Consult with a qualified radiologist or specialist for definitive interpretation'
      });
    }

    // Drug interaction alerts
    if (intentAnalysis.requiredMCPTools.includes('drug_interactions')) {
      alerts.push({
        type: 'MEDICATION_SAFETY',
        level: 'high',
        message: 'Drug interaction information provided.',
        action: 'Verify all medication interactions with your pharmacist or healthcare provider'
      });
    }

    // AI confidence alerts
    if (aiResponse.confidence < 0.6) {
      alerts.push({
        type: 'LOW_CONFIDENCE',
        level: 'medium',
        message: 'AI analysis has lower confidence for this query.',
        action: 'Consider seeking additional medical opinions or specialized consultation'
      });
    }

    return alerts;
  }

  /**
   * Health check for medical chat controller
   */
  async healthCheck(req, res) {
    try {
      const health = {
        service: 'MedicalChatController',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {}
      };

      // Check AI service
      const aiHealth = await this.aiService.performHealthCheck();
      health.components.aiService = aiHealth;

      // Check MCP service
      const mcpHealth = this.mcpService.getConnectionSummary();
      health.components.mcpService = mcpHealth;

      // Check image service
      const imageHealth = await this.imageService.performHealthCheck();
      health.components.imageService = imageHealth;

      // Determine overall status
      const componentStatuses = Object.values(health.components).map(c => c.status || 'unknown');
      if (componentStatuses.includes('unhealthy')) {
        health.status = 'unhealthy';
      } else if (componentStatuses.includes('degraded')) {
        health.status = 'degraded';
      }

      res.json(health);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        service: 'MedicalChatController',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export controller instance
const medicalChatController = new MedicalChatController();

export const handleMedicalChat = medicalChatController.handleMedicalChat.bind(medicalChatController);
export const handleDifferentialDiagnosis = medicalChatController.handleDifferentialDiagnosis.bind(medicalChatController);
export const handleClinicalTrials = medicalChatController.handleClinicalTrials.bind(medicalChatController);
export const handleDrugInteractions = medicalChatController.handleDrugInteractions.bind(medicalChatController);
export const handleImageAnalysis = medicalChatController.handleImageAnalysis.bind(medicalChatController);
export const healthCheck = medicalChatController.healthCheck.bind(medicalChatController);

export default medicalChatController;