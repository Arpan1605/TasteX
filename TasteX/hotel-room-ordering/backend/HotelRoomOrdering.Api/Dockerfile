FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj", "backend/HotelRoomOrdering.Api/"]
COPY ["backend/HotelRoomOrdering.Api.Contracts/HotelRoomOrdering.Api.Contracts.csproj", "backend/HotelRoomOrdering.Api.Contracts/"]
RUN dotnet restore "backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj"

COPY . .
RUN dotnet publish "backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000

ENTRYPOINT ["dotnet", "HotelRoomOrdering.Api.dll"]
