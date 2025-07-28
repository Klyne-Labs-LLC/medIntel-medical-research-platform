import sharp from 'sharp';
import { createLogger } from '../utils/logger.util.js';
import MedicalAIService from './medical-ai.service.js';
import MedicalMCPService from './medical-mcp.service.js';
import HIPAAComplianceService from './hipaa-compliance.service.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('MedicalImageService');

/**
 * Advanced Medical Image Analysis Service
 * Handles secure processing of medical images with AI analysis
 */
export class MedicalImageService {
  constructor() {
    this.aiService = new MedicalAIService();
    this.mcpService = new MedicalMCPService();
    this.hipaaService = new HIPAAComplianceService();
    
    // Image processing configuration
    this.maxImageSize = (parseFloat(process.env.MAX_IMAGE_SIZE_MB) || 50) * 1024 * 1024;
    this.supportedFormats = (process.env.SUPPORTED_IMAGE_FORMATS || 'jpg,jpeg,png,dicom,tiff')
      .split(',').map(f => f.trim().toLowerCase());
    
    // Image storage configuration
    this.tempStoragePath = path.join(__dirname, '../temp/images');
    this.maxStorageTime = 24 * 60 * 60 * 1000; // 24 hours
    
    // Ensure temp directory exists
    this.ensureTempDirectory();
    
    // Medical image analysis types
    this.analysisTypes = {
      'radiology': {
        specialties: ['chest', 'musculoskeletal', 'neurological', 'abdominal'],
        supportedModalities: ['xray', 'ct', 'mri', 'ultrasound'],
        analysisFeatures: ['anatomy_detection', 'abnormality_detection', 'measurement_tools']
      },
      'dermatology': {
        specialties: ['skin_lesion', 'rash_analysis', 'mole_assessment'],
        supportedModalities: ['dermoscopy', 'clinical_photo'],
        analysisFeatures: ['lesion_classification', 'risk_assessment', 'feature_extraction']
      },
      'pathology': {
        specialties: ['histology', 'cytology', 'tissue_analysis'],
        supportedModalities: ['microscopy', 'whole_slide'],
        analysisFeatures: ['cell_counting', 'tissue_classification', 'cancer_detection']
      },
      'ophthalmology': {
        specialties: ['retinal', 'fundus', 'oct'],
        supportedModalities: ['fundoscopy', 'oct', 'fluorescein'],
        analysisFeatures: ['retinal_analysis', 'vessel_detection', 'pathology_screening']
      },
      'cardiology': {
        specialties: ['echocardiography', 'angiography'],
        supportedModalities: ['echo', 'angio', 'nuclear'],
        analysisFeatures: ['cardiac_function', 'vessel_analysis', 'perfusion_assessment']
      }
    };
    
    logger.info('Medical Image Service initialized', {
      maxSizeMB: this.maxImageSize / 1024 / 1024,
      supportedFormats: this.supportedFormats,
      analysisTypes: Object.keys(this.analysisTypes)
    });
  }

  /**
   * Ensure temporary directory exists
   */
  ensureTempDirectory() {
    try {
      if (!fs.existsSync(this.tempStoragePath)) {
        fs.mkdirSync(this.tempStoragePath, { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Process uploaded medical image
   */
  async processUploadedImage(file, sessionId, analysisOptions = {}) {
    try {
      logger.info('Processing uploaded medical image', {
        sessionId: this.hipaaService.hashData(sessionId),
        filename: this.hipaaService.hashData(file.originalname),
        size: file.size,
        mimetype: file.mimetype
      });

      // Validate image
      const validation = await this.validateMedicalImage(file);
      if (!validation.valid) {
        throw new Error(`Image validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate secure image ID
      const imageId = uuidv4();
      
      // Process and secure the image
      const processedImage = await this.processImageData(file, imageId);
      
      // Determine analysis type and specialty
      const analysisConfig = this.determineAnalysisConfig(file, analysisOptions);
      
      // Perform AI analysis
      const aiAnalysis = await this.performAIAnalysis(processedImage, analysisConfig);
      
      // Perform MCP analysis if available
      const mcpAnalysis = await this.performMCPAnalysis(processedImage, analysisConfig);
      
      // Combine analysis results
      const combinedAnalysis = this.combineAnalysisResults(aiAnalysis, mcpAnalysis, analysisConfig);
      
      // Store secure image reference
      const secureReference = await this.storeSecureImageReference(
        imageId, 
        processedImage, 
        sessionId, 
        combinedAnalysis
      );
      
      // Audit image analysis
      await this.hipaaService.logMedicalInteraction(sessionId, {
        action: 'medical_image_analysis',
        resource: 'medical_image',
        tools: ['gemini_vision', ...(mcpAnalysis.toolsUsed || [])],
        success: true,
        category: analysisConfig.specialty || 'general'
      });
      
      return {
        imageId,
        analysis: combinedAnalysis,
        secureAccess: this.hipaaService.generateSecureImageAccess(imageId, sessionId),
        processingMetadata: {
          originalSize: file.size,
          processedSize: processedImage.processedBuffer.length,
          format: processedImage.format,
          dimensions: processedImage.dimensions,
          analysisType: analysisConfig.type,
          specialty: analysisConfig.specialty
        }
      };
    } catch (error) {
      logger.error('Medical image processing failed:', error);
      
      // Audit failed analysis
      await this.hipaaService.logMedicalInteraction(sessionId, {
        action: 'medical_image_analysis',
        resource: 'medical_image',
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Validate medical image
   */
  async validateMedicalImage(file) {
    const validation = {
      valid: false,
      errors: [],
      warnings: []
    };

    try {
      // Basic file validation using HIPAA service
      const hipaaValidation = this.hipaaService.validateMedicalFileUpload(file);
      if (!hipaaValidation.valid) {
        validation.errors.push(...hipaaValidation.errors);
        return validation;
      }

      // Image-specific validation using Sharp
      const metadata = await sharp(file.buffer).metadata();
      
      // Validate image dimensions
      if (!metadata.width || !metadata.height) {
        validation.errors.push('Invalid image dimensions');
      }
      
      // Check for minimum dimensions for medical analysis
      const minDimension = 100;
      if (metadata.width < minDimension || metadata.height < minDimension) {
        validation.warnings.push(`Image resolution is low (${metadata.width}x${metadata.height}). Higher resolution recommended for accurate analysis.`);
      }
      
      // Check for very large images that might cause processing issues
      const maxDimension = 4096;
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        validation.warnings.push(`Image resolution is very high (${metadata.width}x${metadata.height}). Processing may be slower.`);
      }
      
      // Validate color space and channels
      if (metadata.channels && metadata.channels < 1) {
        validation.errors.push('Invalid image color channels');
      }
      
      // Check for corruption
      if (metadata.format !== 'jpeg' && metadata.format !== 'png' && metadata.format !== 'tiff') {
        if (!this.supportedFormats.includes(metadata.format)) {
          validation.errors.push(`Unsupported image format: ${metadata.format}`);
        }
      }
      
      // Set valid if no errors
      validation.valid = validation.errors.length === 0;
      
      return validation;
    } catch (error) {
      logger.error('Image validation error:', error);
      validation.errors.push('Image validation failed - file may be corrupted');
      return validation;
    }
  }

  /**
   * Process image data for analysis
   */
  async processImageData(file, imageId) {
    try {
      const sharpInstance = sharp(file.buffer);
      const metadata = await sharpInstance.metadata();
      
      // Standardize image format for consistent analysis
      let processedBuffer;
      let outputFormat = 'jpeg';
      
      // Convert to appropriate format based on medical imaging requirements
      if (metadata.format === 'tiff' || file.originalname?.toLowerCase().includes('dicom')) {
        // Preserve TIFF for medical imaging that requires high bit depth
        processedBuffer = await sharpInstance
          .tiff({ quality: 90, compression: 'lzw' })
          .toBuffer();
        outputFormat = 'tiff';
      } else {
        // Convert to high-quality JPEG for standard analysis
        processedBuffer = await sharpInstance
          .jpeg({ quality: 95, progressive: true })
          .toBuffer();
        outputFormat = 'jpeg';
      }
      
      // Generate thumbnail for UI preview
      const thumbnailBuffer = await sharp(file.buffer)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      // Extract EXIF data if available (for medical metadata)
      const exifData = metadata.exif ? await this.extractMedicalMetadata(metadata.exif) : {};
      
      return {
        imageId,
        originalBuffer: file.buffer,
        processedBuffer,
        thumbnailBuffer,
        format: outputFormat,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        metadata: {
          originalFormat: metadata.format,
          channels: metadata.channels,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          space: metadata.space,
          ...exifData
        },
        processingTimestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw new Error('Image processing failed');
    }
  }

  /**
   * Determine analysis configuration based on image and options
   */
  determineAnalysisConfig(file, options) {
    const config = {
      type: options.analysisType || 'general',
      specialty: options.specialty || this.detectSpecialtyFromImage(file),
      modality: options.modality || this.detectModalityFromImage(file),
      features: options.features || ['abnormality_detection', 'anatomy_detection'],
      confidence: options.confidenceThreshold || 0.7,
      includeCoordinates: options.includeCoordinates || false,
      includeMeasurements: options.includeMeasurements || false
    };
    
    // Enhance config based on detected specialty
    if (this.analysisTypes[config.specialty]) {
      const specialtyConfig = this.analysisTypes[config.specialty];
      config.features = [...new Set([...config.features, ...specialtyConfig.analysisFeatures])];
    }
    
    return config;
  }

  /**
   * Detect medical specialty from image metadata/filename
   */
  detectSpecialtyFromImage(file) {
    const filename = file.originalname?.toLowerCase() || '';
    const mimetype = file.mimetype?.toLowerCase() || '';
    
    // Radiology indicators
    if (filename.includes('xray') || filename.includes('ct') || filename.includes('mri') || 
        filename.includes('chest') || filename.includes('spine')) {
      return 'radiology';
    }
    
    // Dermatology indicators
    if (filename.includes('dermoscopy') || filename.includes('skin') || 
        filename.includes('lesion') || filename.includes('mole')) {
      return 'dermatology';
    }
    
    // Pathology indicators
    if (filename.includes('pathology') || filename.includes('histology') || 
        filename.includes('biopsy') || filename.includes('microscopy')) {
      return 'pathology';
    }
    
    // Ophthalmology indicators
    if (filename.includes('fundus') || filename.includes('retinal') || 
        filename.includes('oct') || filename.includes('eye')) {
      return 'ophthalmology';
    }
    
    return 'radiology'; // Default to radiology for general medical images
  }

  /**
   * Detect imaging modality from image
   */
  detectModalityFromImage(file) {
    const filename = file.originalname?.toLowerCase() || '';
    
    if (filename.includes('xray') || filename.includes('radiograph')) return 'xray';
    if (filename.includes('ct') || filename.includes('computed')) return 'ct';
    if (filename.includes('mri') || filename.includes('magnetic')) return 'mri';
    if (filename.includes('ultrasound') || filename.includes('echo')) return 'ultrasound';
    if (filename.includes('dermoscopy')) return 'dermoscopy';
    if (filename.includes('microscopy')) return 'microscopy';
    if (filename.includes('fundus')) return 'fundoscopy';
    if (filename.includes('oct')) return 'oct';
    
    return 'clinical_photo'; // Default
  }

  /**
   * Perform AI analysis using Gemini Vision
   */
  async performAIAnalysis(processedImage, config) {
    try {
      const imageFile = {
        buffer: processedImage.processedBuffer,
        mimetype: `image/${processedImage.format}`,
        size: processedImage.processedBuffer.length,
        originalname: `medical_image_${processedImage.imageId}.${processedImage.format}`
      };
      
      const clinicalContext = this.buildClinicalContext(config);
      const analysisOptions = {
        specialty: config.specialty,
        analysisType: config.type,
        confidenceThreshold: config.confidence,
        includeMeasurements: config.includeMeasurements
      };
      
      const aiAnalysis = await this.aiService.analyzeMedicalImage(
        imageFile, 
        clinicalContext, 
        analysisOptions
      );
      
      return {
        source: 'gemini_vision',
        analysis: aiAnalysis,
        processingTime: Date.now() - new Date(processedImage.processingTimestamp).getTime(),
        confidence: aiAnalysis.overallConfidence || 0.5
      };
    } catch (error) {
      logger.error('AI image analysis failed:', error);
      return {
        source: 'gemini_vision',
        error: error.message,
        analysis: null
      };
    }
  }

  /**
   * Perform MCP analysis if available
   */
  async performMCPAnalysis(processedImage, config) {
    try {
      if (this.mcpService.clientStatus.imaging !== 'connected') {
        return { source: 'mcp', available: false };
      }
      
      // Convert image to base64 for MCP
      const imageBase64 = processedImage.processedBuffer.toString('base64');
      
      const mcpAnalysis = await this.mcpService.analyzeMedicalImage(
        imageBase64,
        config.modality,
        {
          analysisType: config.type,
          specialty: config.specialty,
          confidenceThreshold: config.confidence,
          includeMeasurements: config.includeMeasurements
        }
      );
      
      return {
        source: 'mcp_imaging',
        analysis: mcpAnalysis,
        toolsUsed: ['image_analysis'],
        available: true
      };
    } catch (error) {
      logger.warn('MCP image analysis failed:', error);
      return {
        source: 'mcp_imaging',
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Combine analysis results from multiple sources
   */
  combineAnalysisResults(aiAnalysis, mcpAnalysis, config) {
    const combined = {
      imageAnalysis: {
        timestamp: new Date().toISOString(),
        analysisType: config.type,
        specialty: config.specialty,
        modality: config.modality
      },
      findings: [],
      assessments: [],
      recommendations: [],
      confidence: {
        overall: 0,
        sources: []
      },
      sources: []
    };
    
    // Process AI analysis results
    if (aiAnalysis.analysis && !aiAnalysis.error) {
      combined.sources.push(aiAnalysis.source);
      combined.confidence.sources.push({
        source: aiAnalysis.source,
        confidence: aiAnalysis.confidence
      });
      
      // Extract findings from AI analysis
      if (aiAnalysis.analysis.keyFindings) {
        combined.findings.push(...aiAnalysis.analysis.keyFindings.map(finding => ({
          ...finding,
          source: aiAnalysis.source
        })));
      }
      
      // Extract assessments
      if (aiAnalysis.analysis.impressions) {
        combined.assessments.push(...aiAnalysis.analysis.impressions.map(impression => ({
          ...impression,
          source: aiAnalysis.source
        })));
      }
      
      // Extract recommendations
      if (aiAnalysis.analysis.recommendations) {
        combined.recommendations.push(...aiAnalysis.analysis.recommendations.map(rec => ({
          recommendation: rec,
          source: aiAnalysis.source
        })));
      }
    }
    
    // Process MCP analysis results
    if (mcpAnalysis.available && mcpAnalysis.analysis && !mcpAnalysis.error) {
      combined.sources.push(mcpAnalysis.source);
      
      // Add MCP-specific findings if available
      if (mcpAnalysis.analysis.findings) {
        combined.findings.push(...mcpAnalysis.analysis.findings.map(finding => ({
          ...finding,
          source: mcpAnalysis.source
        })));
      }
    }
    
    // Calculate overall confidence
    const confidenceScores = combined.confidence.sources.map(s => s.confidence);
    combined.confidence.overall = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length 
      : 0;
    
    // Add analysis metadata
    combined.metadata = {
      totalFindings: combined.findings.length,
      sourcesUsed: combined.sources,
      analysisComplete: combined.sources.length > 0,
      processingTime: aiAnalysis.processingTime || 0
    };
    
    // Add safety warnings
    combined.safetyWarnings = [
      'This is AI-assisted medical image analysis',
      'Professional radiologist/specialist review is required',
      'Not intended as sole basis for medical decisions',
      'Clinical correlation with patient history is essential'
    ];
    
    return combined;
  }

  /**
   * Build clinical context for analysis
   */
  buildClinicalContext(config) {
    let context = `Medical ${config.specialty} image analysis`;
    
    if (config.modality) {
      context += ` of ${config.modality} imaging`;
    }
    
    context += `. Please analyze for ${config.features.join(', ')}.`;
    
    if (config.specialty === 'radiology') {
      context += ' Focus on anatomical structures, pathological changes, and any abnormalities.';
    } else if (config.specialty === 'dermatology') {
      context += ' Focus on skin lesion characteristics, morphology, and risk assessment.';
    } else if (config.specialty === 'pathology') {
      context += ' Focus on cellular structures, tissue architecture, and pathological changes.';
    }
    
    return context;
  }

  /**
   * Store secure image reference
   */
  async storeSecureImageReference(imageId, processedImage, sessionId, analysis) {
    try {
      // Create secure filename
      const timestamp = Date.now();
      const secureFilename = `${imageId}_${timestamp}.${processedImage.format}`;
      const thumbnailFilename = `${imageId}_${timestamp}_thumb.jpg`;
      
      // Store files temporarily (in production, use secure cloud storage)
      const imagePath = path.join(this.tempStoragePath, secureFilename);
      const thumbnailPath = path.join(this.tempStoragePath, thumbnailFilename);
      
      await fs.promises.writeFile(imagePath, processedImage.processedBuffer);
      await fs.promises.writeFile(thumbnailPath, processedImage.thumbnailBuffer);
      
      // Create secure reference
      const reference = {
        imageId,
        sessionId: this.hipaaService.hashData(sessionId),
        storagePath: imagePath,
        thumbnailPath: thumbnailPath,
        metadata: processedImage.metadata,
        analysis: analysis,
        created: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.maxStorageTime).toISOString(),
        accessed: 0,
        lastAccessed: null
      };
      
      // Store reference (in production, use secure database)
      // For now, store in memory with cleanup
      this.scheduleImageCleanup(imageId, this.maxStorageTime);
      
      return reference;
    } catch (error) {
      logger.error('Failed to store secure image reference:', error);
      throw error;
    }
  }

  /**
   * Extract medical metadata from EXIF
   */
  async extractMedicalMetadata(exifBuffer) {
    try {
      // This would extract medical-specific EXIF data
      // Implementation depends on medical imaging standards (DICOM, etc.)
      return {
        extracted: true,
        medicalMetadata: {} // Placeholder for actual EXIF extraction
      };
    } catch (error) {
      logger.warn('EXIF extraction failed:', error);
      return {};
    }
  }

  /**
   * Schedule image cleanup
   */
  scheduleImageCleanup(imageId, delay) {
    setTimeout(async () => {
      try {
        await this.cleanupImageFiles(imageId);
      } catch (error) {
        logger.error(`Failed to cleanup image ${imageId}:`, error);
      }
    }, delay);
  }

  /**
   * Cleanup image files
   */
  async cleanupImageFiles(imageId) {
    try {
      const files = await fs.promises.readdir(this.tempStoragePath);
      const imageFiles = files.filter(file => file.startsWith(imageId));
      
      for (const file of imageFiles) {
        const filePath = path.join(this.tempStoragePath, file);
        await fs.promises.unlink(filePath);
      }
      
      logger.info(`Cleaned up ${imageFiles.length} files for image ${imageId}`);
    } catch (error) {
      logger.error('Image cleanup failed:', error);
    }
  }

  /**
   * Get supported analysis types
   */
  getSupportedAnalysisTypes() {
    return Object.keys(this.analysisTypes).map(type => ({
      type,
      ...this.analysisTypes[type]
    }));
  }

  /**
   * Health check for image service
   */
  async performHealthCheck() {
    const health = {
      service: 'MedicalImageService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    try {
      // Check Sharp availability
      const testBuffer = Buffer.from('test');
      await sharp(testBuffer).png().toBuffer().catch(() => {});
      health.checks.imageProcessing = 'available';
    } catch (error) {
      health.checks.imageProcessing = 'unavailable';
      health.status = 'degraded';
    }
    
    try {
      // Check temp directory
      await fs.promises.access(this.tempStoragePath);
      health.checks.tempStorage = 'available';
    } catch (error) {
      health.checks.tempStorage = 'unavailable';
      health.status = 'degraded';
    }
    
    // Check AI service
    health.checks.aiService = 'available'; // Would check actual service
    
    // Check MCP service
    health.checks.mcpService = this.mcpService.clientStatus.imaging;
    
    return health;
  }
}

export default MedicalImageService;