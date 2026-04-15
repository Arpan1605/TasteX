# Hotel Room Ordering System

Full-stack QR hotel ordering system with:
- Guest portal (QR scan -> OTP -> menu -> order status)
- Kitchen dashboard (live orders, status updates, COD received)
- Admin dashboard (hotels, kitchens, menu, inventory)

---

## Requirements (install on your machine)

### Backend
- .NET SDK 8.x
- PostgreSQL 15+ (local or cloud)
- EF Core tools
  - `dotnet tool install --global dotnet-ef`

### Frontend
- Node.js 20+
- npm 10+ (repo uses `npm@10.9.0`)

---

## 1) Clone the repo

```bash
git clone https://github.com/Arpan1605/TasteX.git
cd TasteX/hotel-room-ordering
```

---

## 2) Database setup (Postgres)

### Option A: Use EF Core migrations (recommended)

1. Make sure PostgreSQL is running.
2. Update connection string in:
   - `backend/HotelRoomOrdering.Api/appsettings.json`

Example (local Postgres):
```json
"ConnectionStrings": {
  "OrderingDb": "Host=localhost;Port=5432;Database=hotel_room_ordering;Username=postgres;Password=postgres"
}
```

3. Run migrations:
```bash
dotnet ef database update --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --startup-project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj
```

### Option B: Create tables manually

If you prefer manual setup, use your Postgres client to create the DB and then run migrations later.

---

## 3) Run the backend

```bash
dotnet restore backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj
dotnet run --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj
```

Backend will run at:
```
http://localhost:5187
```

Swagger:
```
http://localhost:5187/swagger
```

---

## 4) Run the frontend

```bash
npm install
npm start
```

Frontend runs at:
```
http://localhost:4200
```

Proxy config (already set):
```
src/proxy.conf.json -> http://localhost:5187
```

---

## 5) Common troubleshooting

### Backend cannot connect to DB
- Ensure PostgreSQL is running
- Verify connection string in `backend/HotelRoomOrdering.Api/appsettings.json`
- Confirm database exists and migrations were applied

### `dotnet` not found
- Install .NET SDK 8: https://dotnet.microsoft.com/download

### `dotnet-ef` not found
```bash
dotnet tool install --global dotnet-ef
```

### Frontend 500 or API errors
- Ensure backend is running on `http://localhost:5187`
- Check proxy settings in `proxy.conf.json`

---

## Useful commands

```bash
# Backend
dotnet build backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj
dotnet ef database update --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --startup-project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj

# Frontend
npm start
npm run build
```

---

## Notes

- COD flow only (payments integrations currently disabled).
- Kitchen dashboard order status updates and COD received are real-time (polled).
- `render.yaml` is included for UAT deployment on Render.
- `render.prod.yaml` is included for Prod deployment on Render.
- Render free tier only allows one free Postgres database per workspace, so create separate Render workspaces for UAT and Prod and set `ConnectionStrings__OrderingDb` manually in each backend service.

