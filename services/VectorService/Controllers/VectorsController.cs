using Microsoft.AspNetCore.Mvc;
using AgentCache.VectorService.Services;

namespace AgentCache.VectorService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class VectorsController : ControllerBase
    {
        private readonly VectorEngine _engine;
        private readonly ILogger<VectorsController> _logger;

        public VectorsController(VectorEngine engine, ILogger<VectorsController> logger)
        {
            _engine = engine;
            _logger = logger;
        }

        [HttpPost("add")]
        public IActionResult AddVectors([FromHeader(Name = "X-Tenant-Id")] string tenantId, [FromBody] AddVectorsRequest request)
        {
            if (string.IsNullOrEmpty(tenantId)) return BadRequest("Missing X-Tenant-Id header.");
            try
            {
                if (request.Vectors == null || request.Ids == null || request.Vectors.Length / 1536 != request.Ids.Length)
                {
                    return BadRequest("Invalid vector data or dimension mismatch (1536 expected).");
                }

                var index = _engine.GetOrCreateIndex(tenantId);
                _engine.AddVectors(index, request.Ids, request.Vectors);
                return Ok(new { count = request.Ids.Length, message = "Vectors added successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding vectors");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("search")]
        public IActionResult Search([FromHeader(Name = "X-Tenant-Id")] string tenantId, [FromBody] SearchRequest request)
        {
            if (string.IsNullOrEmpty(tenantId)) return BadRequest("Missing X-Tenant-Id header.");
            try
            {
                var index = _engine.GetOrCreateIndex(tenantId);
                var (ids, distances) = _engine.Search(index, request.Vector, request.K);
                
                var results = new List<SearchResult>();
                for (int i = 0; i < ids.Length; i++)
                {
                    results.Add(new SearchResult { Id = ids[i], Distance = distances[i] });
                }

                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching vectors");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("drift")]
        public IActionResult CalculateDrift([FromHeader(Name = "X-Tenant-Id")] string tenantId, [FromBody] DriftRequest request)
        {
            if (string.IsNullOrEmpty(tenantId)) return BadRequest("Missing X-Tenant-Id header.");
            try
            {
                var index = _engine.GetOrCreateIndex(tenantId);
                var driftValue = _engine.CalculateDrift(index, request.Vector);
                return Ok(new { drift = driftValue });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating drift");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("{id}")]
        public IActionResult Fetch([FromHeader(Name = "X-Tenant-Id")] string tenantId, long id)
        {
            if (string.IsNullOrEmpty(tenantId)) return BadRequest("Missing X-Tenant-Id header.");
            try
            {
                var index = _engine.GetOrCreateIndex(tenantId);
                var vector = _engine.GetVector(index, id);
                return Ok(new { id, vector });
            }
            catch (Exception ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }
    }

    public class AddVectorsRequest
    {
        public long[] Ids { get; set; } = Array.Empty<long>();
        public float[] Vectors { get; set; } = Array.Empty<float>();
    }

    public class SearchRequest
    {
        public float[] Vector { get; set; } = Array.Empty<float>();
        public int K { get; set; } = 5;
    }

    public class DriftRequest
    {
        public float[] Vector { get; set; } = Array.Empty<float>();
    }

    public class SearchResult
    {
        public long Id { get; set; }
        public float Distance { get; set; }
    }
}
