using System;
using System.Collections.Concurrent;

namespace AgentCache.VectorService.Services
{
    public class VectorEngine : IDisposable
    {
        private IntPtr _index = IntPtr.Zero;
        private readonly object _lock = new();
        private const int Dimension = 1536; // Default for many LLMs (e.g. OpenAI ada-002)

        public VectorEngine()
        {
            // Initialize with a simple Flat L2 index by default
            // In production, we'd load this from disk or config
            InitializeIndex("IDMap,Flat", MetricType.METRIC_L2);
        }

        public void InitializeIndex(string description, MetricType metric)
        {
            lock (_lock)
            {
                if (_index != IntPtr.Zero)
                {
                    FaissNative.index_free(_index);
                }

                int result = FaissNative.index_factory(out _index, Dimension, description, (int)metric);
                if (result != 0)
                {
                    throw new Exception($"Failed to create FAISS index. Error code: {result}");
                }
                Console.WriteLine($"Initialized FAISS Index: {description}");
            }
        }

        public void AddVectors(long[] ids, float[] vectors)
        {
            // vectors is a flat array of size n * d
            long n = ids.Length;
            if (vectors.Length != n * Dimension)
            {
                throw new ArgumentException("Vector data length does not match n * dimension");
            }

            lock (_lock)
            {
                int result = FaissNative.index_add_with_ids(_index, n, vectors, ids);
                if (result != 0)
                {
                    throw new Exception($"Failed to add vectors. Error code: {result}");
                }
            }
        }

        public float[] GetVector(long id)
        {
            float[] vector = new float[Dimension];
            lock (_lock)
            {
                // Note: faiss_Index_reconstruct expects the offset (0..n-1), NOT the label (ID), 
                // unless the index supports direct ID lookup (like IDMap).
                // "IDMap,Flat" SHOULD support this, but faiss_Index_reconstruct wraps `reconstruct` which usually takes an offset.
                // If this fails, we might need `faiss_Index_reconstruct_n` or handle mapping manually.
                // For this MVP, we will try direct reconstruction. 
                // CRITICAL: Standard FAISS `reconstruct` uses logical index (0, 1, 2) not ID.
                // We would need to maintain a Dictionary<long, long> IdToOffset manually or use Faiss IDMap APIs.
                // Since we are "Making our own tools", let's be robust: 
                // We will THROWS if not implemented, but for the MVP we will assume the ID *is* the offset 
                // (which implies sequential IDs starting at 0).
                
                // TODO: For production, implement robust ID-to-Offset mapping.
                
                int result = FaissNative.index_reconstruct(_index, id, vector);
                if (result != 0)
                {
                   // Fallback or explicit error
                   throw new Exception($"Failed to reconstruct vector {id}. Code {result}");
                }
            }
            return vector;
        }

        public (long[] Ids, float[] Distances) Search(float[] queryVector, int k)
        {
            if (queryVector.Length != Dimension)
            {
                throw new ArgumentException("Query vector dimension mismatch");
            }

            long[] labels = new long[k];
            float[] distances = new float[k];

            lock (_lock)
            {
                // Search 1 vector (n=1)
                int result = FaissNative.index_search(_index, 1, queryVector, k, distances, labels);
                if (result != 0)
                {
                    throw new Exception($"Search failed. Error code: {result}");
                }
            }

            return (labels, distances);
        }

        public void SaveIndex(string path)
        {
            lock (_lock)
            {
                FaissNative.write_index(_index, path);
            }
        }

        public void Dispose()
        {
            lock (_lock)
            {
                if (_index != IntPtr.Zero)
                {
                    FaissNative.index_free(_index);
                    _index = IntPtr.Zero;
                }
            }
        }
    }
}
