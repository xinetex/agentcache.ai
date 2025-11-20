from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json
import hashlib

@dataclass
class ReasoningState:
    """Represents a cached reasoning state (analogous to working memory)"""
    context_hash: str
    context_data: Dict[str, Any]  # Added to support similarity search
    reasoning_trace: List[str]
    intermediate_values: Dict[str, Any]
    confidence: float
    timestamp: datetime
    success_count: int = 0
    failure_count: int = 0
    
    def get_success_rate(self) -> float:
        total = self.success_count + self.failure_count
        return self.success_count / total if total > 0 else 0.5

@dataclass
class ReasoningPattern:
    """Long-term memory: proven reasoning strategies"""
    pattern_id: str
    pattern_type: str
    preconditions: List[str]
    steps: List[str]
    success_contexts: List[str] = field(default_factory=list)
    avg_success_rate: float = 0.5
    uses: int = 0

class ReasoningCache:
    """
    A cognitive architecture-inspired reasoning cache system.
    
    Implements:
    - Working memory (active reasoning states)
    - Episodic memory (past reasoning experiences)
    - Procedural memory (proven reasoning patterns)
    - Gating mechanism (when to cache/retrieve vs compute fresh)
    """
    
    def __init__(self, 
                 working_memory_capacity: int = 7,  # Miller's magic number
                 cache_threshold: float = 0.6,
                 decay_rate: float = 0.95,
                 verification_model: str = "gpt-4o-mini"):
        
        # Working memory: active reasoning states
        self.working_memory: Dict[str, ReasoningState] = {}
        self.wm_capacity = working_memory_capacity
        
        # Episodic memory: all cached reasoning experiences
        self.episodic_memory: Dict[str, ReasoningState] = {}
        
        # Procedural memory: abstract reasoning patterns
        self.procedural_memory: Dict[str, ReasoningPattern] = {}
        
        # Gating parameters
        self.cache_threshold = cache_threshold
        self.decay_rate = decay_rate
        self.verification_model = verification_model
        
        # Statistics
        self.cache_hits = 0
        self.cache_misses = 0
        self.reasoning_steps_saved = 0
    
    def _compute_context_hash(self, context: Dict[str, Any]) -> str:
        """Create stable hash for reasoning context"""
        # Sort keys to ensure stability
        context_str = json.dumps(context, sort_keys=True, default=str)
        return hashlib.sha256(context_str.encode()).hexdigest()[:16]
    
    def _extract_prompt(self, context: Dict[str, Any]) -> str:
        """Extract text prompt from context messages"""
        if "messages" in context:
            # Join all user messages
            return " ".join([m.get("content", "") for m in context["messages"] if m.get("role") == "user"])
        return str(context)

    def verify_match(self, new_context: Dict[str, Any], cached_context: Dict[str, Any], completion_fn: Any) -> bool:
        """
        The Cheap Critic: Verify if cached reasoning applies to new context using a cheap model.
        """
        if not completion_fn:
            return True # Skip verification if no LLM available
            
        new_prompt = self._extract_prompt(new_context)
        cached_prompt = self._extract_prompt(cached_context)
        
        # Construct verification prompt
        system_prompt = "You are a reasoning verifier. Determine if the reasoning logic for the first problem can be directly applied to the second problem. Answer only YES or NO."
        user_prompt = f"Problem A: {cached_prompt}\nProblem B: {new_prompt}\n\nCan the reasoning trace for Problem A be reused for Problem B?"
        
        try:
            response = completion_fn(
                model=self.verification_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0
            )
            
            if response and "choices" in response and len(response["choices"]) > 0:
                content = response["choices"][0]["message"]["content"].strip().upper()
                return "YES" in content
            return False
        except Exception as e:
            print(f"Verification failed: {e}")
            return False # Fail safe: don't use cache if verification fails

    def _similarity_score(self, ctx1: str, ctx2: str) -> float:
        """
        Simplified similarity for MVP.
        Uses word-token Jaccard similarity.
        In production, this would use vector embeddings.
        """
        # Simple tokenization by splitting on whitespace and punctuation
        def tokenize(text):
            return set(text.lower().replace('"', ' ').replace(':', ' ').replace('{', ' ').replace('}', ' ').split())
            
        set1 = tokenize(ctx1)
        set2 = tokenize(ctx2)
        
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
    
    def gate_update(self, context_hash: str, new_state: ReasoningState) -> bool:
        """
        Gating mechanism: decide whether to update working memory.
        Returns: True if working memory should be updated
        """
        # Gate open if confidence exceeds threshold
        if new_state.confidence < self.cache_threshold:
            return False
        
        # If working memory full, check if new state is more valuable
        if len(self.working_memory) >= self.wm_capacity:
            # Find least valuable item
            min_key = None
            min_val = float('inf')
            
            for k, s in self.working_memory.items():
                val = s.confidence * s.get_success_rate()
                if val < min_val:
                    min_val = val
                    min_key = k
            
            new_value = new_state.confidence * new_state.get_success_rate()
            
            if new_value <= min_val:
                return False  # Don't displace existing memory
            
            # Evict least valuable
            if min_key:
                self._evict_to_episodic(min_key)
        
        return True
    
    def _evict_to_episodic(self, context_hash: str):
        """Move item from working to episodic memory (consolidation)"""
        if context_hash in self.working_memory:
            state = self.working_memory.pop(context_hash)
            self.episodic_memory[context_hash] = state
    
    def cache_reasoning(self,
                       context: Dict[str, Any],
                       reasoning_trace: List[str],
                       intermediate_values: Dict[str, Any],
                       confidence: float) -> str:
        """
        Cache a reasoning episode
        """
        context_hash = self._compute_context_hash(context)
        
        state = ReasoningState(
            context_hash=context_hash,
            context_data=context, # Store original context
            reasoning_trace=reasoning_trace,
            intermediate_values=intermediate_values,
            confidence=confidence,
            timestamp=datetime.now()
        )
        
        # Gating: decide whether to update working memory
        if self.gate_update(context_hash, state):
            self.working_memory[context_hash] = state
        else:
            # Still store in episodic memory for future consolidation
            self.episodic_memory[context_hash] = state
        
        return context_hash
    
    def retrieve_reasoning(self, 
                          context: Dict[str, Any],
                          similarity_threshold: float = 0.7,
                          completion_fn: Any = None) -> Optional[ReasoningState]:
        """
        Retrieve cached reasoning for similar context
        """
        context_hash = self._compute_context_hash(context)
        
        # Exact match in working memory (fastest)
        if context_hash in self.working_memory:
            self.cache_hits += 1
            state = self.working_memory[context_hash]
            self.reasoning_steps_saved += len(state.reasoning_trace)
            return state
        
        # Exact match in episodic memory
        if context_hash in self.episodic_memory:
            self.cache_hits += 1
            state = self.episodic_memory[context_hash]
            # Promote to working memory if valuable
            if state.get_success_rate() > 0.7:
                if self.gate_update(context_hash, state):
                    self.working_memory[context_hash] = state
                    del self.episodic_memory[context_hash]
            self.reasoning_steps_saved += len(state.reasoning_trace)
            return state
        
        # Similarity-based retrieval
        context_str = json.dumps(context, sort_keys=True, default=str)
        best_match = None
        best_score = 0.0
        
        # Search working memory first
        for cached_hash, state in self.working_memory.items():
            # Compare against stored context_data, not hash
            cached_ctx_str = json.dumps(state.context_data, sort_keys=True, default=str)
            score = self._similarity_score(context_str, cached_ctx_str)
            
            if score > best_score and score >= similarity_threshold:
                best_score = score
                best_match = state
        
        # Search episodic if no good match in working memory
        if best_match is None:
            for cached_hash, state in self.episodic_memory.items():
                cached_ctx_str = json.dumps(state.context_data, sort_keys=True, default=str)
                score = self._similarity_score(context_str, cached_ctx_str)
                
                if score > best_score and score >= similarity_threshold:
                    best_score = score
                    best_match = state
        
        if best_match:
            # The Cheap Critic: Verify the match
            if completion_fn:
                is_valid = self.verify_match(context, best_match.context_data, completion_fn)
                if not is_valid:
                    # Verification failed, treat as miss
                    return None
            
            self.cache_hits += 1
            self.reasoning_steps_saved += len(best_match.reasoning_trace)
            return best_match
        
        self.cache_misses += 1
        return None

    def extract_pattern(self, 
                       pattern_type: str,
                       min_success_rate: float = 0.75) -> Optional[ReasoningPattern]:
        """
        Extract reusable reasoning pattern from successful episodes
        """
        # Find successful reasoning traces of given type
        successful_states = [
            s for s in list(self.working_memory.values()) + list(self.episodic_memory.values())
            if s.get_success_rate() >= min_success_rate and len(s.reasoning_trace) > 0
        ]
        
        if not successful_states:
            return None
        
        # Abstract common steps (simplified)
        common_steps = []
        for state in successful_states:
            common_steps.extend(state.reasoning_trace)
        
        # Remove duplicates while preserving rough order
        seen = set()
        unique_steps = []
        for step in common_steps:
            if step not in seen:
                seen.add(step)
                unique_steps.append(step)
        
        # Calculate average success rate without numpy
        rates = [s.get_success_rate() for s in successful_states]
        avg_rate = sum(rates) / len(rates) if rates else 0.0
        
        pattern = ReasoningPattern(
            pattern_id=f"pattern_{pattern_type}_{len(self.procedural_memory)}",
            pattern_type=pattern_type,
            preconditions=[],
            steps=unique_steps[:10],
            success_contexts=[s.context_hash for s in successful_states],
            avg_success_rate=avg_rate,
            uses=0
        )
        
        self.procedural_memory[pattern.pattern_id] = pattern
        return pattern
