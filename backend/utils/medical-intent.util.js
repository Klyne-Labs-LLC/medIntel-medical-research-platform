import { createLogger } from './logger.util.js';

const logger = createLogger('MedicalIntentAnalyzer');

/**
 * Advanced Medical Intent Analysis System
 * Analyzes user queries to determine medical context and required MCP tools
 */

export class MedicalIntentAnalyzer {
  constructor() {
    this.medicalIntents = {
      // Image Analysis Intents
      RADIOLOGY_ANALYSIS: {
        keywords: ['x-ray', 'xray', 'ct scan', 'ct-scan', 'mri', 'chest film', 'radiograph', 'mammogram', 'bone scan'],
        mcpTools: ['image_analysis', 'dicom_processing'],
        specialty: 'radiology',
        priority: 'high'
      },
      
      DERMATOLOGY_ANALYSIS: {
        keywords: ['skin lesion', 'rash', 'mole', 'dermatology', 'skin cancer', 'melanoma', 'dermatitis', 'eczema'],
        mcpTools: ['image_analysis', 'dermoscopy_analysis'],
        specialty: 'dermatology',
        priority: 'high'
      },
      
      PATHOLOGY_ANALYSIS: {
        keywords: ['biopsy', 'histology', 'pathology slide', 'tissue sample', 'cytology', 'histopathology'],
        mcpTools: ['image_analysis', 'pathology_analysis'],
        specialty: 'pathology',
        priority: 'high'
      },

      // Clinical Query Intents
      DIFFERENTIAL_DIAGNOSIS: {
        keywords: ['differential', 'diagnosis', 'what could this be', 'possible conditions', 'differential diagnosis', 'ddx'],
        mcpTools: ['pubmed_search', 'medical_guidelines', 'diagnostic_criteria'],
        specialty: 'general',
        priority: 'high'
      },
      
      SYMPTOM_ANALYSIS: {
        keywords: ['symptoms', 'presents with', 'patient has', 'complains of', 'clinical presentation', 'signs and symptoms'],
        mcpTools: ['symptom_checker', 'diagnostic_criteria', 'medical_guidelines'],
        specialty: 'general',
        priority: 'medium'
      },
      
      TREATMENT_OPTIONS: {
        keywords: ['treatment', 'therapy', 'management', 'how to treat', 'therapeutic options', 'intervention'],
        mcpTools: ['treatment_guidelines', 'drug_interactions', 'clinical_trials'],
        specialty: 'general',
        priority: 'high'
      },
      
      DRUG_INTERACTION: {
        keywords: ['drug interaction', 'medication', 'contraindication', 'side effects', 'adverse reactions', 'pharmacology'],
        mcpTools: ['drug_interactions', 'medication_guide', 'adverse_events'],
        specialty: 'pharmacology',
        priority: 'high'
      },

      // Research Intents
      LITERATURE_SEARCH: {
        keywords: ['research', 'studies', 'papers', 'evidence', 'meta-analysis', 'systematic review', 'literature'],
        mcpTools: ['pubmed_search', 'literature_search', 'citation_analysis'],
        specialty: 'research',
        priority: 'medium'
      },
      
      CLINICAL_TRIALS: {
        keywords: ['clinical trial', 'experimental treatment', 'trial eligibility', 'research study', 'enrollment'],
        mcpTools: ['clinical_trials_search', 'eligibility_check', 'recruitment_info'],
        specialty: 'research',
        priority: 'medium'
      },
      
      GUIDELINES_LOOKUP: {
        keywords: ['guidelines', 'protocol', 'standard of care', 'recommendations', 'best practices', 'clinical pathway'],
        mcpTools: ['guidelines_search', 'medical_protocols', 'standard_care'],
        specialty: 'general',
        priority: 'medium'
      },
      
      RARE_DISEASE: {
        keywords: ['rare disease', 'uncommon', 'orphan disease', 'zebra diagnosis', 'genetic disorder'],
        mcpTools: ['rare_disease_db', 'genetic_analysis', 'orphan_drugs'],
        specialty: 'genetics',
        priority: 'high'
      },

      // Emergency/Urgent Intents
      EMERGENCY_ASSESSMENT: {
        keywords: ['emergency', 'urgent', 'acute', 'critical', 'life-threatening', 'stat', 'code blue'],
        mcpTools: ['emergency_protocols', 'triage_guidelines', 'acute_care'],
        specialty: 'emergency_medicine',
        priority: 'critical'
      },

      // Specialty-Specific Intents
      CARDIOLOGY_ANALYSIS: {
        keywords: ['ecg', 'ekg', 'cardiac', 'heart', 'cardiovascular', 'chest pain', 'myocardial'],
        mcpTools: ['cardiology_guidelines', 'ecg_analysis', 'cardiac_risk'],
        specialty: 'cardiology',
        priority: 'high'
      },
      
      NEUROLOGY_ANALYSIS: {
        keywords: ['neurological', 'brain', 'seizure', 'stroke', 'headache', 'neurologic', 'cns'],
        mcpTools: ['neurology_guidelines', 'neuro_imaging', 'neurological_exam'],
        specialty: 'neurology',
        priority: 'high'
      },
      
      ONCOLOGY_ANALYSIS: {
        keywords: ['cancer', 'oncology', 'tumor', 'malignancy', 'chemotherapy', 'radiation', 'metastasis'],
        mcpTools: ['oncology_guidelines', 'cancer_staging', 'treatment_protocols'],
        specialty: 'oncology',
        priority: 'high'
      }
    };

    this.medicalSpecialties = [
      'cardiology', 'neurology', 'oncology', 'radiology', 'dermatology', 
      'pathology', 'internal_medicine', 'surgery', 'pediatrics', 'psychiatry',
      'emergency_medicine', 'anesthesiology', 'ophthalmology', 'orthopedics',
      'urology', 'gastroenterology', 'pulmonology', 'endocrinology'
    ];

    this.urgencyLevels = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
  }

  /**
   * Analyze medical intent from user message and context
   */
  analyzeMedicalIntent(userMessage, uploadedFiles = [], patientContext = {}) {
    try {
      const analysis = {
        detectedIntents: [],
        requiredMCPTools: new Set(),
        medicalSpecialty: 'general',
        urgencyLevel: 'medium',
        confidence: 0,
        hasImageUpload: uploadedFiles.length > 0,
        contextFactors: this.analyzeContextFactors(userMessage, patientContext),
        recommendations: []
      };

      // Normalize message for analysis
      const normalizedMessage = this.normalizeMessage(userMessage);

      // Check for uploaded medical images first
      if (uploadedFiles.length > 0) {
        const imageIntent = this.analyzeImageIntent(uploadedFiles);
        if (imageIntent) {
          analysis.detectedIntents.push(imageIntent.intent);
          imageIntent.mcpTools.forEach(tool => analysis.requiredMCPTools.add(tool));
          analysis.medicalSpecialty = imageIntent.specialty;
          analysis.urgencyLevel = imageIntent.priority;
        }
      }

      // Analyze text for medical intents
      const textIntents = this.analyzeTextIntents(normalizedMessage);
      textIntents.forEach(intent => {
        analysis.detectedIntents.push(intent.name);
        intent.mcpTools.forEach(tool => analysis.requiredMCPTools.add(tool));
        
        // Update specialty if more specific
        if (intent.specialty !== 'general' && analysis.medicalSpecialty === 'general') {
          analysis.medicalSpecialty = intent.specialty;
        }
        
        // Update urgency to highest priority
        if (this.urgencyLevels[intent.priority] < this.urgencyLevels[analysis.urgencyLevel]) {
          analysis.urgencyLevel = intent.priority;
        }
      });

      // Calculate confidence score
      analysis.confidence = this.calculateConfidence(analysis, normalizedMessage);

      // Convert Set to Array for JSON serialization
      analysis.requiredMCPTools = Array.from(analysis.requiredMCPTools);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);

      // Log the analysis for audit purposes
      logger.info('Medical intent analysis completed', {
        detectedIntents: analysis.detectedIntents,
        specialty: analysis.medicalSpecialty,
        urgency: analysis.urgencyLevel,
        confidence: analysis.confidence
      });

      return analysis;
    } catch (error) {
      logger.error('Medical intent analysis failed:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Normalize message for consistent analysis
   */
  normalizeMessage(message) {
    return message
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Analyze uploaded files to determine image-based intents
   */
  analyzeImageIntent(uploadedFiles) {
    for (const file of uploadedFiles) {
      const fileName = file.originalname?.toLowerCase() || '';
      const mimeType = file.mimetype?.toLowerCase() || '';

      // DICOM files - likely radiology
      if (fileName.includes('.dcm') || mimeType.includes('dicom')) {
        return {
          intent: 'RADIOLOGY_ANALYSIS',
          mcpTools: ['image_analysis', 'dicom_processing'],
          specialty: 'radiology',
          priority: 'high'
        };
      }

      // Medical image patterns
      if (fileName.includes('xray') || fileName.includes('ct') || fileName.includes('mri')) {
        return {
          intent: 'RADIOLOGY_ANALYSIS',
          mcpTools: ['image_analysis'],
          specialty: 'radiology',
          priority: 'high'
        };
      }

      if (fileName.includes('dermoscopy') || fileName.includes('skin')) {
        return {
          intent: 'DERMATOLOGY_ANALYSIS',
          mcpTools: ['image_analysis', 'dermoscopy_analysis'],
          specialty: 'dermatology',
          priority: 'high'
        };
      }

      if (fileName.includes('pathology') || fileName.includes('biopsy')) {
        return {
          intent: 'PATHOLOGY_ANALYSIS',
          mcpTools: ['image_analysis', 'pathology_analysis'],
          specialty: 'pathology',
          priority: 'high'
        };
      }
    }

    // Default for any medical image
    return {
      intent: 'MEDICAL_IMAGE_ANALYSIS',
      mcpTools: ['image_analysis'],
      specialty: 'general',
      priority: 'medium'
    };
  }

  /**
   * Analyze text content for medical intents
   */
  analyzeTextIntents(normalizedMessage) {
    const detectedIntents = [];

    Object.entries(this.medicalIntents).forEach(([intentName, intentData]) => {
      const keywordMatches = intentData.keywords.filter(keyword => 
        normalizedMessage.includes(keyword)
      );

      if (keywordMatches.length > 0) {
        const matchScore = keywordMatches.length / intentData.keywords.length;
        
        detectedIntents.push({
          name: intentName,
          mcpTools: intentData.mcpTools,
          specialty: intentData.specialty,
          priority: intentData.priority,
          matchScore,
          matchedKeywords: keywordMatches
        });
      }
    });

    // Sort by match score (highest first)
    return detectedIntents.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Analyze context factors that might influence intent
   */
  analyzeContextFactors(message, patientContext) {
    const factors = {
      hasPatientData: Object.keys(patientContext).length > 0,
      hasSymptoms: /symptom|pain|ache|discomfort|problem/i.test(message),
      hasMedications: /medication|drug|pill|tablet|prescription/i.test(message),
      hasTimeReference: /acute|chronic|sudden|gradual|recent|ongoing/i.test(message),
      hasUrgency: /urgent|emergency|immediate|stat|critical/i.test(message),
      hasImageReference: /image|picture|scan|photo|x-ray|mri|ct/i.test(message)
    };

    return factors;
  }

  /**
   * Calculate confidence score for the analysis
   */
  calculateConfidence(analysis, message) {
    let confidence = 0;

    // Base confidence from intent detection
    if (analysis.detectedIntents.length > 0) {
      confidence += 0.4;
    }

    // Bonus for image upload matching text intent
    if (analysis.hasImageUpload && analysis.contextFactors.hasImageReference) {
      confidence += 0.2;
    }

    // Bonus for multiple consistent intents
    if (analysis.detectedIntents.length > 1) {
      confidence += 0.1;
    }

    // Bonus for medical terminology density
    const medicalTermCount = this.countMedicalTerms(message);
    const messageLength = message.split(' ').length;
    const medicalDensity = medicalTermCount / messageLength;
    confidence += Math.min(medicalDensity * 0.3, 0.3);

    return Math.min(confidence, 1.0);
  }

  /**
   * Count medical terms in message
   */
  countMedicalTerms(message) {
    const medicalTerms = [
      'diagnosis', 'symptoms', 'treatment', 'medication', 'patient', 'clinical',
      'medical', 'disease', 'condition', 'syndrome', 'disorder', 'therapy',
      'prescription', 'dosage', 'side effects', 'contraindication', 'pathology'
    ];

    return medicalTerms.filter(term => 
      message.toLowerCase().includes(term)
    ).length;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Critical urgency recommendations
    if (analysis.urgencyLevel === 'critical') {
      recommendations.push({
        type: 'URGENT_ACTION',
        message: 'This query indicates a potential emergency. Consider immediate medical attention.',
        priority: 'critical'
      });
    }

    // Image analysis recommendations
    if (analysis.hasImageUpload) {
      recommendations.push({
        type: 'IMAGE_ANALYSIS',
        message: 'Medical image detected. Analysis will include imaging assessment.',
        priority: 'high'
      });
    }

    // MCP tool recommendations
    if (analysis.requiredMCPTools.includes('drug_interactions')) {
      recommendations.push({
        type: 'DRUG_SAFETY',
        message: 'Drug interaction check will be performed for medication safety.',
        priority: 'high'
      });
    }

    // Specialty consultation recommendations
    if (analysis.medicalSpecialty !== 'general') {
      recommendations.push({
        type: 'SPECIALTY_CONSULTATION',
        message: `Consider ${analysis.medicalSpecialty} specialist consultation for specialized care.`,
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Get default analysis for error cases
   */
  getDefaultAnalysis() {
    return {
      detectedIntents: ['GENERAL_MEDICAL_QUERY'],
      requiredMCPTools: ['medical_literature_search'],
      medicalSpecialty: 'general',
      urgencyLevel: 'medium',
      confidence: 0.1,
      hasImageUpload: false,
      contextFactors: {},
      recommendations: [{
        type: 'GENERAL',
        message: 'General medical information will be provided.',
        priority: 'low'
      }]
    };
  }

  /**
   * Get available medical specialties
   */
  getAvailableSpecialties() {
    return this.medicalSpecialties;
  }

  /**
   * Get all possible medical intents
   */
  getAllMedicalIntents() {
    return Object.keys(this.medicalIntents);
  }

  /**
   * Check if query requires immediate attention
   */
  isEmergencyQuery(message) {
    const emergencyKeywords = [
      'emergency', 'urgent', 'critical', 'life-threatening', 'acute',
      'severe pain', 'chest pain', 'difficulty breathing', 'unconscious',
      'seizure', 'stroke', 'heart attack', 'allergic reaction'
    ];

    const normalizedMessage = message.toLowerCase();
    return emergencyKeywords.some(keyword => normalizedMessage.includes(keyword));
  }
}

export default MedicalIntentAnalyzer;