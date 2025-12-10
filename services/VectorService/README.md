# AgentCache Vector Service

A standalone high-performance vector search microservice built with **C# .NET 8.0** and **FAISS**.

## Prerequisites

1.  **.NET 8.0 SDK**: [Download here](https://dotnet.microsoft.com/download/dotnet/8.0).
2.  **FAISS C Library**: The service expects `libfaiss_c.so` (Linux/Mac) or `faiss_c.dll` (Windows) to be available in the system library path or the application directory.

## Getting Started

### 1. Build the Service
```bash
cd services/VectorService
dotnet build
```

### 2. Run the Service
```bash
dotnet run
```
The service will start on `http://localhost:5000`.

## API Endpoints

### Add Vectors
`POST /Vectors/add`
```json
{
  "ids": [1, 2, 3],
  "vectors": [0.1, 0.2, ... 1536 floats ...]
}
```

### Search
`POST /Vectors/search`
```json
{
  "vector": [0.1, 0.2, ...],
  "k": 5
}
```

## Architecture
- **Language**: C# 8.0
- **Core**: P/Invoke wrapper around Native FAISS.
- **Transport**: REST (ASP.NET Core).
