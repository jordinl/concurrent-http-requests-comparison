FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

COPY csharp.csproj .
COPY main.cs .

RUN dotnet restore
RUN dotnet build

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/bin/Debug/net8.0 .

CMD ["dotnet", "csharp.dll"]