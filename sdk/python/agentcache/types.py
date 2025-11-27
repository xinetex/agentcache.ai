"""Type definitions for AgentCache SDK."""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field


class Sector(str, Enum):
    """Available market sectors for pipeline templates."""
    
    HEALTHCARE = "healthcare"
    FINANCE = "finance"
    LEGAL = "legal"
    EDUCATION = "education"
    ECOMMERCE = "ecommerce"
    ENTERPRISE = "enterprise"
    DEVELOPER = "developer"
    DATASCIENCE = "datascience"
    GOVERNMENT = "government"
    GENERAL = "general"


class ComplianceFramework(str, Enum):
    """Supported compliance frameworks."""
    
    HIPAA = "HIPAA"
    HITECH = "HITECH"
    PCI_DSS = "PCI-DSS"
    SOC2 = "SOC2"
    GDPR = "GDPR"
    CCPA = "CCPA"
    FERPA = "FERPA"
    FINRA = "FINRA"
    GLBA = "GLBA"
    FEDRAMP = "FedRAMP"
    ITAR = "ITAR"


class CacheTier(str, Enum):
    """Cache complexity tiers."""
    
    BASIC = "basic"
    ADVANCED = "advanced"
    ENTERPRISE = "enterprise"


class NodeType(str, Enum):
    """Pipeline node types."""
    
    LLM_CACHE = "llm_cache"
    SEMANTIC_CACHE = "semantic_cache"
    EXACT_MATCH = "exact_match"
    PHI_FILTER = "phi_filter"
    PCI_FILTER = "pci_filter"
    FRAUD_DETECTOR = "fraud_detector"
    PRIVILEGE_GUARD = "privilege_guard"
    FERPA_FILTER = "ferpa_filter"
    SSO_CONNECTOR = "sso_connector"
    SECRET_SCANNER = "secret_scanner"
    EMBEDDING_CACHE = "embedding_cache"
    SECURITY_GATE = "security_gate"


class QueryRequest(BaseModel):
    """Request model for cache queries."""
    
    prompt: str = Field(..., description="The query prompt to cache/retrieve")
    context: Optional[Dict[str, Any]] = Field(
        None, description="Additional context for the query"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Custom metadata to attach"
    )
    ttl: Optional[int] = Field(
        None, description="Time-to-live in seconds (overrides default)"
    )
    invalidate_on: Optional[List[str]] = Field(
        None, description="Events that should invalidate this cache entry"
    )
    namespace: Optional[str] = Field(
        None, description="Namespace for multi-tenant isolation"
    )
    compliance: Optional[List[ComplianceFramework]] = Field(
        None, description="Required compliance frameworks"
    )


class CacheMetrics(BaseModel):
    """Metrics for a cache response."""
    
    hit_rate: Optional[float] = Field(None, description="Cache hit rate (0-1)")
    latency_ms: Optional[int] = Field(None, description="Response latency in ms")
    savings_usd: Optional[float] = Field(None, description="Estimated savings in USD")
    tokens_saved: Optional[int] = Field(None, description="Tokens saved by caching")


class CacheResponse(BaseModel):
    """Response model for cache queries."""
    
    cache_hit: bool = Field(..., description="Whether this was a cache hit")
    result: str = Field(..., description="The cached or generated result")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Response metadata"
    )
    metrics: Optional[CacheMetrics] = Field(
        None, description="Performance metrics"
    )
    cache_key: Optional[str] = Field(
        None, description="The cache key used"
    )
    expires_at: Optional[datetime] = Field(
        None, description="When this cache entry expires"
    )
    compliance_validated: Optional[List[ComplianceFramework]] = Field(
        None, description="Validated compliance frameworks"
    )


class NodeConfig(BaseModel):
    """Configuration for a pipeline node."""
    
    type: NodeType
    position: Dict[str, float] = Field(..., description="Node position {x, y}")
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Node-specific config"
    )


class EdgeConfig(BaseModel):
    """Configuration for a pipeline edge."""
    
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    label: Optional[str] = Field(None, description="Edge label")


class PipelineConfig(BaseModel):
    """Configuration for a complete pipeline."""
    
    name: str = Field(..., description="Pipeline name")
    sector: Sector = Field(..., description="Market sector")
    description: Optional[str] = Field(None, description="Pipeline description")
    nodes: List[NodeConfig] = Field(..., description="Pipeline nodes")
    edges: List[EdgeConfig] = Field(..., description="Pipeline edges")
    compliance: Optional[List[ComplianceFramework]] = Field(
        None, description="Required compliance frameworks"
    )
    tier: CacheTier = Field(
        CacheTier.BASIC, description="Complexity tier"
    )


class WebhookConfig(BaseModel):
    """Configuration for webhook subscriptions."""
    
    url: str = Field(..., description="Webhook delivery URL")
    events: List[str] = Field(..., description="Event types to subscribe to")
    secret: Optional[str] = Field(
        None, description="Secret for webhook signature verification"
    )
    active: bool = Field(True, description="Whether webhook is active")


class WebhookEvent(BaseModel):
    """Webhook event payload."""
    
    id: str = Field(..., description="Event ID")
    type: str = Field(..., description="Event type (e.g., cache.hit)")
    timestamp: datetime = Field(..., description="Event timestamp")
    data: Dict[str, Any] = Field(..., description="Event data")
    pipeline_id: Optional[str] = Field(None, description="Associated pipeline ID")
