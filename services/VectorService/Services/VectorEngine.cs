using System;
using System.Collections.Concurrent;

namespace AgentCache.VectorService.Services
{
    public class VectorEngine : IDisposable
    {
        private readonly ConcurrentDictionary<string, IntPtr> _indices = new();
        private readonly object _lock = new();
        private const int Dimension = 1536; 
        private const string DefaultIndexDescription = "HNSW32,Flat"; // High-performance HNSW

        public VectorEngine()
        {
        }

        public IntPtr GetOrCreateIndex(string tenantId)
        {
            return _indices.GetOrAdd(tenantId, tid => 
            {
                int result = FaissNative.index_factory(out IntPtr index, Dimension, DefaultIndexDescription, (int)MetricType.METRIC_L2);
                if (result != 0) throw new Exception($"Failed to create index for tenant {tid}. Code: {result}");
                Console.WriteLine($"Initialized Shard for Tenant: {tid} ({DefaultIndexDescription})");
                return index;
            });
        }

        public void AddVectors(IntPtr index, long[] ids, float[] vectors)
        {
            long n = ids.Length;
            if (vectors.Length != n * Dimension)
            {
                throw new ArgumentException("Vector data length does not match n * dimension");
            }

            lock (_lock)
            {
                int result = FaissNative.index_add_with_ids(index, n, vectors, ids);
                if (result != 0) throw new Exception($"Failed to add vectors. Code: {result}");
            }
        }

        public float[] GetVector(IntPtr index, long id)
        {
            float[] vector = new float[Dimension];
            lock (_lock)
            {
                int result = FaissNative.index_reconstruct(index, id, vector);
                if (result != 0) throw new Exception($"Failed to reconstruct vector {id}. Code {result}");
            }
            return vector;
        }

        public (long[] Ids, float[] Distances) Search(IntPtr index, float[] queryVector, int k)
        {
            if (queryVector.Length != Dimension) throw new ArgumentException("Query vector dimension mismatch");

            long[] labels = new long[k];
            float[] distances = new float[k];

            lock (_lock)
            {
                int result = FaissNative.index_search(index, 1, queryVector, k, distances, labels);
                if (result != 0) throw new Exception($"Search failed. Code: {result}");
            }

            return (labels, distances);
        }

        public float CalculateDrift(IntPtr index, float[] queryVector)
        {
            // For MVP: Drift is calculated as the distance from the query to the centroid 
            // of the top-1 result. Higher distance = higher semantic drift from expected patterns.
            var (ids, distances) = Search(index, queryVector, 1);
            if (ids.Length == 0 || ids[0] == -1) return 1.0f; // Max drift if no match
            return distances[0]; 
        }

        public void Dispose()
        {
            lock (_lock)
            {
                foreach (var index in _indices.Values)
                {
                    if (index != IntPtr.Zero) FaissNative.index_free(index);
                }
                _indices.Clear();
            }
        }
    }
}
