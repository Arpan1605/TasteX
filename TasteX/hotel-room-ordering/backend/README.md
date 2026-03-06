# Backend + Database Deliverables

## 1) .NET API contracts

- C# contract project: `backend/HotelRoomOrdering.Api.Contracts`

## 2) .NET API implementation scaffold

- Web API project: `backend/HotelRoomOrdering.Api`
- Uses EF Core SQL Server + Swagger + contract-driven services/controllers.
- Current mode: COD only.

## 3) SQL schema

- Complete SQL Server schema:
  - `database/hotel-room-ordering.schema.sql`
- Includes `PaymentMethod` on `Orders` with COD constraint.
