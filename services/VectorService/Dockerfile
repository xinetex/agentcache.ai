# Use official .NET SDK image to build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy csproj and restore
COPY *.csproj ./
RUN dotnet restore

# Copy everything else and build
COPY . ./
RUN dotnet publish -c Release -o out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/out .

# Install dependencies for FAISS
# We need OpenBLAS and LAPACK usually for FAISS
RUN apt-get update && apt-get install -y \
    libopenblas-dev \
    liblapack-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install FAISS (Pre-built or compile? For Docker we should probably compile or grab pre-built)
# For this blueprint, we will simulate the presence of libfaiss_c.so
# In a real scenario, you would use a multi-stage build to compile faiss from source
# or download a specific version for Debian.
# We will use valid placeholder steps for installing faiss dependencies.

# Make sure the app looks for the library in the right place
ENV LD_LIBRARY_PATH=/app/native:/usr/local/lib:$LD_LIBRARY_PATH

EXPOSE 8080
ENTRYPOINT ["dotnet", "AgentCache.VectorService.dll"]
