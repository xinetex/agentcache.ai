/**
 * Sector-Aware Configuration API
 * 
 * Endpoints:
 * - GET  /api/sector              - List all sectors
 * - POST /api/sector/detect       - Auto-detect sector from context
 * - GET  /api/sector/:id          - Get sector profile + refined nodes
 * - POST /api/sector/:id/configure - Generate optimized config for sector
 */

// ============================================================
// SECTOR PROFILES
// ============================================================

const SECTORS = {
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Life Sciences',
    icon: '🏥',
    description: 'HIPAA-compliant caching for medical AI, clinical decision support, patient data',
    compliance: {
      frameworks: ['HIPAA', 'HITECH', 'FDA-21-CFR-11', 'SOC2-Type2'],
      dataResidency: true,
      auditLogging: 'immutable',
      retentionDays: 2555,
    },
    cache: {
      defaultTtl: 3600,
      maxTtl: 86400,
      minTtl: 300,
      semanticThreshold: 0.95,
      allowSemanticCache: false,
    },
    data: {
      piiDetection: 'block',
      sensitiveFields: ['patient_id', 'ssn', 'dob', 'mrn', 'diagnosis', 'medication', 'insurance_id'],
      encryptionRequired: true,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.9,
      citationsRequired: true,
    },
    performance: {
      maxLatencyMs: 2000,
      targetHitRate: 60,
      costAlertThreshold: 500,
    },
    detection: {
      keywords: ['patient', 'diagnosis', 'clinical', 'medical', 'health', 'symptoms', 'treatment', 'prescription', 'ehr', 'epic', 'cerner'],
      namespacePatterns: ['healthcare/*', 'medical/*', 'clinical/*', 'health/*'],
      envVariables: ['HIPAA_MODE', 'EPIC_API_KEY', 'FHIR_ENDPOINT'],
    },
  },

  finance: {
    id: 'finance',
    name: 'Financial Services',
    icon: '🏦',
    description: 'SOC2/PCI-DSS compliant for banking, trading, insurance, fintech',
    compliance: {
      frameworks: ['SOC2-Type2', 'PCI-DSS', 'GLBA', 'SEC-17a-4', 'FINRA'],
      dataResidency: true,
      auditLogging: 'immutable',
      retentionDays: 2555,
    },
    cache: {
      defaultTtl: 1800,
      maxTtl: 43200,
      minTtl: 60,
      semanticThreshold: 0.92,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['account_number', 'ssn', 'card_number', 'routing', 'balance', 'tin'],
      encryptionRequired: true,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.85,
      citationsRequired: true,
    },
    performance: {
      maxLatencyMs: 500,
      targetHitRate: 75,
      costAlertThreshold: 1000,
    },
    detection: {
      keywords: ['portfolio', 'trading', 'investment', 'loan', 'mortgage', 'credit', 'account', 'transaction', 'kyc', 'aml'],
      namespacePatterns: ['finance/*', 'banking/*', 'trading/*', 'fintech/*'],
      envVariables: ['PLAID_API_KEY', 'STRIPE_SECRET_KEY', 'FINRA_COMPLIANCE'],
    },
  },

  legal: {
    id: 'legal',
    name: 'Legal & Compliance',
    icon: '⚖️',
    description: 'Attorney-client privilege protection, contract analysis, legal research',
    compliance: {
      frameworks: ['SOC2-Type2', 'GDPR', 'ABA-Ethics'],
      dataResidency: true,
      auditLogging: 'full',
      retentionDays: 3650,
    },
    cache: {
      defaultTtl: 604800,
      maxTtl: 2592000,
      minTtl: 86400,
      semanticThreshold: 0.88,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['client_name', 'case_number', 'privileged', 'matter_id'],
      encryptionRequired: true,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.8,
      citationsRequired: true,
    },
    performance: {
      maxLatencyMs: 3000,
      targetHitRate: 85,
      costAlertThreshold: 800,
    },
    detection: {
      keywords: ['contract', 'clause', 'legal', 'lawsuit', 'litigation', 'compliance', 'regulation', 'statute', 'precedent'],
      namespacePatterns: ['legal/*', 'contracts/*', 'compliance/*'],
      envVariables: ['CLIO_API_KEY', 'LEXISNEXIS_KEY', 'WESTLAW_KEY'],
    },
  },

  education: {
    id: 'education',
    name: 'Education & EdTech',
    icon: '🎓',
    description: 'FERPA-compliant for student data, tutoring, assessment, research',
    compliance: {
      frameworks: ['FERPA', 'COPPA', 'SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    cache: {
      defaultTtl: 2592000,
      maxTtl: 7776000,
      minTtl: 86400,
      semanticThreshold: 0.85,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['student_id', 'grades', 'parent_info', 'disciplinary'],
      encryptionRequired: false,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      citationsRequired: true,
    },
    performance: {
      maxLatencyMs: 2000,
      targetHitRate: 90,
      costAlertThreshold: 300,
    },
    detection: {
      keywords: ['student', 'lesson', 'curriculum', 'homework', 'assignment', 'grade', 'teacher', 'tutor', 'course'],
      namespacePatterns: ['education/*', 'edtech/*', 'school/*', 'university/*'],
      envVariables: ['CANVAS_API_KEY', 'BLACKBOARD_KEY', 'MOODLE_KEY'],
    },
  },

  ecommerce: {
    id: 'ecommerce',
    name: 'E-Commerce & Retail',
    icon: '🛒',
    description: 'Product recommendations, customer support, inventory queries',
    compliance: {
      frameworks: ['PCI-DSS', 'CCPA', 'GDPR'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    cache: {
      defaultTtl: 3600,
      maxTtl: 86400,
      minTtl: 300,
      semanticThreshold: 0.82,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'redact',
      sensitiveFields: ['card_number', 'cvv', 'billing_address'],
      encryptionRequired: true,
    },
    validation: {
      cognitiveValidation: false,
      hallucinationCheck: false,
      confidenceThreshold: 0.7,
      citationsRequired: false,
    },
    performance: {
      maxLatencyMs: 200,
      targetHitRate: 85,
      costAlertThreshold: 500,
    },
    detection: {
      keywords: ['product', 'order', 'shipping', 'cart', 'checkout', 'price', 'inventory', 'recommendation', 'sku'],
      namespacePatterns: ['retail/*', 'ecommerce/*', 'store/*', 'shop/*'],
      envVariables: ['SHOPIFY_API_KEY', 'MAGENTO_KEY', 'BIGCOMMERCE_KEY'],
    },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise (General)',
    icon: '🏢',
    description: 'Internal tools, knowledge bases, HR, IT support',
    compliance: {
      frameworks: ['SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    cache: {
      defaultTtl: 86400,
      maxTtl: 604800,
      minTtl: 3600,
      semanticThreshold: 0.85,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'warn',
      sensitiveFields: ['employee_id', 'salary', 'ssn', 'performance_review'],
      encryptionRequired: false,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      citationsRequired: false,
    },
    performance: {
      maxLatencyMs: 1000,
      targetHitRate: 80,
      costAlertThreshold: 500,
    },
    detection: {
      keywords: ['internal', 'employee', 'policy', 'procedure', 'helpdesk', 'IT support', 'onboarding'],
      namespacePatterns: ['enterprise/*', 'internal/*', 'corporate/*'],
      envVariables: ['OKTA_DOMAIN', 'AZURE_AD_TENANT'],
    },
  },

  developer: {
    id: 'developer',
    name: 'Developer & Startup',
    icon: '👨‍💻',
    description: 'Code generation, documentation, debugging, MVP development',
    compliance: {
      frameworks: [],
      dataResidency: false,
      auditLogging: 'none',
      retentionDays: 30,
    },
    cache: {
      defaultTtl: 604800,
      maxTtl: 2592000,
      minTtl: 3600,
      semanticThreshold: 0.8,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'none',
      sensitiveFields: ['api_key', 'password', 'secret', 'token'],
      encryptionRequired: false,
    },
    validation: {
      cognitiveValidation: false,
      hallucinationCheck: false,
      confidenceThreshold: 0.6,
      citationsRequired: false,
    },
    performance: {
      maxLatencyMs: 500,
      targetHitRate: 90,
      costAlertThreshold: 200,
    },
    detection: {
      keywords: ['code', 'function', 'debug', 'error', 'api', 'documentation', 'syntax', 'bug', 'deploy'],
      namespacePatterns: ['dev/*', 'code/*', 'engineering/*', 'api/*'],
      envVariables: ['GITHUB_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_TOKEN'],
    },
  },

  datascience: {
    id: 'datascience',
    name: 'Data Science & ML',
    icon: '📊',
    description: 'ML pipelines, data analysis, model training, RAG systems',
    compliance: {
      frameworks: ['SOC2-Type2'],
      dataResidency: false,
      auditLogging: 'basic',
      retentionDays: 365,
    },
    cache: {
      defaultTtl: 86400,
      maxTtl: 604800,
      minTtl: 3600,
      semanticThreshold: 0.88,
      allowSemanticCache: true,
    },
    data: {
      piiDetection: 'warn',
      sensitiveFields: [],
      encryptionRequired: false,
    },
    validation: {
      cognitiveValidation: true,
      hallucinationCheck: true,
      confidenceThreshold: 0.75,
      citationsRequired: true,
    },
    performance: {
      maxLatencyMs: 2000,
      targetHitRate: 80,
      costAlertThreshold: 1000,
    },
    detection: {
      keywords: ['model', 'training', 'dataset', 'embedding', 'vector', 'inference', 'RAG', 'pipeline', 'feature'],
      namespacePatterns: ['ml/*', 'data/*', 'analytics/*', 'ai/*'],
      envVariables: ['DATABRICKS_HOST', 'SNOWFLAKE_ACCOUNT', 'PINECONE_API_KEY', 'WANDB_API_KEY'],
    },
  },
};

// ============================================================
// SECTOR-SPECIFIC REFINED NODES
// Each sector gets customized nodes with domain-relevant options
// ============================================================

const SECTOR_NODES = {
  healthcare: {
    nodes: [
      {
        id: 'phi_filter',
        name: 'PHI Filter',
        icon: '🏥',
        description: 'HIPAA-compliant PHI detection and redaction',
        category: 'validation',
        config: [
          {
            id: 'mode', name: 'Mode', type: 'select', options: [
              { value: 'detect', label: 'Detect Only (Log)' },
              { value: 'redact', label: 'Redact PHI' },
              { value: 'block', label: 'Block if PHI Found' },
            ], default: 'block'
          },
          {
            id: 'phi_types', name: 'PHI Types', type: 'multiselect', options: [
              { value: 'patient_name', label: 'Patient Names' },
              { value: 'mrn', label: 'Medical Record Numbers' },
              { value: 'ssn', label: 'Social Security Numbers' },
              { value: 'dob', label: 'Dates of Birth' },
              { value: 'address', label: 'Addresses' },
              { value: 'phone', label: 'Phone Numbers' },
              { value: 'diagnosis', label: 'Diagnosis Codes (ICD-10)' },
              { value: 'medication', label: 'Medication Names' },
            ], default: ['patient_name', 'mrn', 'ssn', 'dob']
          },
          { id: 'audit_log', name: 'Log PHI Access', type: 'boolean', default: true },
        ],
      },
      {
        id: 'clinical_validator',
        name: 'Clinical Validator',
        icon: '🩺',
        description: 'Validate medical responses against clinical knowledge bases',
        category: 'validation',
        config: [
          {
            id: 'sources', name: 'Knowledge Sources', type: 'multiselect', options: [
              { value: 'pubmed', label: 'PubMed' },
              { value: 'cochrane', label: 'Cochrane Library' },
              { value: 'uptodate', label: 'UpToDate' },
              { value: 'fda', label: 'FDA Drug Database' },
              { value: 'cdc', label: 'CDC Guidelines' },
            ], default: ['pubmed', 'fda']
          },
          { id: 'confidence_min', name: 'Min Confidence', type: 'number', default: 0.9 },
          { id: 'require_citations', name: 'Require Citations', type: 'boolean', default: true },
          { id: 'flag_contraindications', name: 'Flag Contraindications', type: 'boolean', default: true },
        ],
      },
      {
        id: 'ehr_connector',
        name: 'EHR Connector',
        icon: '📋',
        description: 'Connect to Epic, Cerner, or FHIR-based EHR systems',
        category: 'source',
        config: [
          {
            id: 'ehr_type', name: 'EHR System', type: 'select', options: [
              { value: 'epic', label: 'Epic MyChart' },
              { value: 'cerner', label: 'Cerner Millennium' },
              { value: 'fhir', label: 'Generic FHIR R4' },
              { value: 'allscripts', label: 'Allscripts' },
            ], default: 'fhir'
          },
          { id: 'fhir_endpoint', name: 'FHIR Endpoint', type: 'string' },
          { id: 'oauth_enabled', name: 'OAuth 2.0', type: 'boolean', default: true },
        ],
      },
      {
        id: 'hipaa_audit',
        name: 'HIPAA Audit Logger',
        icon: '📜',
        description: 'Immutable audit trail for all PHI access (required for HIPAA)',
        category: 'output',
        config: [
          {
            id: 'storage', name: 'Audit Storage', type: 'select', options: [
              { value: 'postgres', label: 'PostgreSQL (WORM)' },
              { value: 's3', label: 'AWS S3 (Object Lock)' },
              { value: 'azure', label: 'Azure Immutable Blob' },
            ], default: 'postgres'
          },
          { id: 'retention_years', name: 'Retention (Years)', type: 'number', default: 7 },
          { id: 'include_response', name: 'Log Full Response', type: 'boolean', default: false },
        ],
      },
    ],
    templates: [
      {
        id: 'clinical-decision-support',
        name: 'Clinical Decision Support',
        description: 'HIPAA-compliant CDS pipeline with PHI protection and clinical validation',
        nodes: ['ehr_connector', 'phi_filter', 'cache_l2', 'clinical_validator', 'llm_anthropic', 'hipaa_audit'],
      },
    ],
  },

  finance: {
    nodes: [
      {
        id: 'pci_filter',
        name: 'PCI-DSS Filter',
        icon: '💳',
        description: 'Detect and mask payment card data per PCI-DSS requirements',
        category: 'validation',
        config: [
          {
            id: 'mode', name: 'Mode', type: 'select', options: [
              { value: 'mask', label: 'Mask (Last 4 Digits)' },
              { value: 'tokenize', label: 'Tokenize' },
              { value: 'block', label: 'Block Transaction' },
            ], default: 'mask'
          },
          {
            id: 'card_types', name: 'Card Types', type: 'multiselect', options: [
              { value: 'visa', label: 'Visa' },
              { value: 'mastercard', label: 'Mastercard' },
              { value: 'amex', label: 'American Express' },
              { value: 'discover', label: 'Discover' },
            ], default: ['visa', 'mastercard', 'amex', 'discover']
          },
          { id: 'detect_cvv', name: 'Detect CVV', type: 'boolean', default: true },
        ],
      },
      {
        id: 'kyc_validator',
        name: 'KYC/AML Validator',
        icon: '🔍',
        description: 'Validate against sanctions lists and politically exposed persons',
        category: 'validation',
        config: [
          {
            id: 'lists', name: 'Screening Lists', type: 'multiselect', options: [
              { value: 'ofac', label: 'OFAC SDN List' },
              { value: 'eu_sanctions', label: 'EU Sanctions' },
              { value: 'pep', label: 'Politically Exposed Persons' },
              { value: 'adverse_media', label: 'Adverse Media' },
            ], default: ['ofac', 'pep']
          },
          { id: 'fuzzy_match', name: 'Fuzzy Matching', type: 'boolean', default: true },
          { id: 'match_threshold', name: 'Match Threshold', type: 'number', default: 0.85 },
        ],
      },
      {
        id: 'market_data',
        name: 'Market Data Source',
        icon: '📈',
        description: 'Real-time market data with cache invalidation on price changes',
        category: 'source',
        config: [
          {
            id: 'provider', name: 'Data Provider', type: 'select', options: [
              { value: 'bloomberg', label: 'Bloomberg' },
              { value: 'refinitiv', label: 'Refinitiv' },
              { value: 'polygon', label: 'Polygon.io' },
              { value: 'alpaca', label: 'Alpaca Markets' },
            ], default: 'polygon'
          },
          {
            id: 'asset_classes', name: 'Asset Classes', type: 'multiselect', options: [
              { value: 'equities', label: 'Equities' },
              { value: 'options', label: 'Options' },
              { value: 'forex', label: 'Forex' },
              { value: 'crypto', label: 'Crypto' },
            ], default: ['equities']
          },
          { id: 'staleness_threshold', name: 'Max Staleness (sec)', type: 'number', default: 60 },
        ],
      },
      {
        id: 'finra_audit',
        name: 'FINRA/SEC Audit Trail',
        icon: '📊',
        description: 'Regulatory-compliant audit logging with 7-year retention',
        category: 'output',
        config: [
          {
            id: 'regulations', name: 'Compliance', type: 'multiselect', options: [
              { value: 'sec_17a4', label: 'SEC 17a-4' },
              { value: 'finra_4511', label: 'FINRA 4511' },
              { value: 'mifid2', label: 'MiFID II' },
            ], default: ['sec_17a4', 'finra_4511']
          },
          { id: 'worm_storage', name: 'WORM Storage', type: 'boolean', default: true },
        ],
      },
    ],
    templates: [
      {
        id: 'trading-assistant',
        name: 'Trading Assistant',
        description: 'Real-time market data with regulatory compliance and fast caching',
        nodes: ['market_data', 'cache_l1', 'pci_filter', 'llm_openai', 'finra_audit'],
      },
    ],
  },

  legal: {
    nodes: [
      {
        id: 'privilege_guard',
        name: 'Privilege Guard',
        icon: '🔐',
        description: 'Detect and protect attorney-client privileged communications',
        category: 'validation',
        config: [
          {
            id: 'mode', name: 'Mode', type: 'select', options: [
              { value: 'flag', label: 'Flag for Review' },
              { value: 'redact', label: 'Redact Privileged' },
              { value: 'block', label: 'Block from Cache' },
            ], default: 'flag'
          },
          {
            id: 'privilege_markers', name: 'Privilege Markers', type: 'multiselect', options: [
              { value: 'attorney_client', label: 'Attorney-Client' },
              { value: 'work_product', label: 'Work Product' },
              { value: 'confidential', label: 'Confidential' },
            ], default: ['attorney_client', 'work_product']
          },
        ],
      },
      {
        id: 'legal_research',
        name: 'Legal Research Source',
        icon: '📚',
        description: 'Connect to Westlaw, LexisNexis, or court databases',
        category: 'source',
        config: [
          {
            id: 'provider', name: 'Research Provider', type: 'select', options: [
              { value: 'westlaw', label: 'Westlaw' },
              { value: 'lexisnexis', label: 'LexisNexis' },
              { value: 'casetext', label: 'Casetext' },
              { value: 'fastcase', label: 'Fastcase' },
              { value: 'courtlistener', label: 'CourtListener (Free)' },
            ], default: 'casetext'
          },
          {
            id: 'jurisdictions', name: 'Jurisdictions', type: 'multiselect', options: [
              { value: 'federal', label: 'Federal' },
              { value: 'state', label: 'State Courts' },
              { value: 'international', label: 'International' },
            ], default: ['federal', 'state']
          },
        ],
      },
      {
        id: 'citation_validator',
        name: 'Citation Validator',
        icon: '📑',
        description: 'Verify legal citations and check for overruled precedents',
        category: 'validation',
        config: [
          {
            id: 'citation_format', name: 'Citation Format', type: 'select', options: [
              { value: 'bluebook', label: 'Bluebook' },
              { value: 'alwd', label: 'ALWD' },
              { value: 'auto', label: 'Auto-detect' },
            ], default: 'bluebook'
          },
          { id: 'check_overruled', name: 'Check if Overruled', type: 'boolean', default: true },
          { id: 'check_negative_treatment', name: 'Check Negative Treatment', type: 'boolean', default: true },
        ],
      },
      {
        id: 'matter_tracker',
        name: 'Matter Tracker',
        icon: '📁',
        description: 'Track cache usage per client matter for billing',
        category: 'output',
        config: [
          {
            id: 'billing_integration', name: 'Billing System', type: 'select', options: [
              { value: 'clio', label: 'Clio' },
              { value: 'mycase', label: 'MyCase' },
              { value: 'practicepanther', label: 'PracticePanther' },
              { value: 'manual', label: 'Manual Export' },
            ], default: 'clio'
          },
          { id: 'track_tokens', name: 'Track Token Usage', type: 'boolean', default: true },
          { id: 'track_cost', name: 'Track Cost per Matter', type: 'boolean', default: true },
        ],
      },
    ],
    templates: [
      {
        id: 'contract-review',
        name: 'Contract Review Pipeline',
        description: 'Analyze contracts with privilege protection and citation validation',
        nodes: ['legal_research', 'cache_l3', 'privilege_guard', 'llm_anthropic', 'citation_validator', 'matter_tracker'],
      },
    ],
  },

  education: {
    nodes: [
      {
        id: 'ferpa_filter',
        name: 'FERPA Filter',
        icon: '🎓',
        description: 'Protect student education records per FERPA requirements',
        category: 'validation',
        config: [
          {
            id: 'mode', name: 'Mode', type: 'select', options: [
              { value: 'warn', label: 'Warn Only' },
              { value: 'redact', label: 'Redact Student Data' },
              { value: 'block', label: 'Block if Student Data Found' },
            ], default: 'redact'
          },
          {
            id: 'protected_fields', name: 'Protected Fields', type: 'multiselect', options: [
              { value: 'student_id', label: 'Student IDs' },
              { value: 'grades', label: 'Grades/GPA' },
              { value: 'disciplinary', label: 'Disciplinary Records' },
              { value: 'financial_aid', label: 'Financial Aid' },
              { value: 'parent_info', label: 'Parent Information' },
            ], default: ['student_id', 'grades', 'disciplinary']
          },
        ],
      },
      {
        id: 'lms_connector',
        name: 'LMS Connector',
        icon: '📖',
        description: 'Connect to Canvas, Blackboard, Moodle, or Google Classroom',
        category: 'source',
        config: [
          {
            id: 'lms_type', name: 'LMS Platform', type: 'select', options: [
              { value: 'canvas', label: 'Canvas' },
              { value: 'blackboard', label: 'Blackboard' },
              { value: 'moodle', label: 'Moodle' },
              { value: 'google_classroom', label: 'Google Classroom' },
              { value: 'schoology', label: 'Schoology' },
            ], default: 'canvas'
          },
          {
            id: 'sync_frequency', name: 'Sync Frequency', type: 'select', options: [
              { value: 'realtime', label: 'Real-time' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
            ], default: 'hourly'
          },
        ],
      },
      {
        id: 'pedagogical_validator',
        name: 'Pedagogical Validator',
        icon: '✅',
        description: 'Ensure responses are age-appropriate and educationally sound',
        category: 'validation',
        config: [
          {
            id: 'grade_level', name: 'Grade Level', type: 'select', options: [
              { value: 'k5', label: 'K-5 (Elementary)' },
              { value: '6-8', label: '6-8 (Middle School)' },
              { value: '9-12', label: '9-12 (High School)' },
              { value: 'college', label: 'College/University' },
              { value: 'professional', label: 'Professional Development' },
            ], default: 'college'
          },
          { id: 'check_age_appropriate', name: 'Age-Appropriate Check', type: 'boolean', default: true },
          { id: 'check_accuracy', name: 'Factual Accuracy Check', type: 'boolean', default: true },
          { id: 'cite_sources', name: 'Require Educational Sources', type: 'boolean', default: true },
        ],
      },
      {
        id: 'learning_analytics',
        name: 'Learning Analytics',
        icon: '📊',
        description: 'Track student engagement and learning outcomes',
        category: 'output',
        config: [
          {
            id: 'metrics', name: 'Track Metrics', type: 'multiselect', options: [
              { value: 'questions_asked', label: 'Questions Asked' },
              { value: 'topics', label: 'Topics Covered' },
              { value: 'time_spent', label: 'Time on Task' },
              { value: 'comprehension', label: 'Comprehension Signals' },
            ], default: ['questions_asked', 'topics']
          },
          { id: 'anonymize', name: 'Anonymize Data', type: 'boolean', default: true },
        ],
      },
    ],
    templates: [
      {
        id: 'intelligent-tutor',
        name: 'Intelligent Tutoring System',
        description: 'FERPA-compliant AI tutor with pedagogical validation',
        nodes: ['lms_connector', 'ferpa_filter', 'cache_l3', 'pedagogical_validator', 'llm_openai', 'learning_analytics'],
      },
    ],
  },

  ecommerce: {
    nodes: [
      {
        id: 'product_catalog',
        name: 'Product Catalog',
        icon: '📦',
        description: 'Connect to Shopify, Magento, or product databases',
        category: 'source',
        config: [
          {
            id: 'platform', name: 'E-Commerce Platform', type: 'select', options: [
              { value: 'shopify', label: 'Shopify' },
              { value: 'magento', label: 'Magento' },
              { value: 'bigcommerce', label: 'BigCommerce' },
              { value: 'woocommerce', label: 'WooCommerce' },
              { value: 'custom', label: 'Custom API' },
            ], default: 'shopify'
          },
          { id: 'sync_inventory', name: 'Sync Inventory', type: 'boolean', default: true },
          { id: 'invalidate_on_price_change', name: 'Invalidate on Price Change', type: 'boolean', default: true },
        ],
      },
      {
        id: 'recommendation_engine',
        name: 'Recommendation Engine',
        icon: '🎯',
        description: 'Cache product recommendations with personalization',
        category: 'cache',
        config: [
          {
            id: 'algorithm', name: 'Algorithm', type: 'select', options: [
              { value: 'collaborative', label: 'Collaborative Filtering' },
              { value: 'content', label: 'Content-Based' },
              { value: 'hybrid', label: 'Hybrid' },
            ], default: 'hybrid'
          },
          {
            id: 'personalization', name: 'Personalization Level', type: 'select', options: [
              { value: 'none', label: 'Generic (Best Hit Rate)' },
              { value: 'segment', label: 'Segment-Based' },
              { value: 'individual', label: 'Individual (Lower Hit Rate)' },
            ], default: 'segment'
          },
          { id: 'ttl', name: 'Cache TTL (sec)', type: 'number', default: 3600 },
        ],
      },
      {
        id: 'price_freshness',
        name: 'Price Freshness Gate',
        icon: '💰',
        description: 'Ensure cached prices are current before serving',
        category: 'validation',
        config: [
          { id: 'max_age', name: 'Max Price Age (sec)', type: 'number', default: 300 },
          { id: 'auto_refresh', name: 'Auto Refresh on Stale', type: 'boolean', default: true },
          { id: 'tolerance_percent', name: 'Price Change Tolerance (%)', type: 'number', default: 5 },
        ],
      },
      {
        id: 'conversion_tracker',
        name: 'Conversion Tracker',
        icon: '📈',
        description: 'Track cache impact on conversion rates and revenue',
        category: 'output',
        config: [
          {
            id: 'track_events', name: 'Track Events', type: 'multiselect', options: [
              { value: 'product_view', label: 'Product Views' },
              { value: 'add_to_cart', label: 'Add to Cart' },
              { value: 'checkout', label: 'Checkout Start' },
              { value: 'purchase', label: 'Purchase' },
            ], default: ['product_view', 'add_to_cart', 'purchase']
          },
          { id: 'attribution', name: 'Cache Attribution', type: 'boolean', default: true },
        ],
      },
    ],
    templates: [
      {
        id: 'product-assistant',
        name: 'Product Assistant',
        description: 'Fast product Q&A with recommendation caching',
        nodes: ['product_catalog', 'cache_l1', 'recommendation_engine', 'price_freshness', 'llm_openai', 'conversion_tracker'],
      },
    ],
  },

  developer: {
    nodes: [
      {
        id: 'code_context',
        name: 'Code Context',
        icon: '📂',
        description: 'Index codebase for context-aware code generation',
        category: 'source',
        config: [
          {
            id: 'repo_type', name: 'Repository', type: 'select', options: [
              { value: 'github', label: 'GitHub' },
              { value: 'gitlab', label: 'GitLab' },
              { value: 'bitbucket', label: 'Bitbucket' },
              { value: 'local', label: 'Local Directory' },
            ], default: 'github'
          },
          { id: 'include_patterns', name: 'Include Patterns', type: 'string', default: '**/*.{ts,js,py,go}' },
          { id: 'exclude_patterns', name: 'Exclude Patterns', type: 'string', default: '**/node_modules/**' },
        ],
      },
      {
        id: 'secret_scanner',
        name: 'Secret Scanner',
        icon: '🔑',
        description: 'Detect and block API keys, passwords, tokens in prompts/responses',
        category: 'validation',
        config: [
          {
            id: 'mode', name: 'Mode', type: 'select', options: [
              { value: 'warn', label: 'Warn Only' },
              { value: 'redact', label: 'Redact Secrets' },
              { value: 'block', label: 'Block if Secret Found' },
            ], default: 'redact'
          },
          {
            id: 'patterns', name: 'Secret Patterns', type: 'multiselect', options: [
              { value: 'aws', label: 'AWS Keys' },
              { value: 'github', label: 'GitHub Tokens' },
              { value: 'openai', label: 'OpenAI Keys' },
              { value: 'stripe', label: 'Stripe Keys' },
              { value: 'generic', label: 'Generic Secrets' },
            ], default: ['aws', 'github', 'openai', 'stripe', 'generic']
          },
        ],
      },
      {
        id: 'reasoning_cache',
        name: 'Reasoning Cache',
        icon: '🧠',
        description: 'Cache expensive o1/DeepSeek reasoning traces',
        category: 'cache',
        config: [
          { id: 'cache_traces', name: 'Cache Full Reasoning', type: 'boolean', default: true },
          { id: 'ttl_days', name: 'Trace TTL (days)', type: 'number', default: 30 },
          { id: 'compress', name: 'Compress Traces', type: 'boolean', default: true },
        ],
      },
      {
        id: 'cost_tracker',
        name: 'Dev Cost Tracker',
        icon: '💸',
        description: 'Track API costs per project/developer',
        category: 'output',
        config: [
          {
            id: 'group_by', name: 'Group By', type: 'select', options: [
              { value: 'project', label: 'Project' },
              { value: 'developer', label: 'Developer' },
              { value: 'model', label: 'Model' },
            ], default: 'project'
          },
          { id: 'budget_alert', name: 'Daily Budget Alert ($)', type: 'number', default: 50 },
        ],
      },
    ],
    templates: [
      {
        id: 'code-assistant',
        name: 'Code Assistant',
        description: 'Context-aware coding with secret scanning and cost tracking',
        nodes: ['code_context', 'secret_scanner', 'reasoning_cache', 'cache_l3', 'llm_openai', 'cost_tracker'],
      },
    ],
  },

  datascience: {
    nodes: [
      {
        id: 'lakehouse_source',
        name: 'Lakehouse Source',
        icon: '🏗️',
        description: 'Connect to Databricks, Snowflake, or BigQuery',
        category: 'source',
        config: [
          {
            id: 'platform', name: 'Platform', type: 'select', options: [
              { value: 'databricks', label: 'Databricks' },
              { value: 'snowflake', label: 'Snowflake' },
              { value: 'bigquery', label: 'BigQuery' },
              { value: 'redshift', label: 'Redshift' },
            ], default: 'databricks'
          },
          { id: 'catalog', name: 'Catalog/Database', type: 'string' },
          { id: 'schema', name: 'Schema', type: 'string' },
        ],
      },
      {
        id: 'embedding_cache',
        name: 'Embedding Cache',
        icon: '🔢',
        description: 'Cache vector embeddings to avoid recomputation',
        category: 'cache',
        config: [
          {
            id: 'model', name: 'Embedding Model', type: 'select', options: [
              { value: 'text-embedding-3-small', label: 'OpenAI Small' },
              { value: 'text-embedding-3-large', label: 'OpenAI Large' },
              { value: 'voyage-large-2', label: 'Voyage AI' },
              { value: 'bge-large', label: 'BGE Large' },
            ], default: 'text-embedding-3-small'
          },
          { id: 'dimension', name: 'Dimensions', type: 'number', default: 1536 },
          { id: 'ttl_days', name: 'TTL (days)', type: 'number', default: 30 },
        ],
      },
      {
        id: 'experiment_tracker',
        name: 'Experiment Tracker',
        icon: '🧪',
        description: 'Log cache experiments to MLflow or W&B',
        category: 'output',
        config: [
          {
            id: 'platform', name: 'Tracking Platform', type: 'select', options: [
              { value: 'mlflow', label: 'MLflow' },
              { value: 'wandb', label: 'Weights & Biases' },
              { value: 'neptune', label: 'Neptune' },
              { value: 'comet', label: 'Comet ML' },
            ], default: 'mlflow'
          },
          { id: 'log_params', name: 'Log Parameters', type: 'boolean', default: true },
          { id: 'log_metrics', name: 'Log Metrics', type: 'boolean', default: true },
        ],
      },
      {
        id: 'lineage_tracker',
        name: 'Data Lineage',
        icon: '🔗',
        description: 'Track cache lineage for reproducibility',
        category: 'output',
        config: [
          { id: 'track_sources', name: 'Track Data Sources', type: 'boolean', default: true },
          { id: 'track_transformations', name: 'Track Transformations', type: 'boolean', default: true },
          {
            id: 'export_format', name: 'Export Format', type: 'select', options: [
              { value: 'openlineage', label: 'OpenLineage' },
              { value: 'marquez', label: 'Marquez' },
              { value: 'json', label: 'JSON' },
            ], default: 'openlineage'
          },
        ],
      },
    ],
    templates: [
      {
        id: 'rag-pipeline',
        name: 'RAG Pipeline',
        description: 'Lakehouse-connected RAG with embedding cache and lineage tracking',
        nodes: ['lakehouse_source', 'vector_db', 'embedding_cache', 'cache_l2', 'llm_openai', 'experiment_tracker', 'lineage_tracker'],
      },
    ],
  },

  enterprise: {
    nodes: [
      {
        id: 'sso_connector',
        name: 'SSO Connector',
        icon: '🔐',
        description: 'Authenticate via Okta, Azure AD, or SAML',
        category: 'source',
        config: [
          {
            id: 'provider', name: 'Identity Provider', type: 'select', options: [
              { value: 'okta', label: 'Okta' },
              { value: 'azure_ad', label: 'Azure AD' },
              { value: 'google', label: 'Google Workspace' },
              { value: 'saml', label: 'Generic SAML' },
            ], default: 'okta'
          },
          { id: 'namespace_from_group', name: 'Namespace from Group', type: 'boolean', default: true },
        ],
      },
      {
        id: 'knowledge_base',
        name: 'Knowledge Base',
        icon: '📚',
        description: 'Connect to Confluence, Notion, or SharePoint',
        category: 'source',
        config: [
          {
            id: 'source', name: 'Knowledge Source', type: 'select', options: [
              { value: 'confluence', label: 'Confluence' },
              { value: 'notion', label: 'Notion' },
              { value: 'sharepoint', label: 'SharePoint' },
              { value: 'guru', label: 'Guru' },
            ], default: 'confluence'
          },
          {
            id: 'sync_frequency', name: 'Sync Frequency', type: 'select', options: [
              { value: 'realtime', label: 'Real-time' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'daily', label: 'Daily' },
            ], default: 'daily'
          },
        ],
      },
      {
        id: 'department_router',
        name: 'Department Router',
        icon: '🏢',
        description: 'Route queries to department-specific caches',
        category: 'cache',
        config: [
          {
            id: 'departments', name: 'Departments', type: 'multiselect', options: [
              { value: 'hr', label: 'Human Resources' },
              { value: 'it', label: 'IT Support' },
              { value: 'finance', label: 'Finance' },
              { value: 'legal', label: 'Legal' },
              { value: 'sales', label: 'Sales' },
            ], default: ['hr', 'it']
          },
          { id: 'auto_detect', name: 'Auto-Detect Department', type: 'boolean', default: true },
        ],
      },
      {
        id: 'usage_analytics',
        name: 'Usage Analytics',
        icon: '📊',
        description: 'Track usage by department, team, and user',
        category: 'output',
        config: [
          {
            id: 'group_by', name: 'Group By', type: 'multiselect', options: [
              { value: 'department', label: 'Department' },
              { value: 'team', label: 'Team' },
              { value: 'user', label: 'User' },
              { value: 'topic', label: 'Topic' },
            ], default: ['department', 'team']
          },
          {
            id: 'export_to', name: 'Export To', type: 'select', options: [
              { value: 'dashboard', label: 'AgentCache Dashboard' },
              { value: 'datadog', label: 'Datadog' },
              { value: 'newrelic', label: 'New Relic' },
            ], default: 'dashboard'
          },
        ],
      },
    ],
    templates: [
      {
        id: 'internal-assistant',
        name: 'Internal Assistant',
        description: 'SSO-integrated knowledge base assistant with department routing',
        nodes: ['sso_connector', 'knowledge_base', 'department_router', 'cache_l2', 'llm_openai', 'usage_analytics'],
      },
    ],
  },
};

// ============================================================
// DETECTION LOGIC
// ============================================================

function detectSector(context) {
  const scores = {};

  for (const [id, sector] of Object.entries(SECTORS)) {
    scores[id] = { score: 0, signals: [] };
  }

  // Namespace patterns (highest weight)
  if (context.namespace) {
    for (const [id, sector] of Object.entries(SECTORS)) {
      for (const pattern of sector.detection.namespacePatterns) {
        const regex = new RegExp(pattern.replace('*', '.*'), 'i');
        if (regex.test(context.namespace)) {
          scores[id].score += 50;
          scores[id].signals.push(`Namespace matches ${pattern}`);
        }
      }
    }
  }

  // Query keywords
  if (context.query) {
    const q = context.query.toLowerCase();
    for (const [id, sector] of Object.entries(SECTORS)) {
      for (const keyword of sector.detection.keywords) {
        if (q.includes(keyword.toLowerCase())) {
          scores[id].score += 10;
          scores[id].signals.push(`Query contains "${keyword}"`);
        }
      }
    }
  }

  // Environment variables
  if (context.env) {
    for (const [id, sector] of Object.entries(SECTORS)) {
      for (const envVar of sector.detection.envVariables) {
        if (context.env[envVar]) {
          scores[id].score += 30;
          scores[id].signals.push(`Environment has ${envVar}`);
        }
      }
    }
  }

  // Explicit header
  if (context.headers?.['x-agentcache-sector']) {
    const explicit = context.headers['x-agentcache-sector'];
    if (SECTORS[explicit]) {
      scores[explicit].score += 100;
      scores[explicit].signals.push('Explicit sector header');
    }
  }

  // Find winner
  let best = 'enterprise';
  let bestScore = 0;

  for (const [id, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      best = id;
    }
  }

  return {
    sector: SECTORS[best],
    confidence: Math.min(bestScore / 100, 1),
    signals: scores[best].signals,
    allScores: scores,
  };
}

// ============================================================
// CONFIGURATION BUILDER
// ============================================================

function buildConfig(sector, overrides = {}) {
  const s = typeof sector === 'string' ? SECTORS[sector] : sector;
  if (!s) return null;

  return {
    sector: s.id,
    sectorName: s.name,

    cache: {
      defaultTtl: overrides.ttl || s.cache.defaultTtl,
      maxTtl: s.cache.maxTtl,
      minTtl: s.cache.minTtl,
      semanticEnabled: s.cache.allowSemanticCache,
      semanticThreshold: s.cache.semanticThreshold,
    },

    compliance: {
      frameworks: s.compliance.frameworks,
      auditLevel: s.compliance.auditLogging,
      retentionDays: s.compliance.retentionDays,
      dataResidency: s.compliance.dataResidency,
    },

    data: {
      piiMode: s.data.piiDetection,
      sensitiveFields: s.data.sensitiveFields,
      encryptionRequired: s.data.encryptionRequired,
    },

    validation: {
      cognitive: s.validation.cognitiveValidation,
      hallucination: s.validation.hallucinationCheck,
      minConfidence: s.validation.confidenceThreshold,
      requireCitations: s.validation.citationsRequired,
    },

    alerts: {
      maxLatencyMs: s.performance.maxLatencyMs,
      minHitRate: s.performance.targetHitRate,
      maxDailyCost: s.performance.costAlertThreshold,
    },
  };
}

// ============================================================
// HANDLER
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-AgentCache-Sector');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url?.split('?')[0] || '';

  try {
    // GET /api/sector - List all sectors
    if (req.method === 'GET' && (path === '/api/sector' || path === '/api/sector/')) {
      return res.status(200).json({
        success: true,
        sectors: Object.values(SECTORS).map(s => ({
          id: s.id,
          name: s.name,
          icon: s.icon,
          description: s.description,
          compliance: s.compliance.frameworks,
        })),
      });
    }

    // POST /api/sector/detect - Auto-detect sector
    if (req.method === 'POST' && path.endsWith('/detect')) {
      const context = req.body || {};
      const detection = detectSector(context);

      return res.status(200).json({
        success: true,
        detected: {
          sector: detection.sector.id,
          name: detection.sector.name,
          icon: detection.sector.icon,
          confidence: detection.confidence,
          signals: detection.signals,
        },
        config: buildConfig(detection.sector),
        warnings: generateWarnings(detection.sector, context),
      });
    }

    // GET /api/sector/:id - Get sector profile + nodes
    const sectorMatch = path.match(/\/api\/sector\/([a-z]+)$/);
    if (req.method === 'GET' && sectorMatch) {
      const sectorId = sectorMatch[1];
      const sector = SECTORS[sectorId];

      if (!sector) {
        return res.status(404).json({ success: false, error: 'Sector not found' });
      }

      const sectorNodes = SECTOR_NODES[sectorId] || { nodes: [], templates: [] };

      return res.status(200).json({
        success: true,
        sector,
        nodes: sectorNodes.nodes,
        templates: sectorNodes.templates,
        config: buildConfig(sector),
      });
    }

    // POST /api/sector/:id/configure - Generate config
    const configMatch = path.match(/\/api\/sector\/([a-z]+)\/configure$/);
    if (req.method === 'POST' && configMatch) {
      const sectorId = configMatch[1];
      const sector = SECTORS[sectorId];

      if (!sector) {
        return res.status(404).json({ success: false, error: 'Sector not found' });
      }

      const overrides = req.body || {};
      const config = buildConfig(sector, overrides);

      return res.status(200).json({
        success: true,
        config,
        code: generateConfigCode(config),
      });
    }

    // Default
    return res.status(200).json({
      success: true,
      api: 'Sector-Aware Configuration',
      version: '1.0.0',
      endpoints: [
        { method: 'GET', path: '/api/sector', description: 'List all sectors' },
        { method: 'POST', path: '/api/sector/detect', description: 'Auto-detect sector from context' },
        { method: 'GET', path: '/api/sector/:id', description: 'Get sector profile + refined nodes' },
        { method: 'POST', path: '/api/sector/:id/configure', description: 'Generate optimized config' },
      ],
    });

  } catch (error) {
    console.error('Sector API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

function generateWarnings(sector, context) {
  const warnings = [];

  if (sector.compliance.frameworks.includes('HIPAA') && !context.env?.HIPAA_MODE) {
    warnings.push({
      type: 'compliance',
      severity: 'high',
      message: 'Healthcare detected but HIPAA_MODE not enabled. PHI may be at risk.',
      action: 'Set HIPAA_MODE=true in environment variables',
    });
  }

  if (sector.data.encryptionRequired && !context.env?.ENCRYPTION_KEY) {
    warnings.push({
      type: 'security',
      severity: 'high',
      message: `${sector.name} requires encryption but no ENCRYPTION_KEY found.`,
      action: 'Configure ENCRYPTION_KEY for data-at-rest encryption',
    });
  }

  if (sector.compliance.dataResidency && !context.env?.DATA_REGION) {
    warnings.push({
      type: 'compliance',
      severity: 'medium',
      message: 'Data residency required but no region specified.',
      action: 'Set DATA_REGION to ensure compliance with data locality requirements',
    });
  }

  return warnings;
}

function generateConfigCode(config) {
  return `# AgentCache Configuration - ${config.sectorName}
# Auto-generated for sector: ${config.sector}

from agentcache import AgentCache, SectorConfig

cache = AgentCache(
    api_key="{{AGENTCACHE_API_KEY}}",
    sector="${config.sector}",
    config=SectorConfig(
        # Cache Settings
        default_ttl=${config.cache.defaultTtl},
        semantic_enabled=${config.cache.semanticEnabled ? 'True' : 'False'},
        semantic_threshold=${config.cache.semanticThreshold},
        
        # Compliance
        audit_level="${config.compliance.auditLevel}",
        data_residency=${config.compliance.dataResidency ? 'True' : 'False'},
        
        # Data Protection
        pii_mode="${config.data.piiMode}",
        encryption_required=${config.data.encryptionRequired ? 'True' : 'False'},
        
        # Validation
        cognitive_validation=${config.validation.cognitive ? 'True' : 'False'},
        hallucination_check=${config.validation.hallucination ? 'True' : 'False'},
        min_confidence=${config.validation.minConfidence},
        
        # Alerts
        max_latency_ms=${config.alerts.maxLatencyMs},
        min_hit_rate=${config.alerts.minHitRate},
        max_daily_cost=${config.alerts.maxDailyCost},
    )
)`;
}
