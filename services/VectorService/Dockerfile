# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["AgentCache.VectorService.csproj", "./"]
RUN dotnet restore "AgentCache.VectorService.csproj"

# Copy full source and publish
COPY . .
RUN dotnet publish "AgentCache.VectorService.csproj" -c Release -o /app/publish

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Install native FAISS dependencies (Consistent BLAS/LAPACK runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Standardize native library lookup path
ENV LD_LIBRARY_PATH=/app:$LD_LIBRARY_PATH

# Performance: HNSW optimizations benefit from standardizing thread counts
ENV OMP_NUM_THREADS=4

EXPOSE 8080
ENTRYPOINT ["dotnet", "AgentCache.VectorService.dll"]
