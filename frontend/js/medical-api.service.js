/**
 * Medical API Service
 * Handles secure communication with MedIntel backend
 */
class MedicalAPIService {
  constructor() {
    this.baseURL = 'http://127.0.0.1:3000/api';
    this.sessionToken = null;
    this.sessionExpiry = null;
    
    // Initialize session from localStorage
    this.loadSessionFromStorage();
  }

  /**
   * Create medical session
   */
  async createSession() {
    try {
      const response = await fetch(`${this.baseURL}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const data = await response.json();
      
      this.sessionToken = data.session.token;
      this.sessionExpiry = new Date(data.session.expiresAt);
      
      // Save to localStorage
      localStorage.setItem('medicalSession', JSON.stringify({
        token: this.sessionToken,
        expiresAt: data.session.expiresAt
      }));

      console.log('Medical session created successfully');
      return data;
    } catch (error) {
      console.error('Failed to create medical session:', error);
      throw error;
    }
  }

  /**
   * Load session from localStorage
   */
  loadSessionFromStorage() {
    try {
      const saved = localStorage.getItem('medicalSession');
      if (saved) {
        const session = JSON.parse(saved);
        const expiry = new Date(session.expiresAt);
        
        if (expiry > new Date()) {
          this.sessionToken = session.token;
          this.sessionExpiry = expiry;
        } else {
          // Session expired, remove from storage
          localStorage.removeItem('medicalSession');
        }
      }
    } catch (error) {
      console.error('Failed to load session from storage:', error);
      localStorage.removeItem('medicalSession');
    }
  }

  /**
   * Ensure valid session exists
   */
  async ensureValidSession() {
    if (!this.sessionToken || !this.sessionExpiry || new Date() >= this.sessionExpiry) {
      await this.createSession();
    }
  }

  /**
   * Get headers with authentication
   */
  getAuthHeaders(includeContentType = true) {
    const headers = {
      'Authorization': `Bearer ${this.sessionToken}`
    };
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  /**
   * Send medical chat message
   */
  async sendMedicalChat(message, patientContext = {}, conversationHistory = [], medicalImage = null) {
    try {
      await this.ensureValidSession();

      const formData = new FormData();
      formData.append('message', message);
      formData.append('patientContext', JSON.stringify(patientContext));
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
      
      if (medicalImage) {
        formData.append('medicalImage', medicalImage);
      }

      const response = await fetch(`${this.baseURL}/medical-chat`, {
        method: 'POST',
        headers: this.getAuthHeaders(false), // Don't include Content-Type for FormData
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Medical chat failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Medical chat request failed:', error);
      throw error;
    }
  }

  /**
   * Request differential diagnosis
   */
  async getDifferentialDiagnosis(clinicalData) {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/differential-diagnosis`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ clinicalData })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Differential diagnosis failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Differential diagnosis request failed:', error);
      throw error;
    }
  }

  /**
   * Search clinical trials
   */
  async searchClinicalTrials(condition, patientCriteria = {}) {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/clinical-trials`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ 
          condition, 
          patientCriteria 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Clinical trials search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clinical trials search failed:', error);
      throw error;
    }
  }

  /**
   * Check drug interactions
   */
  async checkDrugInteractions(medications, newDrug = null) {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/drug-interactions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ 
          medications, 
          newDrug 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Drug interactions check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Drug interactions check failed:', error);
      throw error;
    }
  }

  /**
   * Analyze medical image
   */
  async analyzeMedicalImage(imageFile, clinicalContext = '', analysisOptions = {}) {
    try {
      await this.ensureValidSession();

      const formData = new FormData();
      formData.append('medicalImage', imageFile);
      formData.append('clinicalContext', clinicalContext);
      formData.append('analysisOptions', JSON.stringify(analysisOptions));

      const response = await fetch(`${this.baseURL}/medical/image-analysis`, {
        method: 'POST',
        headers: this.getAuthHeaders(false),
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Medical image analysis failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Medical image analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get medical system health (requires authentication)
   */
  async getMedicalSystemHealth() {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/health`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Medical health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Medical health check failed:', error);
      throw error;
    }
  }

  /**
   * Get available medical tools
   */
  async getMedicalTools() {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/tools`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Medical tools request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Medical tools request failed:', error);
      throw error;
    }
  }

  /**
   * Get HIPAA compliance report
   */
  async getComplianceReport(timeframe = '24h') {
    try {
      await this.ensureValidSession();

      const response = await fetch(`${this.baseURL}/medical/compliance-report?timeframe=${timeframe}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Compliance report request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Compliance report request failed:', error);
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  handleAPIError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    // Handle specific error types
    if (error.message.includes('401') || error.message.includes('Session')) {
      // Session expired or invalid
      this.sessionToken = null;
      this.sessionExpiry = null;
      localStorage.removeItem('medicalSession');
      
      // Show user-friendly message
      this.showErrorMessage('Your session has expired. Please refresh the page to continue.');
    } else if (error.message.includes('429')) {
      // Rate limited
      this.showErrorMessage('Too many requests. Please wait a moment before trying again.');
    } else if (error.message.includes('500')) {
      // Server error
      this.showErrorMessage('The medical system is temporarily unavailable. Please try again later.');
    } else {
      // Generic error
      this.showErrorMessage(`An error occurred: ${error.message}`);
    }
  }

  /**
   * Show error message to user
   */
  showErrorMessage(message) {
    // This would integrate with your UI notification system
    console.error('User Error:', message);
    
    // Create a simple error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'medical-error-message';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }

  /**
   * Show success message to user
   */
  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'medical-success-message';
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #44ff44;
      color: #003300;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }

  /**
   * Validate medical image file
   */
  validateMedicalImage(file) {
    const errors = [];
    
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds 50MB limit`);
    }
    
    // Check file type
    const allowedTypes = ['jpg', 'jpeg', 'png', 'tiff', 'dicom'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      errors.push(`File type .${fileExtension} not supported. Use: ${allowedTypes.join(', ')}`);
    }
    
    // Check MIME type
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 
      'application/dicom', 'image/dicom'
    ];
    if (!allowedMimes.some(mime => file.type.includes(mime))) {
      errors.push('Invalid file format for medical imaging');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      hasSession: !!this.sessionToken,
      expiresAt: this.sessionExpiry,
      timeUntilExpiry: this.sessionExpiry ? this.sessionExpiry - new Date() : 0
    };
  }
}

// Export for use in other modules
window.MedicalAPIService = MedicalAPIService;