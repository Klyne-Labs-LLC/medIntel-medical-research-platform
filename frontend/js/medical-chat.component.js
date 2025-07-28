/**
 * Medical Chat Component
 * Enhanced chat interface for medical conversations with image upload
 */
class MedicalChatComponent {
  constructor() {
    this.apiService = new MedicalAPIService();
    this.chatHistory = [];
    this.currentCase = null;
    this.isProcessing = false;
    this.uploadedImage = null;
    
    // Initialize component
    this.initializeComponent();
    this.setupEventListeners();
    this.loadChatFromStorage();
  }

  /**
   * Initialize the medical chat component
   */
  initializeComponent() {
    // Get DOM elements
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messageInput = document.getElementById('messageInput');
    this.sendButton = document.getElementById('sendButton');
    this.chatForm = document.getElementById('chatForm');
    this.newChatBtn = document.getElementById('newChatBtn');
    
    // Create medical-specific UI elements
    this.createMedicalUI();
    
    // Initialize session
    this.initializeSession();
  }

  /**
   * Create medical-specific UI elements
   */
  createMedicalUI() {
    // Create image upload area
    this.createImageUploadArea();
    
    // Create patient context panel
    this.createPatientContextPanel();
    
    // Create medical tools panel
    this.createMedicalToolsPanel();
    
    // Update chat header for medical branding
    this.updateMedicalBranding();
  }

  /**
   * Create image upload area
   */
  createImageUploadArea() {
    const inputContainer = document.querySelector('.input-container');
    if (!inputContainer) return;

    const imageUploadArea = document.createElement('div');
    imageUploadArea.className = 'medical-image-upload';
    imageUploadArea.innerHTML = `
      <div class="image-upload-zone" id="imageUploadZone">
        <input type="file" id="medicalImageInput" accept="image/*,.dicom" style="display: none;">
        <div class="upload-content">
          <svg class="upload-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <span class="upload-text">Drop medical image here or click to upload</span>
          <span class="upload-formats">Supports: JPEG, PNG, TIFF, DICOM (max 50MB)</span>
        </div>
      </div>
      <div class="image-preview" id="imagePreview" style="display: none;">
        <img id="previewImage" alt="Medical image preview">
        <div class="image-info">
          <span class="image-name" id="imageName"></span>
          <span class="image-size" id="imageSize"></span>
          <button class="remove-image" id="removeImage">×</button>
        </div>
      </div>
    `;

    inputContainer.insertBefore(imageUploadArea, inputContainer.firstChild);
    
    this.setupImageUpload();
  }

  /**
   * Setup image upload functionality
   */
  setupImageUpload() {
    const uploadZone = document.getElementById('imageUploadZone');
    const fileInput = document.getElementById('medicalImageInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const imageName = document.getElementById('imageName');
    const imageSize = document.getElementById('imageSize');
    const removeButton = document.getElementById('removeImage');

    // Click to upload
    uploadZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImageUpload(files[0]);
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImageUpload(e.target.files[0]);
      }
    });

    // Remove image
    removeButton.addEventListener('click', () => {
      this.removeUploadedImage();
    });
  }

  /**
   * Handle image upload
   */
  handleImageUpload(file) {
    // Validate image
    const validation = this.apiService.validateMedicalImage(file);
    if (!validation.valid) {
      this.apiService.handleAPIError(new Error(validation.errors.join(', ')), 'Image Validation');
      return;
    }

    this.uploadedImage = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const uploadZone = document.getElementById('imageUploadZone');
      const imagePreview = document.getElementById('imagePreview');
      const previewImage = document.getElementById('previewImage');
      const imageName = document.getElementById('imageName');
      const imageSize = document.getElementById('imageSize');

      previewImage.src = e.target.result;
      imageName.textContent = file.name;
      imageSize.textContent = this.apiService.formatFileSize(file.size);
      
      uploadZone.style.display = 'none';
      imagePreview.style.display = 'block';
    };
    
    reader.readAsDataURL(file);
    
    this.apiService.showSuccessMessage('Medical image ready for analysis');
  }

  /**
   * Remove uploaded image
   */
  removeUploadedImage() {
    this.uploadedImage = null;
    
    const uploadZone = document.getElementById('imageUploadZone');
    const imagePreview = document.getElementById('imagePreview');
    const fileInput = document.getElementById('medicalImageInput');
    
    uploadZone.style.display = 'block';
    imagePreview.style.display = 'none';
    fileInput.value = '';
  }

  /**
   * Create patient context panel
   */
  createPatientContextPanel() {
    const sidebar = document.createElement('div');
    sidebar.className = 'medical-sidebar';
    sidebar.innerHTML = `
      <div class="patient-context-panel">
        <h3>Patient Context</h3>
        <div class="context-form">
          <div class="form-group">
            <label>Age</label>
            <input type="number" id="patientAge" placeholder="Age in years">
          </div>
          <div class="form-group">
            <label>Gender</label>
            <select id="patientGender">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Chief Complaint</label>
            <textarea id="chiefComplaint" placeholder="Primary reason for consultation"></textarea>
          </div>
          <div class="form-group">
            <label>Current Medications</label>
            <textarea id="currentMedications" placeholder="List current medications"></textarea>
          </div>
          <div class="form-group">
            <label>Medical History</label>
            <textarea id="medicalHistory" placeholder="Relevant medical history"></textarea>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(sidebar);
  }

  /**
   * Create medical tools panel
   */
  createMedicalToolsPanel() {
    const toolsPanel = document.createElement('div');
    toolsPanel.className = 'medical-tools-panel';
    toolsPanel.innerHTML = `
      <div class="tools-header">
        <h3>Medical Tools</h3>
        <button class="tools-toggle" id="toolsToggle">Tools</button>
      </div>
      <div class="tools-content" id="toolsContent">
        <div class="tool-category">
          <h4>Diagnostic Tools</h4>
          <button class="tool-btn" data-tool="differential-diagnosis">
            Differential Diagnosis
          </button>
          <button class="tool-btn" data-tool="symptom-checker">
            Symptom Analysis
          </button>
        </div>
        <div class="tool-category">
          <h4>Research Tools</h4>
          <button class="tool-btn" data-tool="clinical-trials">
            Clinical Trials
          </button>
          <button class="tool-btn" data-tool="literature-search">
            Medical Literature
          </button>
        </div>
        <div class="tool-category">
          <h4>Safety Tools</h4>
          <button class="tool-btn" data-tool="drug-interactions">
            Drug Interactions
          </button>
          <button class="tool-btn" data-tool="contraindications">
            Contraindications
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(toolsPanel);
    
    this.setupMedicalTools();
  }

  /**
   * Setup medical tools functionality
   */
  setupMedicalTools() {
    const toolsToggle = document.getElementById('toolsToggle');
    const toolsContent = document.getElementById('toolsContent');
    const toolButtons = document.querySelectorAll('.tool-btn');

    toolsToggle.addEventListener('click', () => {
      toolsContent.style.display = toolsContent.style.display === 'none' ? 'block' : 'none';
    });

    toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tool = button.dataset.tool;
        this.handleMedicalTool(tool);
      });
    });
  }

  /**
   * Handle medical tool activation
   */
  async handleMedicalTool(tool) {
    try {
      switch (tool) {
        case 'differential-diagnosis':
          await this.handleDifferentialDiagnosis();
          break;
        case 'clinical-trials':
          await this.handleClinicalTrials();
          break;
        case 'drug-interactions':
          await this.handleDrugInteractions();
          break;
        case 'symptom-checker':
          this.insertMedicalQuery('Please analyze these symptoms and provide differential diagnosis considerations');
          break;
        case 'literature-search':
          this.insertMedicalQuery('Search medical literature for evidence on');
          break;
        case 'contraindications':
          this.insertMedicalQuery('Check contraindications for');
          break;
      }
    } catch (error) {
      this.apiService.handleAPIError(error, `Medical Tool: ${tool}`);
    }
  }

  /**
   * Handle differential diagnosis
   */
  async handleDifferentialDiagnosis() {
    const patientContext = this.getPatientContext();
    
    if (!patientContext.symptoms && !patientContext.chiefComplaint) {
      this.apiService.showErrorMessage('Please provide symptoms or chief complaint for differential diagnosis');
      return;
    }

    try {
      this.showProcessing('Generating differential diagnosis...');
      
      const result = await this.apiService.getDifferentialDiagnosis({
        symptoms: { present: [patientContext.chiefComplaint] },
        demographics: {
          age: patientContext.age,
          gender: patientContext.gender
        },
        history: {
          medications: patientContext.medications ? patientContext.medications.split(',') : [],
          pastMedical: patientContext.medicalHistory ? patientContext.medicalHistory.split(',') : []
        }
      });

      this.displayDifferentialDiagnosis(result);
    } catch (error) {
      this.apiService.handleAPIError(error, 'Differential Diagnosis');
    } finally {
      this.hideProcessing();
    }
  }

  /**
   * Update medical branding
   */
  updateMedicalBranding() {
    const header = document.querySelector('.chat-header h1');
    if (header) {
      header.textContent = 'MedIntel';
    }

    const logo = document.querySelector('.logo img');
    if (logo) {
      logo.alt = 'MedIntel Logo';
    }

    // Update page title
    document.title = 'MedIntel - Medical Research Platform';
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Chat form submission
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
    }

    // New chat button
    if (this.newChatBtn) {
      this.newChatBtn.addEventListener('click', () => {
        this.startNewMedicalCase();
      });
    }

    // Message input enhancements
    if (this.messageInput) {
      this.messageInput.addEventListener('input', () => {
        this.autoResizeInput();
      });

      this.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  }

  /**
   * Initialize medical session
   */
  async initializeSession() {
    try {
      await this.apiService.ensureValidSession();
      this.displaySessionInfo();
    } catch (error) {
      console.error('Failed to initialize medical session:', error);
      this.displaySessionError();
    }
  }

  /**
   * Handle send message
   */
  async handleSendMessage() {
    if (!this.messageInput || this.isProcessing) return;

    const message = this.messageInput.value.trim();
    if (!message && !this.uploadedImage) return;

    this.isProcessing = true;
    this.disableSendButton();

    try {
      // Add user message to chat
      if (message) {
        this.addMessage(message, 'user');
      }

      // Add image indicator if image is uploaded
      if (this.uploadedImage) {
        this.addImageMessage(this.uploadedImage);
      }

      // Clear input
      this.messageInput.value = '';
      this.autoResizeInput();

      // Show typing indicator
      this.showTypingIndicator();

      // Get patient context
      const patientContext = this.getPatientContext();

      // Send to API
      const response = await this.apiService.sendMedicalChat(
        message || 'Please analyze the uploaded medical image',
        patientContext,
        this.chatHistory.slice(-5), // Last 5 messages for context
        this.uploadedImage
      );

      this.hideTypingIndicator();

      // Process response
      this.processMedicalResponse(response);

      // Clear uploaded image after sending
      if (this.uploadedImage) {
        this.removeUploadedImage();
      }

      // Save chat history
      this.saveChatToStorage();

    } catch (error) {
      this.hideTypingIndicator();
      this.apiService.handleAPIError(error, 'Medical Chat');
    } finally {
      this.isProcessing = false;
      this.enableSendButton();
    }
  }

  /**
   * Process medical response
   */
  processMedicalResponse(response) {
    // Add AI response
    this.addMessage(response.response, 'assistant', {
      medicalAnalysis: response.medicalAnalysis,
      recommendations: response.recommendations,
      safetyAlerts: response.safetyAlerts,
      disclaimer: response.disclaimer
    });

    // Show safety alerts if present
    if (response.safetyAlerts && response.safetyAlerts.length > 0) {
      this.displaySafetyAlerts(response.safetyAlerts);
    }

    // Show medical analysis details
    if (response.medicalAnalysis) {
      this.displayMedicalAnalysis(response.medicalAnalysis);
    }

    // Update chat history
    this.chatHistory.push(
      { role: 'user', content: this.messageInput?.value || 'Image analysis' },
      { role: 'assistant', content: response.response, medical: response.medicalAnalysis }
    );
  }

  /**
   * Get patient context from form
   */
  getPatientContext() {
    return {
      age: document.getElementById('patientAge')?.value || null,
      gender: document.getElementById('patientGender')?.value || null,
      chiefComplaint: document.getElementById('chiefComplaint')?.value || '',
      medications: document.getElementById('currentMedications')?.value || '',
      medicalHistory: document.getElementById('medicalHistory')?.value || ''
    };
  }

  /**
   * Add message to chat
   */
  addMessage(content, role, metadata = {}) {
    if (!this.messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message medical-message`;

    if (role === 'user') {
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="message-text">${this.escapeHtml(content)}</div>
        </div>
      `;
    } else if (role === 'assistant') {
      const avatar = this.createMedicalAvatar();
      messageDiv.innerHTML = `
        <div class="assist-message-content">
          ${avatar}
          <div class="message-content">
            <div class="message-text">${this.formatMedicalMessage(content)}</div>
            ${this.createMedicalMetadata(metadata)}
          </div>
        </div>
      `;
    }

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * Add image message
   */
  addImageMessage(imageFile) {
    if (!this.messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message image-message';

    const reader = new FileReader();
    reader.onload = (e) => {
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="image-upload-indicator">
            <img src="${e.target.result}" alt="Uploaded medical image" class="uploaded-image">
            <div class="image-details">
              <span class="image-name">${imageFile.name}</span>
              <span class="image-size">${this.apiService.formatFileSize(imageFile.size)}</span>
            </div>
          </div>
        </div>
      `;
    };
    
    reader.readAsDataURL(imageFile);

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * Create medical metadata display
   */
  createMedicalMetadata(metadata) {
    if (!metadata.medicalAnalysis) return '';

    let html = '';
    
    // MCP Tools used
    if (metadata.medicalAnalysis.mcpResults) {
      html += `
        <div class="medical-tools-used">
          <span class="tools-label">Medical Tools:</span>
          <span class="tools-list">${Object.keys(metadata.medicalAnalysis.mcpResults).join(', ')}</span>
        </div>
      `;
    }

    // Confidence level
    if (metadata.medicalAnalysis.confidence) {
      const confidence = (metadata.medicalAnalysis.confidence * 100).toFixed(0);
      html += `
        <div class="confidence-level">
          <span class="confidence-label">Analysis Confidence:</span>
          <span class="confidence-value">${confidence}%</span>
        </div>
      `;
    }

    return html ? `<div class="medical-metadata">${html}</div>` : '';
  }

  /**
   * Display safety alerts
   */
  displaySafetyAlerts(alerts) {
    alerts.forEach(alert => {
      const alertDiv = document.createElement('div');
      alertDiv.className = `safety-alert alert-${alert.level}`;
      alertDiv.innerHTML = `
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <div class="alert-type">${alert.type}</div>
          <div class="alert-message">${alert.message}</div>
          <div class="alert-action">${alert.action}</div>
        </div>
      `;
      
      this.messagesContainer.appendChild(alertDiv);
    });
    
    this.scrollToBottom();
  }

  /**
   * Additional helper methods
   */
  
  createMedicalAvatar() {
    return `
      <div class="message-avatar medical-avatar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
    `;
  }

  formatMedicalMessage(text) {
    // Enhanced formatting for medical content
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/(ICD-10:\s*[A-Z]\d{2}\.?\d*)/gi, '<span class="icd-code">$1</span>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message typing-message';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="assist-message-content">
        ${this.createMedicalAvatar()}
        <div class="message-content">
          <div class="typing-indicator medical-typing">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-text">Analyzing medical information...</span>
          </div>
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  showProcessing(message) {
    // Implementation for processing indicator
    console.log('Processing:', message);
  }

  hideProcessing() {
    // Implementation for hiding processing indicator
    console.log('Processing complete');
  }

  disableSendButton() {
    if (this.sendButton) {
      this.sendButton.disabled = true;
    }
  }

  enableSendButton() {
    if (this.sendButton) {
      this.sendButton.disabled = false;
    }
  }

  autoResizeInput() {
    if (!this.messageInput) return;
    
    this.messageInput.style.height = 'auto';
    const newHeight = Math.min(this.messageInput.scrollHeight, 150);
    this.messageInput.style.height = `${newHeight}px`;
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  insertMedicalQuery(query) {
    if (this.messageInput) {
      this.messageInput.value = query;
      this.messageInput.focus();
      this.autoResizeInput();
    }
  }

  startNewMedicalCase() {
    this.chatHistory = [];
    this.currentCase = null;
    this.uploadedImage = null;
    
    // Clear messages
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
    
    // Clear patient context
    const contextInputs = ['patientAge', 'patientGender', 'chiefComplaint', 'currentMedications', 'medicalHistory'];
    contextInputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    
    // Clear image upload
    this.removeUploadedImage();
    
    // Clear storage
    localStorage.removeItem('medicalChatSession');
    
    this.apiService.showSuccessMessage('New medical case started');
  }

  saveChatToStorage() {
    if (this.chatHistory.length > 0) {
      localStorage.setItem('medicalChatSession', JSON.stringify({
        history: this.chatHistory,
        patientContext: this.getPatientContext(),
        timestamp: new Date().toISOString()
      }));
    }
  }

  loadChatFromStorage() {
    try {
      const saved = localStorage.getItem('medicalChatSession');
      if (saved) {
        const data = JSON.parse(saved);
        this.chatHistory = data.history || [];
        
        // Restore patient context
        if (data.patientContext) {
          setTimeout(() => {
            Object.entries(data.patientContext).forEach(([key, value]) => {
              const elementId = key === 'age' ? 'patientAge' : 
                              key === 'gender' ? 'patientGender' :
                              key === 'chiefComplaint' ? 'chiefComplaint' :
                              key === 'medications' ? 'currentMedications' :
                              key === 'medicalHistory' ? 'medicalHistory' : null;
              
              if (elementId) {
                const element = document.getElementById(elementId);
                if (element && value) element.value = value;
              }
            });
          }, 100);
        }
        
        // Restore chat messages
        this.chatHistory.forEach(msg => {
          this.addMessage(msg.content, msg.role, { medicalAnalysis: msg.medical });
        });
      }
    } catch (error) {
      console.error('Failed to load chat from storage:', error);
    }
  }

  displaySessionInfo() {
    const sessionInfo = this.apiService.getSessionInfo();
    console.log('Medical session active:', sessionInfo);
  }

  displaySessionError() {
    this.apiService.showErrorMessage('Failed to establish secure medical session. Please refresh the page.');
  }

  displayMedicalAnalysis(analysis) {
    // Implementation for detailed medical analysis display
    console.log('Medical Analysis:', analysis);
  }

  displayDifferentialDiagnosis(result) {
    // Implementation for differential diagnosis display
    console.log('Differential Diagnosis:', result);
  }

  handleClinicalTrials() {
    // Implementation for clinical trials
    console.log('Clinical Trials Search');
  }

  handleDrugInteractions() {
    // Implementation for drug interactions
    console.log('Drug Interactions Check');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.medicalChat = new MedicalChatComponent();
});

// Export for use in other modules
window.MedicalChatComponent = MedicalChatComponent;