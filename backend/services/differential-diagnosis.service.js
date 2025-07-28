import { createLogger } from '../utils/logger.util.js';
import MedicalAIService from './medical-ai.service.js';
import MedicalMCPService from './medical-mcp.service.js';
import HIPAAComplianceService from './hipaa-compliance.service.js';

const logger = createLogger('DifferentialDiagnosisService');

/**
 * Advanced Differential Diagnosis Engine
 * Provides systematic clinical reasoning and diagnostic suggestions
 */
export class DifferentialDiagnosisService {
  constructor() {
    this.aiService = new MedicalAIService();
    this.mcpService = new MedicalMCPService();
    this.hipaaService = new HIPAAComplianceService();
    
    // Clinical reasoning frameworks
    this.diagnosticFrameworks = {
      'symptom_based': {
        name: 'Symptom-Based Analysis',
        approach: 'systematic_review_by_symptoms',
        priority: ['life_threatening', 'common', 'treatable']
      },
      'system_based': {
        name: 'System-Based Analysis',
        approach: 'organ_system_review',
        priority: ['cardiovascular', 'respiratory', 'neurological', 'gastrointestinal']
      },
      'demographic_based': {
        name: 'Demographic-Based Analysis',
        approach: 'age_gender_specific',
        priority: ['age_specific', 'gender_specific', 'genetic_predisposition']
      },
      'temporal_based': {
        name: 'Temporal Pattern Analysis',
        approach: 'timeline_analysis',
        priority: ['acute', 'subacute', 'chronic']
      }
    };
    
    // Evidence weighting system
    this.evidenceWeights = {
      'pathognomonic': 10,      // Diagnostic sign/symptom
      'highly_suggestive': 7,   // Strong association
      'suggestive': 5,          // Moderate association
      'supportive': 3,          // Weak association
      'nonspecific': 1,         // Present but not specific
      'against': -3,            // Evidence against diagnosis
      'excludes': -10           // Excludes diagnosis
    };
    
    // Urgency classification
    this.urgencyLevels = {
      'immediate': {
        timeframe: 'minutes',
        description: 'Life-threatening, requires immediate intervention',
        examples: ['myocardial_infarction', 'stroke', 'anaphylaxis', 'sepsis']
      },
      'urgent': {
        timeframe: 'hours',
        description: 'Serious condition requiring prompt medical attention',
        examples: ['appendicitis', 'pneumonia', 'diabetic_ketoacidosis']
      },
      'semi_urgent': {
        timeframe: 'days',
        description: 'Needs medical evaluation within days',
        examples: ['cellulitis', 'depression', 'hypertension']
      },
      'non_urgent': {
        timeframe: 'weeks',
        description: 'Can be evaluated in routine care',
        examples: ['chronic_fatigue', 'mild_anxiety', 'routine_screening']
      }
    };
    
    logger.info('Differential Diagnosis Service initialized', {
      frameworks: Object.keys(this.diagnosticFrameworks),
      evidenceWeights: Object.keys(this.evidenceWeights),
      urgencyLevels: Object.keys(this.urgencyLevels)
    });
  }

  /**
   * Generate comprehensive differential diagnosis
   */
  async generateDifferentialDiagnosis(clinicalData, sessionId) {
    try {
      logger.info('Generating differential diagnosis', {
        sessionId: this.hipaaService.hashData(sessionId),
        hasSymptoms: !!clinicalData.symptoms,
        hasHistory: !!clinicalData.history,
        hasDemographics: !!clinicalData.demographics
      });

      // Validate and structure clinical data
      const structuredData = this.structureClinicalData(clinicalData);
      
      // Apply multiple diagnostic frameworks
      const frameworkAnalyses = await this.applyDiagnosticFrameworks(structuredData);
      
      // Gather supporting evidence from medical databases
      const evidenceData = await this.gatherSupportingEvidence(structuredData, frameworkAnalyses);
      
      // Generate AI-powered analysis
      const aiAnalysis = await this.generateAIAnalysis(structuredData, evidenceData);
      
      // Synthesize comprehensive differential diagnosis
      const differentialDiagnosis = this.synthesizeDifferential(
        frameworkAnalyses,
        evidenceData,
        aiAnalysis,
        structuredData
      );
      
      // Add clinical reasoning and recommendations
      const enhancedDiagnosis = this.enhanceWithClinicalReasoning(
        differentialDiagnosis,
        structuredData
      );
      
      // Audit the diagnostic analysis
      await this.hipaaService.logMedicalInteraction(sessionId, {
        action: 'differential_diagnosis',
        resource: 'diagnostic_engine',
        tools: ['diagnostic_frameworks', 'medical_literature', 'ai_analysis'],
        success: true,
        category: 'diagnosis'
      });
      
      return enhancedDiagnosis;
    } catch (error) {
      logger.error('Differential diagnosis generation failed:', error);
      
      // Audit failed analysis
      await this.hipaaService.logMedicalInteraction(sessionId, {
        action: 'differential_diagnosis',
        resource: 'diagnostic_engine',
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Structure clinical data for analysis
   */
  structureClinicalData(rawData) {
    const structured = {
      demographics: {
        age: rawData.demographics?.age || null,
        gender: rawData.demographics?.gender || null,
        ethnicity: rawData.demographics?.ethnicity || null
      },
      chiefComplaint: rawData.chiefComplaint || rawData.symptoms?.primary || '',
      symptomsAndSigns: {
        present: rawData.symptoms?.present || [],
        absent: rawData.symptoms?.absent || [],
        duration: rawData.symptoms?.duration || null,
        severity: rawData.symptoms?.severity || null,
        progression: rawData.symptoms?.progression || null
      },
      medicalHistory: {
        pastMedical: rawData.history?.pastMedical || [],
        medications: rawData.history?.medications || [],
        allergies: rawData.history?.allergies || [],
        familyHistory: rawData.history?.family || [],
        socialHistory: rawData.history?.social || {}
      },
      physicalExam: rawData.physicalExam || {},
      vitalSigns: rawData.vitalSigns || {},
      laboratoryResults: rawData.labs || {},
      imagingResults: rawData.imaging || {},
      riskFactors: this.identifyRiskFactors(rawData),
      redFlags: this.identifyRedFlags(rawData)
    };
    
    return structured;
  }

  /**
   * Apply multiple diagnostic frameworks
   */
  async applyDiagnosticFrameworks(clinicalData) {
    const frameworkResults = {};
    
    try {
      // Apply each diagnostic framework
      for (const [frameworkId, framework] of Object.entries(this.diagnosticFrameworks)) {
        frameworkResults[frameworkId] = await this.applyFramework(framework, clinicalData);
      }
      
      return frameworkResults;
    } catch (error) {
      logger.error('Framework analysis failed:', error);
      return {};
    }
  }

  /**
   * Apply specific diagnostic framework
   */
  async applyFramework(framework, clinicalData) {
    const analysis = {
      framework: framework.name,
      approach: framework.approach,
      considerations: [],
      timeGenerated: new Date().toISOString()
    };
    
    switch (framework.approach) {
      case 'systematic_review_by_symptoms':
        analysis.considerations = this.analyzeBySymptoms(clinicalData);
        break;
        
      case 'organ_system_review':
        analysis.considerations = this.analyzeBySystem(clinicalData);
        break;
        
      case 'age_gender_specific':
        analysis.considerations = this.analyzeByDemographics(clinicalData);
        break;
        
      case 'timeline_analysis':
        analysis.considerations = this.analyzeByTemporal(clinicalData);
        break;
    }
    
    return analysis;
  }

  /**
   * Analyze by symptoms (most common approach)
   */
  analyzeBySymptoms(clinicalData) {
    const considerations = [];
    const symptoms = clinicalData.symptomsAndSigns.present;
    
    // Group symptoms by clinical significance
    const symptomGroups = this.groupSymptomsByClinicalSignificance(symptoms);
    
    // Generate differential based on symptom combinations
    Object.entries(symptomGroups).forEach(([significance, symptomList]) => {
      const possibleDiagnoses = this.getConditionsForSymptoms(symptomList, significance);
      considerations.push(...possibleDiagnoses);
    });
    
    return considerations.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Analyze by organ system
   */
  analyzeBySystem(clinicalData) {
    const considerations = [];
    const symptoms = clinicalData.symptomsAndSigns.present;
    
    // Map symptoms to organ systems
    const systemMapping = this.mapSymptomsToSystems(symptoms);
    
    // Generate differentials for each affected system
    Object.entries(systemMapping).forEach(([system, systemSymptoms]) => {
      const systemConditions = this.getConditionsForSystem(system, systemSymptoms);
      considerations.push(...systemConditions);
    });
    
    return considerations.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Analyze by demographics
   */
  analyzeByDemographics(clinicalData) {
    const considerations = [];
    const demographics = clinicalData.demographics;
    
    // Age-specific conditions
    if (demographics.age) {
      const ageSpecificConditions = this.getAgeSpecificConditions(
        demographics.age,
        clinicalData.symptomsAndSigns.present
      );
      considerations.push(...ageSpecificConditions);
    }
    
    // Gender-specific conditions
    if (demographics.gender) {
      const genderSpecificConditions = this.getGenderSpecificConditions(
        demographics.gender,
        clinicalData.symptomsAndSigns.present
      );
      considerations.push(...genderSpecificConditions);
    }
    
    return considerations.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Analyze by temporal patterns
   */
  analyzeByTemporal(clinicalData) {
    const considerations = [];
    const duration = clinicalData.symptomsAndSigns.duration;
    const progression = clinicalData.symptomsAndSigns.progression;
    
    if (duration) {
      const temporalConditions = this.getConditionsByTemporal(
        duration,
        progression,
        clinicalData.symptomsAndSigns.present
      );
      considerations.push(...temporalConditions);
    }
    
    return considerations.sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Gather supporting evidence from medical databases
   */
  async gatherSupportingEvidence(clinicalData, frameworkAnalyses) {
    const evidenceQueries = [];
    
    // Extract unique conditions from all frameworks
    const allConditions = new Set();
    Object.values(frameworkAnalyses).forEach(framework => {
      framework.considerations?.forEach(consideration => {
        allConditions.add(consideration.condition);
      });
    });
    
    // Generate search queries for top conditions
    const topConditions = Array.from(allConditions).slice(0, 10);
    
    try {
      // Search medical literature for each condition
      const literaturePromises = topConditions.map(condition =>
        this.searchMedicalEvidence(condition, clinicalData)
      );
      
      const evidenceResults = await Promise.allSettled(literaturePromises);
      
      const consolidatedEvidence = {};
      evidenceResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          consolidatedEvidence[topConditions[index]] = result.value;
        }
      });
      
      return consolidatedEvidence;
    } catch (error) {
      logger.error('Evidence gathering failed:', error);
      return {};
    }
  }

  /**
   * Search medical evidence for specific condition
   */
  async searchMedicalEvidence(condition, clinicalData) {
    try {
      // Build search query incorporating patient context
      const searchQuery = this.buildEvidenceSearchQuery(condition, clinicalData);
      
      // Search medical literature
      const literatureResults = await this.mcpService.searchMedicalLiterature(searchQuery, {
        limit: 5,
        filters: {
          evidenceLevel: ['systematic_review', 'meta_analysis', 'randomized_controlled_trial']
        }
      });
      
      // Search clinical guidelines
      const guidelinesResults = await this.mcpService.getMedicalGuidelines(condition);
      
      return {
        condition,
        literature: literatureResults,
        guidelines: guidelinesResults,
        evidenceStrength: this.assessEvidenceStrength(literatureResults, guidelinesResults)
      };
    } catch (error) {
      logger.warn(`Evidence search failed for ${condition}:`, error);
      return { condition, error: error.message };
    }
  }

  /**
   * Generate AI-powered analysis
   */
  async generateAIAnalysis(clinicalData, evidenceData) {
    try {
      const prompt = this.buildDiagnosticPrompt(clinicalData, evidenceData);
      
      const aiResponse = await this.aiService.generateMedicalResponse(
        prompt,
        evidenceData,
        { sessionId: 'diagnostic_analysis' },
        'differential_diagnosis'
      );
      
      return aiResponse;
    } catch (error) {
      logger.error('AI diagnostic analysis failed:', error);
      return null;
    }
  }

  /**
   * Synthesize comprehensive differential diagnosis
   */
  synthesizeDifferential(frameworkAnalyses, evidenceData, aiAnalysis, clinicalData) {
    const differential = {
      generatedAt: new Date().toISOString(),
      patientSummary: this.generatePatientSummary(clinicalData),
      considerations: [],
      methodology: {
        frameworksUsed: Object.keys(frameworkAnalyses),
        evidenceSources: Object.keys(evidenceData),
        aiAnalysisIncluded: !!aiAnalysis
      }
    };
    
    // Aggregate all diagnostic considerations
    const aggregatedConsiderations = this.aggregateConsiderations(
      frameworkAnalyses,
      evidenceData,
      aiAnalysis
    );
    
    // Score and rank considerations
    const rankedConsiderations = this.scoreAndRankConsiderations(
      aggregatedConsiderations,
      clinicalData
    );
    
    // Select top considerations for differential
    differential.considerations = rankedConsiderations.slice(0, 10);
    
    return differential;
  }

  /**
   * Enhance with clinical reasoning
   */
  enhanceWithClinicalReasoning(differential, clinicalData) {
    const enhanced = {
      ...differential,
      clinicalReasoning: {
        keyFindings: this.identifyKeyFindings(clinicalData),
        diagnosticPearls: this.generateDiagnosticPearls(differential.considerations),
        redFlags: clinicalData.redFlags,
        urgencyAssessment: this.assessUrgency(differential.considerations, clinicalData)
      },
      recommendations: {
        immediateActions: this.generateImmediateActions(differential.considerations, clinicalData),
        diagnosticWorkup: this.generateDiagnosticWorkup(differential.considerations),
        followUp: this.generateFollowUpPlan(differential.considerations),
        patientEducation: this.generatePatientEducation(differential.considerations)
      },
      disclaimer: {
        text: "This differential diagnosis is generated by AI for clinical decision support only. It should not replace clinical judgment and requires validation by qualified healthcare professionals.",
        importance: "critical"
      }
    };
    
    return enhanced;
  }

  /**
   * Helper methods for diagnostic analysis
   */
  
  identifyRiskFactors(rawData) {
    const riskFactors = [];
    
    // Age-based risk factors
    if (rawData.demographics?.age > 65) {
      riskFactors.push('advanced_age');
    }
    
    // Medical history risk factors
    if (rawData.history?.pastMedical) {
      rawData.history.pastMedical.forEach(condition => {
        if (['diabetes', 'hypertension', 'heart_disease'].includes(condition.toLowerCase())) {
          riskFactors.push(`history_of_${condition.toLowerCase()}`);
        }
      });
    }
    
    // Medication risk factors
    if (rawData.history?.medications) {
      rawData.history.medications.forEach(med => {
        if (['anticoagulants', 'immunosuppressants'].includes(med.category)) {
          riskFactors.push(`${med.category}_use`);
        }
      });
    }
    
    return riskFactors;
  }

  identifyRedFlags(rawData) {
    const redFlags = [];
    const symptoms = rawData.symptoms?.present || [];
    
    // Common red flag symptoms
    const redFlagSymptoms = [
      'chest_pain', 'severe_headache', 'difficulty_breathing', 
      'loss_of_consciousness', 'severe_abdominal_pain'
    ];
    
    symptoms.forEach(symptom => {
      if (redFlagSymptoms.includes(symptom.toLowerCase())) {
        redFlags.push({
          symptom,
          urgency: 'high',
          reason: 'Potentially life-threatening presentation'
        });
      }
    });
    
    return redFlags;
  }

  groupSymptomsByClinicalSignificance(symptoms) {
    const groups = {
      pathognomonic: [],
      highly_suggestive: [],
      suggestive: [],
      nonspecific: []
    };
    
    // This would use a medical knowledge base to classify symptoms
    // For now, basic classification
    symptoms.forEach(symptom => {
      // Simplified classification logic
      if (symptom.includes('specific') || symptom.includes('diagnostic')) {
        groups.pathognomonic.push(symptom);
      } else if (symptom.includes('severe')) {
        groups.highly_suggestive.push(symptom);
      } else {
        groups.suggestive.push(symptom);
      }
    });
    
    return groups;
  }

  getConditionsForSymptoms(symptoms, significance) {
    // This would query a medical knowledge base
    // Placeholder implementation
    return symptoms.map(symptom => ({
      condition: `Condition for ${symptom}`,
      likelihood: this.evidenceWeights[significance] || 3,
      evidence: { symptom, significance },
      source: 'symptom_analysis'
    }));
  }

  buildEvidenceSearchQuery(condition, clinicalData) {
    let query = condition;
    
    if (clinicalData.demographics.age) {
      if (clinicalData.demographics.age < 18) query += ' pediatric';
      else if (clinicalData.demographics.age > 65) query += ' elderly';
    }
    
    if (clinicalData.demographics.gender) {
      query += ` ${clinicalData.demographics.gender}`;
    }
    
    // Add primary symptoms
    const primarySymptoms = clinicalData.symptomsAndSigns.present.slice(0, 3);
    if (primarySymptoms.length > 0) {
      query += ` ${primarySymptoms.join(' ')}`;
    }
    
    return query;
  }

  assessEvidenceStrength(literature, guidelines) {
    let strength = 'low';
    
    if (literature?.algolia?.hits?.length > 0) {
      const highQualityStudies = literature.algolia.hits.filter(
        hit => ['systematic_review', 'meta_analysis'].includes(hit.study_type)
      );
      
      if (highQualityStudies.length > 0) {
        strength = 'high';
      } else if (literature.algolia.hits.length > 2) {
        strength = 'moderate';
      }
    }
    
    if (guidelines && Object.keys(guidelines).length > 0) {
      strength = 'high'; // Guidelines provide strong evidence
    }
    
    return strength;
  }

  generatePatientSummary(clinicalData) {
    const age = clinicalData.demographics.age || 'unknown age';
    const gender = clinicalData.demographics.gender || 'unknown gender';
    const chiefComplaint = clinicalData.chiefComplaint || 'presenting symptoms';
    
    return `${age}-year-old ${gender} presenting with ${chiefComplaint}`;
  }

  assessUrgency(considerations, clinicalData) {
    let maxUrgency = 'non_urgent';
    const urgentConditions = [];
    
    considerations.forEach(consideration => {
      const urgency = this.getConditionUrgency(consideration.condition);
      if (this.isMoreUrgent(urgency, maxUrgency)) {
        maxUrgency = urgency;
      }
      if (urgency === 'immediate' || urgency === 'urgent') {
        urgentConditions.push(consideration.condition);
      }
    });
    
    return {
      level: maxUrgency,
      urgentConditions,
      reasoning: this.getUrgencyReasoning(maxUrgency, clinicalData.redFlags)
    };
  }

  getConditionUrgency(condition) {
    // This would use a medical knowledge base
    // Simplified logic for demonstration
    const urgentConditions = ['myocardial_infarction', 'stroke', 'sepsis', 'anaphylaxis'];
    const semiUrgentConditions = ['pneumonia', 'appendicitis', 'cellulitis'];
    
    if (urgentConditions.includes(condition.toLowerCase())) return 'immediate';
    if (semiUrgentConditions.includes(condition.toLowerCase())) return 'urgent';
    return 'non_urgent';
  }

  isMoreUrgent(urgency1, urgency2) {
    const urgencyOrder = ['immediate', 'urgent', 'semi_urgent', 'non_urgent'];
    return urgencyOrder.indexOf(urgency1) < urgencyOrder.indexOf(urgency2);
  }

  // Additional helper methods would be implemented here...
  mapSymptomsToSystems() { return {}; }
  getConditionsForSystem() { return []; }
  getAgeSpecificConditions() { return []; }
  getGenderSpecificConditions() { return []; }
  getConditionsByTemporal() { return []; }
  aggregateConsiderations() { return []; }
  scoreAndRankConsiderations() { return []; }
  identifyKeyFindings() { return []; }
  generateDiagnosticPearls() { return []; }
  generateImmediateActions() { return []; }
  generateDiagnosticWorkup() { return []; }
  generateFollowUpPlan() { return []; }
  generatePatientEducation() { return []; }
  getUrgencyReasoning() { return ''; }
  buildDiagnosticPrompt() { return ''; }
}

export default DifferentialDiagnosisService;