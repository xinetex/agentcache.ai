/**
 * Data Lake Ontology Module
 * 
 * Provides sector-specific schema registration, data lake ingestion,
 * ontology-aware caching, and cross-sector federation.
 */

// Registry
export { OntologyRegistry, ontologyRegistry } from './OntologyRegistry.js';
export type { SectorOntology } from './OntologyRegistry.js';

// Schemas
export { FinanceOntology, FINANCE_VOCABULARY } from './schemas/finance.js';
export { BiotechOntology, BIOTECH_VOCABULARY } from './schemas/biotech.js';
export { LegalOntology, LEGAL_VOCABULARY } from './schemas/legal.js';
export { RoboticsOntology, ROBOTICS_VOCABULARY } from './schemas/robotics.js';
export { HealthcareOntology, HEALTHCARE_VOCABULARY } from './schemas/healthcare.js';
export { EnergyOntology, ENERGY_VOCABULARY } from './schemas/energy.js';

// Connectors
export { DataLakeConnector } from './DataLakeConnector.js';
export { HttpConnector } from './connectors/HttpConnector.js';
export { S3Connector } from './connectors/S3Connector.js';
export { RawConnector } from './connectors/RawConnector.js';

// Cache Strategy
export { OntologyCacheStrategy, ontologyCacheStrategy } from './OntologyCacheStrategy.js';

// Bridge
export { OntologyBridge, ontologyBridge } from './OntologyBridge.js';
