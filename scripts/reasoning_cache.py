import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime
import json
import hashlib

@dataclass
class ReasoningState:
    """Represents a cached reasoning state (analogous to working memory)"""
    context_hash: str
    reasoning_trace: List[str]
    intermediate_values: Dict[str, any]
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
    pattern_type: str  # "deductive", "inductive", "abductive", "analogical"
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
                 decay_rate: float = 0.95):
        """
        Args:
            working_memory_capacity: Max items in active cache (mirrors human WM limits)
            cache_threshold: Minimum confidence to cache a reasoning trace
            decay_rate: How quickly cached items lose relevance
        """
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
        
        # Statistics
        self.cache_hits = 0
        self.cache_misses = 0
        self.reasoning_steps_saved = 0
    
    def _compute_context_hash(self, context: Dict[str, any]) -> str:
        """Create stable hash for reasoning context"""
        context_str = json.dumps(context, sort_keys=True)
        return hashlib.sha256(context_str.encode()).hexdigest()[:16]
    
    def _similarity_score(self, ctx1: str, ctx2: str) -> float:
        """
        Simplified similarity for demo. In production:
        - Use embedding cosine similarity
        - Graph edit distance for structured reasoning
        - Semantic matching via language models
        """
        # Simple character overlap for demo
        set1, set2 = set(ctx1), set(ctx2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
    
    def gate_update(self, context_hash: str, new_state: ReasoningState) -> bool:
        """
        Gating mechanism: decide whether to update working memory.
        Inspired by basal ganglia go/no-go signals in PBWM model.
        
        Returns: True if working memory should be updated
        """
        # Gate open if confidence exceeds threshold
        if new_state.confidence < self.cache_threshold:
            return False
        
        # If working memory full, check if new state is more valuable
        if len(self.working_memory) >= self.wm_capacity:
            # Find least valuable item
            min_value = min(
                (s.confidence * s.get_success_rate() for s in self.working_memory.values()),
                default=0.0
            )
            new_value = new_state.confidence * new_state.get_success_rate()
            
            if new_value <= min_value:
                return False  # Don't displace existing memory
            
            # Evict least valuable
            evict_key = min(
                self.working_memory.keys(),
                key=lambda k: self.working_memory[k].confidence * self.working_memory[k].get_success_rate()
            )
            self._evict_to_episodic(evict_key)
        
        return True
    
    def _evict_to_episodic(self, context_hash: str):
        """Move item from working to episodic memory (consolidation)"""
        if context_hash in self.working_memory:
            state = self.working_memory.pop(context_hash)
            self.episodic_memory[context_hash] = state
    
    def cache_reasoning(self,
                       context: Dict[str, any],
                       reasoning_trace: List[str],
                       intermediate_values: Dict[str, any],
                       confidence: float) -> str:
        """
        Cache a reasoning episode (analogous to encoding in prefrontal cortex)
        
        Args:
            context: Problem context/inputs
            reasoning_trace: Sequence of reasoning steps taken
            intermediate_values: Key intermediate computations
            confidence: How confident we are in this reasoning path
            
        Returns:
            context_hash for retrieval
        """
        context_hash = self._compute_context_hash(context)
        
        state = ReasoningState(
            context_hash=context_hash,
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
                          context: Dict[str, any],
                          similarity_threshold: float = 0.7) -> Optional[ReasoningState]:
        """
        Retrieve cached reasoning for similar context
        (analogous to retrieval from prefrontal working memory)
        
        Returns cached state if found, else None
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
        
        # Similarity-based retrieval (analogical reasoning)
        context_str = json.dumps(context, sort_keys=True)
        best_match = None
        best_score = 0.0
        
        # Search working memory first (more recent/relevant)
        for cached_hash, state in self.working_memory.items():
            score = self._similarity_score(context_str, cached_hash)
            if score > best_score and score >= similarity_threshold:
                best_score = score
                best_match = state
        
        # Search episodic if no good match in working memory
        if best_match is None:
            for cached_hash, state in self.episodic_memory.items():
                score = self._similarity_score(context_str, cached_hash)
                if score > best_score and score >= similarity_threshold:
                    best_score = score
                    best_match = state
        
        if best_match:
            self.cache_hits += 1
            self.reasoning_steps_saved += len(best_match.reasoning_trace)
            return best_match
        
        self.cache_misses += 1
        return None
    
    def update_outcome(self, context_hash: str, success: bool):
        """Update success statistics (reinforcement learning signal)"""
        for memory in [self.working_memory, self.episodic_memory]:
            if context_hash in memory:
                state = memory[context_hash]
                if success:
                    state.success_count += 1
                else:
                    state.failure_count += 1
                return
    
    def extract_pattern(self, 
                       pattern_type: str,
                       min_success_rate: float = 0.75) -> Optional[ReasoningPattern]:
        """
        Extract reusable reasoning pattern from successful episodes
        (analogous to procedural memory consolidation)
        """
        # Find successful reasoning traces of given type
        successful_states = [
            s for s in list(self.working_memory.values()) + list(self.episodic_memory.values())
            if s.get_success_rate() >= min_success_rate and len(s.reasoning_trace) > 0
        ]
        
        if not successful_states:
            return None
        
        # Abstract common steps (simplified - in production use LLM or clustering)
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
        
        pattern = ReasoningPattern(
            pattern_id=f"pattern_{pattern_type}_{len(self.procedural_memory)}",
            pattern_type=pattern_type,
            preconditions=[],  # Would extract from successful contexts
            steps=unique_steps[:10],  # Top 10 most common steps
            success_contexts=[s.context_hash for s in successful_states],
            avg_success_rate=np.mean([s.get_success_rate() for s in successful_states]),
            uses=0
        )
        
        self.procedural_memory[pattern.pattern_id] = pattern
        return pattern
    
    def get_statistics(self) -> Dict[str, any]:
        """Get cache performance statistics"""
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = self.cache_hits / total_requests if total_requests > 0 else 0.0
        
        return {
            "working_memory_size": len(self.working_memory),
            "episodic_memory_size": len(self.episodic_memory),
            "procedural_patterns": len(self.procedural_memory),
            "cache_hit_rate": hit_rate,
            "reasoning_steps_saved": self.reasoning_steps_saved,
            "total_requests": total_requests
        }


# Example usage demonstrating the system
def main():
    """Demo: Using reasoning cache for mathematical problem solving"""
    
    cache = ReasoningCache(
        working_memory_capacity=7,
        cache_threshold=0.6
    )
    
    # Scenario 1: First time solving "what is 15% of 80?"
    context_1 = {
        "problem_type": "percentage",
        "operation": "find_percentage_of_number",
        "percentage": 15,
        "number": 80
    }
    
    reasoning_trace_1 = [
        "Convert percentage to decimal: 15% = 0.15",
        "Multiply decimal by number: 0.15 × 80",
        "Calculate result: 12"
    ]
    
    intermediate_1 = {
        "decimal_form": 0.15,
        "product": 12
    }
    
    hash_1 = cache.cache_reasoning(
        context=context_1,
        reasoning_trace=reasoning_trace_1,
        intermediate_values=intermediate_1,
        confidence=0.95
    )
    cache.update_outcome(hash_1, success=True)
    
    print("=== Cached first reasoning episode ===")
    print(f"Context hash: {hash_1}")
    print(f"Steps: {len(reasoning_trace_1)}")
    
    # Scenario 2: Similar problem "what is 20% of 100?" — cache hit via similarity
    context_2 = {
        "problem_type": "percentage",
        "operation": "find_percentage_of_number",
        "percentage": 20,
        "number": 100
    }
    
    retrieved = cache.retrieve_reasoning(context_2, similarity_threshold=0.6)
    
    if retrieved:
        print("\n=== Cache hit! Retrieved similar reasoning ===")
        print(f"Retrieved trace with {len(retrieved.reasoning_trace)} steps")
        print("Can adapt cached steps rather than reasoning from scratch:")
        for i, step in enumerate(retrieved.reasoning_trace, 1):
            # Adapt cached reasoning to new problem
            adapted = step.replace("15%", "20%").replace("0.15", "0.20").replace("80", "100").replace("12", "20")
            print(f"  {i}. {adapted}")
        print(f"\nSteps saved: {len(retrieved.reasoning_trace)}")
    
    # Scenario 3: Cache multiple episodes and extract pattern
    contexts = [
        {"problem_type": "percentage", "operation": "find_percentage_of_number", "percentage": 25, "number": 200},
        {"problem_type": "percentage", "operation": "find_percentage_of_number", "percentage": 10, "number": 50},
        {"problem_type": "percentage", "operation": "find_percentage_of_number", "percentage": 30, "number": 150},
    ]
    
    for ctx in contexts:
        trace = [
            f"Convert percentage to decimal: {ctx['percentage']}% = {ctx['percentage']/100}",
            f"Multiply decimal by number: {ctx['percentage']/100} × {ctx['number']}",
            f"Calculate result: {ctx['percentage']/100 * ctx['number']}"
        ]
        h = cache.cache_reasoning(ctx, trace, {}, confidence=0.9)
        cache.update_outcome(h, success=True)
    
    # Extract reusable pattern
    pattern = cache.extract_pattern("percentage_calculation", min_success_rate=0.7)
    
    if pattern:
        print("\n=== Extracted procedural reasoning pattern ===")
        print(f"Pattern ID: {pattern.pattern_id}")
        print(f"Success rate: {pattern.avg_success_rate:.2%}")
        print("Abstract steps:")
        for i, step in enumerate(pattern.steps, 1):
            print(f"  {i}. {step}")
    
    # Statistics
    print("\n=== Cache statistics ===")
    stats = cache.get_statistics()
    for key, value in stats.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
