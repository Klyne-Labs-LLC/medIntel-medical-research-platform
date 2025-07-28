import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createLogger } from "../utils/logger.util.js";

dotenv.config();

const logger = createLogger('MedicalMCPService');

/**
 * Advanced Medical MCP Integration Service
 * Manages multiple MCP clients for different medical data sources
 */
class MedicalMCPService {
  constructor() {
    this.clients = {
      algolia: null,        // Medical literature search
      pubmed: null,         // PubMed research integration
      clinicalTrials: null, // ClinicalTrials.gov
      medicalDB: null,      // Medical knowledge databases
      imaging: null         // Medical imaging analysis
    };
    
    this.clientStatus = {
      algolia: 'disconnected',
      pubmed: 'disconnected',
      clinicalTrials: 'disconnected',
      medicalDB: 'disconnected',
      imaging: 'disconnected'
    };

    this.reconnectAttempts = {};
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 5000;
  }

  /**
   * Initialize all medical MCP clients
   */
  async initializeAllClients() {
    try {
      logger.info('Initializing medical MCP clients...');
      
      const initPromises = [
        this.initializeAlgoliaClient(),
        this.initializePubMedClient(),
        this.initializeClinicalTrialsClient(),
        this.initializeMedicalDBClient(),
        this.initializeImagingClient()
      ];

      await Promise.allSettled(initPromises);
      
      const connectedClients = Object.values(this.clientStatus)
        .filter(status => status === 'connected').length;
      
      logger.info(`Medical MCP initialization complete. ${connectedClients}/5 clients connected`);
      
      return this.getConnectionSummary();
    } catch (error) {
      logger.error('Failed to initialize medical MCP clients:', error);
      throw error;
    }
  }

  /**
   * Initialize Algolia MCP client for medical literature
   */
  async initializeAlgoliaClient() {
    try {
      if (!process.env.ALGOLIA_MCP_NODE_PATH) {
        logger.warn('Algolia MCP path not configured');
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          "--experimental-strip-types",
          "--no-warnings=ExperimentalWarning",
          process.env.ALGOLIA_MCP_NODE_PATH,
        ],
        env: {
          ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
          ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
          ALGOLIA_INDEX_NAME: process.env.ALGOLIA_MEDICAL_INDEX || "medical_literature",
          MCP_ENABLED_TOOLS: "search,analytics,faceted_search,medical_filters",
        },
      });

      this.clients.algolia = new Client(
        {
          name: "medintel-algolia-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
        }
      );

      await this.clients.algolia.connect(transport);
      this.clientStatus.algolia = 'connected';
      
      // Verify tools are available
      const tools = await this.clients.algolia.listTools();
      logger.info(`Algolia MCP connected with ${tools.tools.length} tools`);
      
    } catch (error) {
      logger.error('Failed to initialize Algolia MCP client:', error);
      this.clientStatus.algolia = 'failed';
    }
  }

  /**
   * Initialize PubMed MCP client
   */
  async initializePubMedClient() {
    try {
      if (!process.env.PUBMED_MCP_NODE_PATH) {
        logger.warn('PubMed MCP path not configured');
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          "--experimental-strip-types",
          "--no-warnings=ExperimentalWarning",
          process.env.PUBMED_MCP_NODE_PATH,
        ],
        env: {
          PUBMED_API_KEY: process.env.PUBMED_API_KEY,
          NCBI_API_KEY: process.env.NCBI_API_KEY,
          MCP_ENABLED_TOOLS: "literature_search,citation_analysis,mesh_terms,similar_articles",
        },
      });

      this.clients.pubmed = new Client(
        {
          name: "medintel-pubmed-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          },
        }
      );

      await this.clients.pubmed.connect(transport);
      this.clientStatus.pubmed = 'connected';
      
      const tools = await this.clients.pubmed.listTools();
      logger.info(`PubMed MCP connected with ${tools.tools.length} tools`);
      
    } catch (error) {
      logger.error('Failed to initialize PubMed MCP client:', error);
      this.clientStatus.pubmed = 'failed';
    }
  }

  /**
   * Initialize Clinical Trials MCP client
   */
  async initializeClinicalTrialsClient() {
    try {
      if (!process.env.CLINICAL_TRIALS_MCP_PATH) {
        logger.warn('Clinical Trials MCP path not configured');
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          "--experimental-strip-types",
          "--no-warnings=ExperimentalWarning",
          process.env.CLINICAL_TRIALS_MCP_PATH,
        ],
        env: {
          CLINICAL_TRIALS_API_KEY: process.env.CLINICAL_TRIALS_API_KEY,
          MCP_ENABLED_TOOLS: "trial_search,eligibility_check,trial_status,recruitment_info",
        },
      });

      this.clients.clinicalTrials = new Client(
        {
          name: "medintel-clinical-trials-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          },
        }
      );

      await this.clients.clinicalTrials.connect(transport);
      this.clientStatus.clinicalTrials = 'connected';
      
      const tools = await this.clients.clinicalTrials.listTools();
      logger.info(`Clinical Trials MCP connected with ${tools.tools.length} tools`);
      
    } catch (error) {
      logger.error('Failed to initialize Clinical Trials MCP client:', error);
      this.clientStatus.clinicalTrials = 'failed';
    }
  }

  /**
   * Initialize Medical Database MCP client
   */
  async initializeMedicalDBClient() {
    try {
      if (!process.env.MEDICAL_DB_MCP_PATH) {
        logger.warn('Medical DB MCP path not configured');
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          "--experimental-strip-types",
          "--no-warnings=ExperimentalWarning",
          process.env.MEDICAL_DB_MCP_PATH,
        ],
        env: {
          MCP_ENABLED_TOOLS: "drug_interactions,icd_lookup,medical_taxonomy,guidelines_search,diagnostic_criteria",
        },
      });

      this.clients.medicalDB = new Client(
        {
          name: "medintel-medical-db-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          },
        }
      );

      await this.clients.medicalDB.connect(transport);
      this.clientStatus.medicalDB = 'connected';
      
      const tools = await this.clients.medicalDB.listTools();
      logger.info(`Medical DB MCP connected with ${tools.tools.length} tools`);
      
    } catch (error) {
      logger.error('Failed to initialize Medical DB MCP client:', error);
      this.clientStatus.medicalDB = 'failed';
    }
  }

  /**
   * Initialize Medical Imaging MCP client
   */
  async initializeImagingClient() {
    try {
      if (!process.env.IMAGING_MCP_PATH) {
        logger.warn('Medical Imaging MCP path not configured');
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          "--experimental-strip-types",
          "--no-warnings=ExperimentalWarning",
          process.env.IMAGING_MCP_PATH,
        ],
        env: {
          MCP_ENABLED_TOOLS: "image_analysis,dicom_processing,annotation_extraction,measurement_tools",
        },
      });

      this.clients.imaging = new Client(
        {
          name: "medintel-imaging-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          },
        }
      );

      await this.clients.imaging.connect(transport);
      this.clientStatus.imaging = 'connected';
      
      const tools = await this.clients.imaging.listTools();
      logger.info(`Medical Imaging MCP connected with ${tools.tools.length} tools`);
      
    } catch (error) {
      logger.error('Failed to initialize Medical Imaging MCP client:', error);
      this.clientStatus.imaging = 'failed';
    }
  }

  /**
   * Execute medical literature search across multiple sources
   */
  async searchMedicalLiterature(query, options = {}) {
    const results = {};
    const searchPromises = [];

    // Search Algolia medical index
    if (this.clientStatus.algolia === 'connected') {
      searchPromises.push(
        this.callMCPTool('algolia', 'searchMedicalLiterature', {
          query,
          filters: options.filters || {},
          facets: options.facets || ['specialty', 'evidence_level', 'publication_year'],
          hitsPerPage: options.limit || 10
        }).then(result => ({ source: 'algolia', data: result }))
      );
    }

    // Search PubMed
    if (this.clientStatus.pubmed === 'connected') {
      searchPromises.push(
        this.callMCPTool('pubmed', 'literature_search', {
          query,
          retmax: options.limit || 10,
          sort: options.sort || 'relevance',
          filters: {
            publication_types: options.publicationTypes || ['Journal Article', 'Review'],
            date_range: options.dateRange || 'last_5_years'
          }
        }).then(result => ({ source: 'pubmed', data: result }))
      );
    }

    try {
      const searchResults = await Promise.allSettled(searchPromises);
      
      searchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results[result.value.source] = result.value.data;
        } else {
          logger.warn(`Search failed for source: ${result.reason}`);
        }
      });

      return results;
    } catch (error) {
      logger.error('Medical literature search failed:', error);
      throw error;
    }
  }

  /**
   * Search clinical trials with patient matching
   */
  async searchClinicalTrials(condition, patientCriteria = {}) {
    if (this.clientStatus.clinicalTrials !== 'connected') {
      throw new Error('Clinical Trials MCP client not available');
    }

    try {
      const trialResults = await this.callMCPTool('clinicalTrials', 'trial_search', {
        condition,
        recruitment_status: 'recruiting',
        study_type: 'interventional',
        location: patientCriteria.location || 'United States',
        age_range: patientCriteria.age || null,
        gender: patientCriteria.gender || null
      });

      // Check eligibility for returned trials
      if (trialResults.trials && patientCriteria.demographics) {
        const eligibilityPromises = trialResults.trials.slice(0, 5).map(trial =>
          this.callMCPTool('clinicalTrials', 'eligibility_check', {
            trial_id: trial.nct_id,
            patient_criteria: patientCriteria.demographics
          }).then(result => ({
            ...trial,
            eligibility: result
          }))
        );

        const trialsWithEligibility = await Promise.allSettled(eligibilityPromises);
        trialResults.trials_with_eligibility = trialsWithEligibility
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
      }

      return trialResults;
    } catch (error) {
      logger.error('Clinical trials search failed:', error);
      throw error;
    }
  }

  /**
   * Check drug interactions
   */
  async checkDrugInteractions(medications, newDrug = null) {
    if (this.clientStatus.medicalDB !== 'connected') {
      throw new Error('Medical DB MCP client not available');
    }

    try {
      const drugList = newDrug ? [...medications, newDrug] : medications;
      
      const interactionResults = await this.callMCPTool('medicalDB', 'drug_interactions', {
        medications: drugList,
        severity_levels: ['major', 'moderate', 'minor'],
        include_contraindications: true
      });

      return interactionResults;
    } catch (error) {
      logger.error('Drug interaction check failed:', error);
      throw error;
    }
  }

  /**
   * Analyze medical image using MCP
   */
  async analyzeMedicalImage(imageData, imageType, analysisOptions = {}) {
    if (this.clientStatus.imaging !== 'connected') {
      throw new Error('Medical Imaging MCP client not available');
    }

    try {
      const analysisResult = await this.callMCPTool('imaging', 'image_analysis', {
        image_data: imageData,
        image_type: imageType,
        analysis_type: analysisOptions.analysisType || 'diagnostic_assistance',
        specialty: analysisOptions.specialty || 'general',
        confidence_threshold: analysisOptions.confidenceThreshold || 0.7,
        include_measurements: analysisOptions.includeMeasurements || false
      });

      return analysisResult;
    } catch (error) {
      logger.error('Medical image analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get medical guidelines for a condition
   */
  async getMedicalGuidelines(condition, specialty = null) {
    if (this.clientStatus.medicalDB !== 'connected') {
      throw new Error('Medical DB MCP client not available');
    }

    try {
      const guidelines = await this.callMCPTool('medicalDB', 'guidelines_search', {
        condition,
        specialty,
        guideline_types: ['practice_guideline', 'consensus_statement', 'clinical_pathway'],
        current_only: true
      });

      return guidelines;
    } catch (error) {
      logger.error('Medical guidelines search failed:', error);
      throw error;
    }
  }

  /**
   * Generic MCP tool caller with error handling and retries
   */
  async callMCPTool(clientName, toolName, args = {}) {
    const client = this.clients[clientName];
    if (!client) {
      throw new Error(`MCP client '${clientName}' not initialized`);
    }

    if (this.clientStatus[clientName] !== 'connected') {
      throw new Error(`MCP client '${clientName}' not connected`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      
      logger.debug(`MCP tool call successful: ${clientName}.${toolName}`);
      return result;
    } catch (error) {
      logger.error(`MCP tool call failed: ${clientName}.${toolName}`, error);
      
      // Attempt reconnection for connection errors
      if (error.message.includes('connection') || error.message.includes('transport')) {
        await this.attemptReconnection(clientName);
      }
      
      throw error;
    }
  }

  /**
   * Attempt to reconnect a failed MCP client
   */
  async attemptReconnection(clientName) {
    const attempts = this.reconnectAttempts[clientName] || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.warn(`Max reconnection attempts reached for ${clientName}`);
      return;
    }

    this.reconnectAttempts[clientName] = attempts + 1;
    logger.info(`Attempting to reconnect ${clientName} (attempt ${attempts + 1})`);

    try {
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      
      switch (clientName) {
        case 'algolia':
          await this.initializeAlgoliaClient();
          break;
        case 'pubmed':
          await this.initializePubMedClient();
          break;
        case 'clinicalTrials':
          await this.initializeClinicalTrialsClient();
          break;
        case 'medicalDB':
          await this.initializeMedicalDBClient();
          break;
        case 'imaging':
          await this.initializeImagingClient();
          break;
      }
      
      if (this.clientStatus[clientName] === 'connected') {
        this.reconnectAttempts[clientName] = 0;
        logger.info(`Successfully reconnected ${clientName}`);
      }
    } catch (error) {
      logger.error(`Reconnection failed for ${clientName}:`, error);
    }
  }

  /**
   * Get connection summary for all MCP clients
   */
  getConnectionSummary() {
    return {
      status: this.clientStatus,
      connected: Object.values(this.clientStatus).filter(s => s === 'connected').length,
      total: Object.keys(this.clientStatus).length,
      capabilities: this.getAvailableCapabilities()
    };
  }

  /**
   * Get available capabilities based on connected clients
   */
  getAvailableCapabilities() {
    const capabilities = [];
    
    if (this.clientStatus.algolia === 'connected') {
      capabilities.push('medical_literature_search', 'faceted_search', 'medical_analytics');
    }
    
    if (this.clientStatus.pubmed === 'connected') {
      capabilities.push('pubmed_search', 'citation_analysis', 'mesh_terms');
    }
    
    if (this.clientStatus.clinicalTrials === 'connected') {
      capabilities.push('clinical_trials_search', 'eligibility_matching', 'recruitment_info');
    }
    
    if (this.clientStatus.medicalDB === 'connected') {
      capabilities.push('drug_interactions', 'medical_taxonomy', 'clinical_guidelines');
    }
    
    if (this.clientStatus.imaging === 'connected') {
      capabilities.push('medical_image_analysis', 'dicom_processing', 'image_measurements');
    }
    
    return capabilities;
  }

  /**
   * Gracefully close all MCP connections
   */
  async closeAllConnections() {
    logger.info('Closing all medical MCP connections...');
    
    const closePromises = Object.entries(this.clients)
      .filter(([_, client]) => client !== null)
      .map(async ([name, client]) => {
        try {
          await client.close();
          this.clientStatus[name] = 'disconnected';
          logger.info(`Closed ${name} MCP connection`);
        } catch (error) {
          logger.error(`Error closing ${name} MCP connection:`, error);
        }
      });

    await Promise.allSettled(closePromises);
    logger.info('All MCP connections closed');
  }
}

export default MedicalMCPService;