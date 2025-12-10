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
        public IActionResult AddVectors([FromBody] AddVectorsRequest request)
        {
            try
            {
                if (request.Vectors == null || request.Ids == null || request.Vectors.Length / 1536 != request.Ids.Length)
                {
                    return BadRequest("Invalid vector data or dimension mismatch (1536 expected).");
                }

                _engine.AddVectors(request.Ids, request.Vectors);
                return Ok(new { count = request.Ids.Length, message = "Vectors added successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding vectors");
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("search")]
        public IActionResult Search([FromBody] SearchRequest request)
        {
            try
            {
                var (ids, distances) = _engine.Search(request.Vector, request.K);
                
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

        [HttpGet("{id}")]
        public IActionResult Fetch(long id)
        {
            try
            {
                var vector = _engine.GetVector(id);
                return Ok(new { id, vector });
            }
            catch (Exception ex)
            {
                // likely 404 or index error
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

    public class SearchResult
    {
        public long Id { get; set; }
        public float Distance { get; set; }
    }
}
