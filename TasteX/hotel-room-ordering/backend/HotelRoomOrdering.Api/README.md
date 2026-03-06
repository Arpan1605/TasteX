# HotelRoomOrdering.Api

`.NET 8` Web API implementation scaffold aligned to contracts and SQL schema.

## Includes

- Controllers:
  - `api/v1/guest`
  - `api/v1/kitchen`
  - `api/v1/payments` (disabled in COD-only phase)
  - `api/v1/webhooks` (disabled in COD-only phase)
- EF Core SQL Server setup
- Entity model mapped to schema tables
- Contract-based service implementations
- Design-time `DbContext` factory for migrations

## Current phase

- OTP verified ordering
- Cash on Delivery only
- Kitchen flow active for COD orders

## Run (after installing .NET 8 SDK)

1. Restore/build:
   - `dotnet restore backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj`
   - `dotnet build backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj`
2. Create migration:
   - `dotnet ef migrations add InitialCreate --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --startup-project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --output-dir Data/Migrations`
3. Apply migration:
   - `dotnet ef database update --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --startup-project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj`
4. Run API:
   - `dotnet run --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj`

Swagger: `/swagger`
