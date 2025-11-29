import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/game/session - Start or complete a game session
 * GET /api/game/session/:id - Get session details
 * 
 * Tracks agent "play sessions" for evaluation and pattern discovery
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Auth
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const sql = neon(process.env.DATABASE_URL);

    // POST - Start or complete session
    if (req.method === 'POST') {
      const { 
        action, // 'start' or 'complete'
        sessionId,
        sessionType,
        sector,
        useCase,
        goal,
        pipelineConfig,
        success,
        metrics
      } = req.body;

      if (action === 'start') {
        // Start new session
        const result = await sql`
          INSERT INTO game_sessions (
            user_id,
            session_type,
            sector,
            use_case,
            goal,
            pipeline_config,
            started_at
          ) VALUES (
            ${userId},
            ${sessionType || 'wizard'},
            ${sector},
            ${useCase},
            ${goal || ''},
            ${JSON.stringify(pipelineConfig || {})},
            NOW()
          )
          RETURNING id, started_at
        `;

        return res.status(201).json({
          sessionId: result[0].id,
          startedAt: result[0].started_at
        });

      } else if (action === 'complete') {
        // Complete existing session
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId required' });
        }

        // Calculate score
        const score = calculateScore(metrics);
        const duration = Math.floor((Date.now() - new Date(metrics.startedAt || Date.now())) / 1000);

        // Check if pattern is novel
        const { discoveredPattern, noveltyScore } = await checkPatternNovelty(
          sql, 
          pipelineConfig, 
          sector, 
          useCase
        );

        const result = await sql`
          UPDATE game_sessions
          SET
            success = ${success || false},
            score = ${score},
            metrics = ${JSON.stringify(metrics)},
            completed_at = NOW(),
            duration_seconds = ${duration},
            discovered_pattern = ${discoveredPattern},
            pattern_novelty_score = ${noveltyScore}
          WHERE id = ${sessionId} AND user_id = ${userId}
          RETURNING id, score, discovered_pattern, pattern_novelty_score
        `;

        if (result.length === 0) {
          return res.status(404).json({ error: 'Session not found' });
        }

        // If high-scoring pattern, consider adding to pattern_discoveries
        if (score >= 80 && discoveredPattern) {
          await recordPatternDiscovery(sql, userId, sessionId, {
            sector,
            useCase,
            config: pipelineConfig,
            metrics,
            noveltyScore
          });
        }

        return res.status(200).json({
          sessionId: result[0].id,
          score: result[0].score,
          discoveredPattern: result[0].discovered_pattern,
          noveltyScore: result[0].pattern_novelty_score,
          achievements: generateAchievements(result[0])
        });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // GET - Get session details
    if (req.method === 'GET') {
      const sessionId = req.query.id;
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }

      const result = await sql`
        SELECT 
          gs.*,
          pd.pattern_name,
          pd.validation_score as pattern_validation_score
        FROM game_sessions gs
        LEFT JOIN pattern_discoveries pd ON pd.session_id = gs.id
        WHERE gs.id = ${sessionId} AND gs.user_id = ${userId}
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      return res.status(200).json({ session: result[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Game session API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Calculate session score (0-100) based on metrics
 */
function calculateScore(metrics) {
  if (!metrics) return 0;

  let score = 0;

  // Hit rate (40 points)
  if (metrics.hitRate) {
    score += Math.min(40, metrics.hitRate * 40);
  }

  // Latency improvement (30 points)
  if (metrics.latencyImprovement) {
    score += Math.min(30, (metrics.latencyImprovement / 100) * 30);
  }

  // Cost savings (30 points)
  if (metrics.costSavings) {
    const normalizedSavings = Math.min(100, metrics.costSavings);
    score += Math.min(30, (normalizedSavings / 100) * 30);
  }

  return Math.round(score);
}

/**
 * Check if pattern is novel compared to existing patterns
 */
async function checkPatternNovelty(sql, config, sector, useCase) {
  if (!config) return { discoveredPattern: false, noveltyScore: 0 };

  try {
    // Look for similar patterns
    const existing = await sql`
      SELECT id, configuration
      FROM wizard_learnings
      WHERE sector = ${sector}
      AND use_case ILIKE ${`%${useCase}%`}
      LIMIT 10
    `;

    if (existing.length === 0) {
      // Completely new for this sector + use case
      return { discoveredPattern: true, noveltyScore: 100 };
    }

    // Calculate similarity to existing patterns
    const configStr = JSON.stringify(config);
    let maxSimilarity = 0;

    for (const pattern of existing) {
      const existingStr = JSON.stringify(pattern.configuration);
      const similarity = calculateStringSimilarity(configStr, existingStr);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // Novelty is inverse of similarity
    const noveltyScore = Math.round((1 - maxSimilarity) * 100);
    const discoveredPattern = noveltyScore >= 30; // At least 30% different

    return { discoveredPattern, noveltyScore };

  } catch (error) {
    console.error('Pattern novelty check error:', error);
    return { discoveredPattern: false, noveltyScore: 0 };
  }
}

/**
 * Simple string similarity (Jaccard coefficient on words)
 */
function calculateStringSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().match(/\w+/g) || []);
  const words2 = new Set(str2.toLowerCase().match(/\w+/g) || []);
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Record a discovered pattern for future learning
 */
async function recordPatternDiscovery(sql, userId, sessionId, data) {
  try {
    const patternName = `${data.sector} - ${data.useCase.substring(0, 50)}`;
    
    await sql`
      INSERT INTO pattern_discoveries (
        session_id,
        discovered_by,
        pattern_name,
        pattern_description,
        sector,
        use_case,
        configuration,
        expected_hit_rate,
        expected_latency_ms,
        expected_cost_savings,
        validation_score,
        discovered_at
      ) VALUES (
        ${sessionId},
        ${userId},
        ${patternName},
        ${'AI-discovered optimal configuration'},
        ${data.sector},
        ${data.useCase},
        ${JSON.stringify(data.config)},
        ${data.metrics.hitRate || 0},
        ${data.metrics.avgLatency || 0},
        ${data.metrics.costSavings || 0},
        ${data.noveltyScore},
        NOW()
      )
    `;

    console.log(`[Game] Pattern discovered: ${patternName} (novelty: ${data.noveltyScore})`);
  } catch (error) {
    console.error('Pattern discovery recording error:', error);
  }
}

/**
 * Generate achievements based on session performance
 */
function generateAchievements(session) {
  const achievements = [];

  if (session.score >= 90) {
    achievements.push({ id: 'master', name: 'Cache Master', description: '90+ score' });
  } else if (session.score >= 80) {
    achievements.push({ id: 'expert', name: 'Cache Expert', description: '80+ score' });
  }

  if (session.discovered_pattern) {
    achievements.push({ 
      id: 'discoverer', 
      name: 'Pattern Discoverer', 
      description: `Found novel pattern (${session.pattern_novelty_score}% unique)` 
    });
  }

  return achievements;
}
