# Hotel Room Ordering System

Full‑stack QR hotel ordering system with:
- **Guest portal** (QR scan → OTP → menu → order status)
- **Kitchen dashboard** (live orders, status updates, COD received)
- **Admin dashboard** (hotels, kitchens, menu, inventory)

---

## Requirements (install on your machine)

### Backend
- **.NET SDK 8.x**
- **SQL Server** (LocalDB, SQL Server Express, or full SQL Server)
- **EF Core tools**
  - `dotnet tool install --global dotnet-ef`

### Frontend
- **Node.js 20+**
- **npm 10+** (repo uses `npm@10.9.0`)

---

## 1) Clone the repo

```bash
git clone https://github.com/Arpan1605/TasteX.git
cd TasteX/hotel-room-ordering
```

---

## 2) Database setup

### Option A: Use EF Core migrations (recommended)

1. Make sure SQL Server is running.
2. Update connection string in:
   - `backend/HotelRoomOrdering.Api/appsettings.json`

Example (LocalDB):
```json
"ConnectionStrings": {
  "DefaultConnection": "Server=(localdb)\\MSSQLLocalDB;Database=HotelRoomOrdering;Trusted_Connection=True;TrustServerCertificate=True;"
}
```

3. Run migrations:
```bash
dotnet ef database update --project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj --startup-project backend/HotelRoomOrdering.Api/HotelRoomOrdering.Api.csproj
```

### Option B: Run SQL schema directly

Use `database/hotel-room-ordering.schema.sql` in SQL Server Management Studio to create tables manually.

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
- Ensure SQL Server is running
- Verify connection string in `backend/HotelRoomOrdering.Api/appsettings.json`
- Confirm DB exists and tables created (EF migrations or schema file)

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
- Kitchen dashboard order status updates and COD received are real‑time (polled).

