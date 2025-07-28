import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { createLogger } from '../utils/logger.util.js';
import { medicalSystemPrompts } from '../config/medical-prompts.config.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('MedicalAIService');

/**
 * Advanced Medical AI Service
 * Integrates Google Gemini 2.5 Pro for medical analysis with Groq fallback
 */
export class MedicalAIService {
  constructor() {
    // Initialize AI models
    this.initializeAIModels();
    
    this.modelPreference = process.env.AI_MODEL_PREFERENCE || 'gemini';
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.7;
    this.safetyFiltersEnabled = process.env.ENABLE_MEDICAL_SAFETY_FILTERS === 'true';
    this.medicalDisclaimerRequired = process.env.REQUIRE_MEDICAL_DISCLAIMER === 'true';
    
    // Medical response configuration
    this.maxTokens = 2048;
    this.temperature = 0.1; // Low temperature for medical accuracy
    this.topP = 0.8;
    
    // Safety and error handling
    this.retryAttempts = 2;
    this.timeoutMs = 30000;
    
    logger.info('Medical AI Service initialized', {
      primaryModel: this.modelPreference,
      safetyFilters: this.safetyFiltersEnabled,
      confidenceThreshold: this.confidenceThreshold
    });
  }

  /**
   * Initialize AI model clients
   */
  initializeAIModels() {
    try {
      // Initialize Gemini 2.5 Pro
      if (process.env.GOOGLE_AI_API_KEY) {
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        this.geminiModel = this.genAI.getGenerativeModel({ 
          model: "gemini-2.0-flash-exp",
          generationConfig: {
            temperature: this.temperature,
            topP: this.topP,
            maxOutputTokens: this.maxTokens,
          },
          safetySettings: this.getMedicalSafetySettings()
        });
        logger.info('Gemini 2.5 Pro model initialized successfully');
      } else {
        logger.warn('Google AI API key not provided, Gemini unavailable');
      }

      // Initialize Groq as fallback
      if (process.env.GROQ_API_KEY) {
        this.groqClient = new Groq({
          apiKey: process.env.GROQ_API_KEY,
        });
        logger.info('Groq fallback model initialized successfully');
      } else {
        logger.warn('Groq API key not provided, fallback unavailable');
      }
    } catch (error) {
      logger.error('Failed to initialize AI models:', error);
      throw new Error('AI model initialization failed');
    }
  }

  /**
   * Generate medical response using appropriate AI model
   */
  async generateMedicalResponse(userQuery, mcpResults, patientContext = {}, analysisType = 'general') {
    try {
      logger.info('Generating medical response', {
        analysisType,
        hasPatientContext: Object.keys(patientContext).length > 0,
        mcpResultsSources: Object.keys(mcpResults)
      });

      const medicalPrompt = this.buildMedicalPrompt(userQuery, mcpResults, patientContext, analysisType);
      
      let response;
      
      // Try primary model first
      if (this.modelPreference === 'gemini' && this.geminiModel) {
        response = await this.generateGeminiResponse(medicalPrompt);
      } else if (this.modelPreference === 'groq' && this.groqClient) {
        response = await this.generateGroqResponse(medicalPrompt);
      }
      
      // Fallback to alternative model if primary fails
      if (!response && this.groqClient) {
        logger.warn('Primary model failed, attempting Groq fallback');
        response = await this.generateGroqResponse(medicalPrompt);
      }
      
      if (!response && this.geminiModel) {
        logger.warn('Groq fallback failed, attempting Gemini');
        response = await this.generateGeminiResponse(medicalPrompt);
      }

      if (!response) {
        throw new Error('All AI models failed to generate response');
      }

      // Parse and validate medical response
      const parsedResponse = this.parseMedicalResponse(response, analysisType);
      
      // Add medical disclaimer if required
      if (this.medicalDisclaimerRequired) {
        parsedResponse.disclaimer = this.getMedicalDisclaimer();
      }

      // Log successful generation
      logger.auditMedicalQuery(
        patientContext.sessionId,
        analysisType,
        Object.keys(mcpResults),
        true
      );

      return parsedResponse;
    } catch (error) {
      logger.error('Medical response generation failed:', error);
      return this.generateSafetyResponse(error.message);
    }
  }

  /**
   * Generate response using Gemini 2.5 Pro
   */
  async generateGeminiResponse(prompt) {
    try {
      const result = await Promise.race([
        this.geminiModel.generateContent(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Gemini timeout')), this.timeoutMs)
        )
      ]);

      const response = result.response.text();
      logger.debug('Gemini response generated successfully');
      
      return response;
    } catch (error) {
      logger.error('Gemini generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate response using Groq
   */
  async generateGroqResponse(prompt) {
    try {
      const completion = await Promise.race([
        this.groqClient.chat.completions.create({
          messages: [
            { role: "system", content: medicalSystemPrompts.general },
            { role: "user", content: prompt }
          ],
          model: "llama-3.1-8b-instant",
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Groq timeout')), this.timeoutMs)
        )
      ]);

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from Groq');
      }

      logger.debug('Groq response generated successfully');
      return response;
    } catch (error) {
      logger.error('Groq generation failed:', error);
      throw error;
    }
  }

  /**
   * Analyze medical image using Gemini Vision
   */
  async analyzeMedicalImage(imageFile, clinicalContext, analysisOptions = {}) {
    try {
      if (!this.geminiModel) {
        throw new Error('Gemini model not available for image analysis');
      }

      logger.info('Starting medical image analysis', {
        imageType: imageFile.mimetype,
        imageSize: imageFile.size,
        specialty: analysisOptions.specialty
      });

      // Convert image to base64 for Gemini
      const imageData = imageFile.buffer.toString('base64');
      
      const prompt = this.buildImageAnalysisPrompt(clinicalContext, analysisOptions);

      const result = await this.geminiModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: imageFile.mimetype,
            data: imageData
          }
        }
      ]);

      const response = result.response.text();
      const parsedResponse = this.parseImageAnalysisResponse(response);

      // Add safety warnings for image analysis
      parsedResponse.safetyWarnings = [
        "This is AI-assisted imaging analysis only",
        "Clinical correlation and radiologist review are required",
        "Not a substitute for professional medical diagnosis"
      ];

      logger.info('Medical image analysis completed', {
        analysisType: analysisOptions.analysisType,
        confidence: parsedResponse.confidence
      });

      return parsedResponse;
    } catch (error) {
      logger.error('Medical image analysis failed:', error);
      return {
        error: 'Image analysis unavailable',
        message: 'Unable to analyze medical image at this time',
        suggestions: [
          'Ensure image is clear and properly oriented',
          'Try uploading in a different format (JPEG, PNG)',
          'Consult with a medical professional for image interpretation'
        ]
      };
    }
  }

  /**
   * Build comprehensive medical prompt
   */
  buildMedicalPrompt(userQuery, mcpResults, patientContext, analysisType) {
    const systemPrompt = medicalSystemPrompts[analysisType] || medicalSystemPrompts.general;
    
    let prompt = `${systemPrompt}\n\n`;

    // Add patient context if available
    if (Object.keys(patientContext).length > 0) {
      prompt += `PATIENT CONTEXT:\n${JSON.stringify(patientContext, null, 2)}\n\n`;
    }

    // Add MCP results as evidence
    if (Object.keys(mcpResults).length > 0) {
      prompt += `MEDICAL EVIDENCE FROM DATABASES:\n`;
      
      Object.entries(mcpResults).forEach(([source, data]) => {
        prompt += `\n${source.toUpperCase()} RESULTS:\n${JSON.stringify(data, null, 2)}\n`;
      });
      prompt += `\n`;
    }

    // Add the user query
    prompt += `USER QUERY: ${userQuery}\n\n`;

    // Add structured response requirements
    prompt += this.getResponseStructurePrompt(analysisType);

    return prompt;
  }

  /**
   * Build medical image analysis prompt
   */
  buildImageAnalysisPrompt(clinicalContext, options) {
    const specialty = options.specialty || 'general';
    const analysisType = options.analysisType || 'diagnostic_assistance';

    return `You are a medical AI assistant specializing in ${specialty} image analysis.

CLINICAL CONTEXT: ${clinicalContext}

ANALYSIS REQUIREMENTS:
- Analyze this medical image for ${analysisType}
- Focus on ${specialty} findings if specified
- Provide structured analysis with confidence levels
- Include relevant medical terminology
- Suggest follow-up actions or additional imaging if needed

CRITICAL SAFETY GUIDELINES:
- This is AI-assisted analysis only, not a definitive diagnosis
- Always recommend professional medical review
- Include confidence levels for all observations
- Flag any urgent findings that require immediate attention
- Specify limitations of the analysis

Provide structured analysis in JSON format:
{
  "imageQuality": {
    "assessment": "description of image quality",
    "limitations": ["any technical limitations"]
  },
  "keyFindings": [
    {
      "finding": "description",
      "location": "anatomical location",
      "confidence": 0.0-1.0,
      "significance": "clinical significance"
    }
  ],
  "impressions": [
    {
      "diagnosis": "possible diagnosis",
      "confidence": 0.0-1.0,
      "reasoning": "supporting evidence"
    }
  ],
  "recommendations": [
    "next steps or additional studies needed"
  ],
  "urgencyLevel": "low/medium/high/critical",
  "overallConfidence": 0.0-1.0
}`;
  }

  /**
   * Get response structure prompt based on analysis type
   */
  getResponseStructurePrompt(analysisType) {
    switch (analysisType) {
      case 'differential_diagnosis':
        return `Provide structured medical analysis in JSON format:
{
  "clinicalAssessment": {
    "keyFindings": ["primary findings from the case"],
    "clinicalPatterns": ["recognizable patterns or syndromes"]
  },
  "differentialDiagnosis": [
    {
      "diagnosis": "condition name",
      "probability": "high/medium/low",
      "supportingEvidence": ["evidence supporting this diagnosis"],
      "againstEvidence": ["evidence against this diagnosis"],
      "icd10": "ICD-10 code if applicable"
    }
  ],
  "recommendedActions": {
    "immediateSteps": ["urgent actions needed"],
    "diagnosticWorkup": ["additional tests or evaluations"],
    "consultations": ["specialist referrals if needed"]
  },
  "evidenceSummary": {
    "sourcesCited": ["medical sources used"],
    "evidenceLevel": "strength of supporting evidence",
    "limitations": ["limitations of the analysis"]
  },
  "safetyAlerts": ["any red flags requiring immediate attention"]
}`;

      case 'treatment_planning':
        return `Provide structured treatment analysis in JSON format:
{
  "treatmentOptions": [
    {
      "intervention": "treatment name",
      "indication": "why this treatment is considered",
      "contraindications": ["reasons to avoid this treatment"],
      "expectedOutcome": "anticipated results",
      "evidenceLevel": "strength of supporting evidence"
    }
  ],
  "drugTherapy": {
    "recommendations": ["medication suggestions"],
    "interactions": ["potential drug interactions"],
    "monitoring": ["required monitoring parameters"]
  },
  "nonPharmacological": ["lifestyle, therapy, or procedural recommendations"],
  "followUp": {
    "timeline": "when to reassess",
    "parameters": ["what to monitor"],
    "redFlags": ["symptoms requiring immediate attention"]
  }
}`;

      default:
        return `Provide structured medical response in JSON format:
{
  "summary": "brief overview of the response",
  "clinicalInformation": "detailed medical information",
  "evidenceBased": {
    "citations": ["relevant medical sources"],
    "evidenceLevel": "strength of evidence"
  },
  "recommendations": ["suggested next steps"],
  "safetyConsiderations": ["important safety information"],
  "followUp": "recommended follow-up actions"
}`;
    }
  }

  /**
   * Parse medical response and ensure proper structure
   */
  parseMedicalResponse(response, analysisType) {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJSON = JSON.parse(jsonMatch[0]);
        return {
          content: response,
          structuredData: parsedJSON,
          analysisType,
          confidence: this.calculateResponseConfidence(parsedJSON),
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.warn('Failed to parse JSON response, using text format');
    }

    // Fallback to text parsing
    return {
      content: response,
      structuredData: this.extractStructuredData(response, analysisType),
      analysisType,
      confidence: this.calculateTextConfidence(response),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Parse image analysis response
   */
  parseImageAnalysisResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        return {
          ...parsedData,
          analysisType: 'medical_image',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.warn('Failed to parse image analysis JSON');
    }

    return {
      error: 'Failed to parse image analysis',
      rawResponse: response,
      analysisType: 'medical_image',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate confidence score for structured response
   */
  calculateResponseConfidence(structuredData) {
    let confidence = 0.5; // Base confidence

    // Check for key medical components
    if (structuredData.clinicalAssessment) confidence += 0.1;
    if (structuredData.differentialDiagnosis) confidence += 0.1;
    if (structuredData.evidenceSummary) confidence += 0.1;
    if (structuredData.recommendations) confidence += 0.1;
    if (structuredData.safetyAlerts) confidence += 0.1;

    // Bonus for evidence citations
    if (structuredData.evidenceBased?.citations?.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence for text responses
   */
  calculateTextConfidence(response) {
    let confidence = 0.3; // Lower base for unstructured

    // Check for medical terminology
    const medicalTerms = ['diagnosis', 'treatment', 'recommendation', 'evidence', 'clinical'];
    const termCount = medicalTerms.filter(term => 
      response.toLowerCase().includes(term)
    ).length;
    confidence += (termCount / medicalTerms.length) * 0.3;

    // Check for citations or references
    if (/citation|reference|study|research/i.test(response)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 0.8); // Cap lower for unstructured
  }

  /**
   * Extract structured data from text response
   */
  extractStructuredData(response, analysisType) {
    const structure = {
      summary: this.extractSection(response, ['summary', 'overview']),
      recommendations: this.extractSection(response, ['recommendation', 'suggested', 'next step']),
      safety: this.extractSection(response, ['safety', 'warning', 'caution']),
      evidence: this.extractSection(response, ['evidence', 'citation', 'reference'])
    };

    return structure;
  }

  /**
   * Extract specific sections from text
   */
  extractSection(text, keywords) {
    const sentences = text.split(/[.!?]+/);
    return sentences.filter(sentence => 
      keywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      )
    ).join('. ').trim();
  }

  /**
   * Generate safety response for errors
   */
  generateSafetyResponse(errorMessage) {
    return {
      content: "I apologize, but I'm unable to provide medical analysis at this time due to a technical issue.",
      error: errorMessage,
      structuredData: {
        summary: "Medical analysis unavailable",
        recommendations: [
          "Please consult with a healthcare professional",
          "Try your query again in a few moments",
          "Contact technical support if the issue persists"
        ],
        safetyConsiderations: [
          "This system is not a substitute for professional medical advice",
          "Seek immediate medical attention for urgent concerns",
          "Always verify medical information with qualified healthcare providers"
        ]
      },
      disclaimer: this.getMedicalDisclaimer(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get medical safety settings for AI models
   */
  getMedicalSafetySettings() {
    return [
      {
        category: "HARM_CATEGORY_MEDICAL",
        threshold: "BLOCK_NONE" // Allow medical content but with disclaimers
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ];
  }

  /**
   * Get standard medical disclaimer
   */
  getMedicalDisclaimer() {
    return {
      text: "This information is for educational purposes only and is not intended as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.",
      importance: "critical",
      requiredDisplay: true
    };
  }

  /**
   * Health check for AI models
   */
  async performHealthCheck() {
    const health = {
      gemini: 'unavailable',
      groq: 'unavailable',
      primaryModel: this.modelPreference,
      lastCheck: new Date().toISOString()
    };

    // Test Gemini
    if (this.geminiModel) {
      try {
        await this.geminiModel.generateContent("Health check");
        health.gemini = 'available';
      } catch (error) {
        health.gemini = 'error';
        health.geminiError = error.message;
      }
    }

    // Test Groq
    if (this.groqClient) {
      try {
        await this.groqClient.chat.completions.create({
          messages: [{ role: "user", content: "Health check" }],
          model: "llama-3.1-8b-instant",
          max_tokens: 10
        });
        health.groq = 'available';
      } catch (error) {
        health.groq = 'error';
        health.groqError = error.message;
      }
    }

    return health;
  }
}

export default MedicalAIService;