using System.Runtime.InteropServices;

namespace AgentCache.VectorService.Services
{
    internal static class FaissNative
    {
        private const string LibName = "faiss_c"; // Assumes libfaiss_c.so or faiss_c.dll is in PATH

        // Index factory
        [DllImport(LibName, EntryPoint = "faiss_index_factory")]
        public static extern int index_factory(out IntPtr index, int d, string description, int metric);

        // Add vectors
        [DllImport(LibName, EntryPoint = "faiss_Index_add")]
        public static extern int index_add(IntPtr index, long n, float[] x);

        // Add vectors with IDs
        [DllImport(LibName, EntryPoint = "faiss_Index_add_with_ids")]
        public static extern int index_add_with_ids(IntPtr index, long n, float[] x, long[] ids);

        // Search
        [DllImport(LibName, EntryPoint = "faiss_Index_search")]
        public static extern int index_search(IntPtr index, long n, float[] x, long k, float[] distances, long[] labels);

        // Reconstruct (Fetch Vector by ID)
        // Note: IDMap indexes require special handling, but for now we assume simple reconstruction if underlying index supports it.
        // For IDMap, we often need to translate ID to offset. 
        // For MVP: We will implement a linear scan or assume the ID *is* the offset if using flat index without IDMap.
        // However, we used "IDMap,Flat".
        [DllImport(LibName, EntryPoint = "faiss_Index_reconstruct")]
        public static extern int index_reconstruct(IntPtr index, long key, float[] recons);

        // Free
        [DllImport(LibName, EntryPoint = "faiss_Index_free")]
        public static extern void index_free(IntPtr index);

        // IO
        [DllImport(LibName, EntryPoint = "faiss_write_index")]
        public static extern int write_index(IntPtr index, string fname);

        [DllImport(LibName, EntryPoint = "faiss_read_index")]
        public static extern int read_index(string fname, int io_flags, out IntPtr index);
    }

    public enum MetricType
    {
        METRIC_INNER_PRODUCT = 0,
        METRIC_L2 = 1,
    }
}
