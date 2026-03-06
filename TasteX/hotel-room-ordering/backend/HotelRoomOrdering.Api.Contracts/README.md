# Hotel Room Ordering API Contracts (.NET)

This folder contains contract-only artifacts for backend implementation:

- `Enums/`: shared enums used by API and DB mappings.
- `Catalog/`, `Guest/`, `Kitchen/`, `Payments/`, `Webhooks/`: DTOs for requests/responses.
- `Contracts/`: endpoint-level service contracts (`IGuestOrderingContract`, etc).

Target framework: `.NET 8`.

## Current phase

- OTP verified ordering
- Cash on Delivery only (`PaymentMethod = Cod`)
- Kitchen dashboard shows COD orders and order status updates

## Next phase

- Payment gateway checkout flow
- Payment verification + webhook reconciliation
