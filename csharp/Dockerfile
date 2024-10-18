FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /app

COPY csharp.csproj .
COPY main.cs .

RUN dotnet restore
RUN dotnet build --configuration Release

FROM mcr.microsoft.com/dotnet/runtime:8.0-alpine AS runtime
WORKDIR /app

COPY --from=build /app/bin/Release/net8.0 .
