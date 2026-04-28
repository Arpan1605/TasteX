using HotelRoomOrdering.Api.Contracts.Admin;
using HotelRoomOrdering.Api.Contracts.Common;
using HotelRoomOrdering.Api.Contracts.Contracts;
using HotelRoomOrdering.Api.Data;
using HotelRoomOrdering.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HotelRoomOrdering.Api.Services;

public sealed class AdminManagementService(OrderingDbContext db, IClock clock, IPasswordHashService passwordHashService, IConfiguration configuration) : IAdminManagementContract
{
    public async Task<ApiResponse<IReadOnlyList<AdminCityDto>>> GetCitiesAsync(CancellationToken cancellationToken = default)
    {
        var cities = await db.Cities.AsNoTracking().OrderBy(c => c.Name).ToListAsync(cancellationToken);

        var payload = new List<AdminCityDto>(cities.Count);
        foreach (var city in cities)
        {
            var cityHotelIds = await db.Hotels.Where(h => h.CityId == city.CityId).Select(h => h.HotelId).ToListAsync(cancellationToken);
            var revenue = cityHotelIds.Count == 0
                ? 0m
                : await db.Orders.Where(o => cityHotelIds.Contains(o.HotelId)).SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

            payload.Add(new AdminCityDto(
                city.CityId,
                city.Name,
                city.StateName,
                city.IsActive,
                await db.Kitchens.CountAsync(k => k.CityId == city.CityId, cancellationToken),
                cityHotelIds.Count,
                revenue));
        }

        return new ApiResponse<IReadOnlyList<AdminCityDto>>(true, payload, null);
    }

    public async Task<ApiResponse<AdminCityDto>> CreateCityAsync(UpsertCityRequest request, CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        var city = new City
        {
            CityCode = BuildCode("CTY", request.Name, now),
            Name = request.Name.Trim(),
            StateName = string.IsNullOrWhiteSpace(request.StateName) ? null : request.StateName.Trim(),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Cities.Add(city);
        await db.SaveChangesAsync(cancellationToken);

        var dto = new AdminCityDto(city.CityId, city.Name, city.StateName, city.IsActive, 0, 0, 0m);
        return new ApiResponse<AdminCityDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminCityDto>> UpdateCityAsync(long cityId, UpsertCityRequest request, CancellationToken cancellationToken = default)
    {
        var city = await db.Cities.FirstOrDefaultAsync(c => c.CityId == cityId, cancellationToken);
        if (city is null)
        {
            return new ApiResponse<AdminCityDto>(false, null, new ApiError("CITY_NOT_FOUND", "City not found."));
        }

        city.Name = request.Name.Trim();
        city.StateName = string.IsNullOrWhiteSpace(request.StateName) ? null : request.StateName.Trim();
        city.IsActive = request.IsActive;
        city.UpdatedAtUtc = clock.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        var hotelIds = await db.Hotels.Where(h => h.CityId == city.CityId).Select(h => h.HotelId).ToListAsync(cancellationToken);
        var revenue = hotelIds.Count == 0
            ? 0m
            : await db.Orders.Where(o => hotelIds.Contains(o.HotelId)).SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        var dto = new AdminCityDto(
            city.CityId,
            city.Name,
            city.StateName,
            city.IsActive,
            await db.Kitchens.CountAsync(k => k.CityId == city.CityId, cancellationToken),
            hotelIds.Count,
            revenue);

        return new ApiResponse<AdminCityDto>(true, dto, null);
    }

    public async Task<ApiResponse<IReadOnlyList<AdminKitchenDto>>> GetKitchensAsync(CancellationToken cancellationToken = default)
    {
        var kitchens = await db.Kitchens.AsNoTracking().Include(k => k.City).OrderBy(k => k.Name).ToListAsync(cancellationToken);

        var payload = new List<AdminKitchenDto>(kitchens.Count);
        foreach (var kitchen in kitchens)
        {
            payload.Add(await BuildKitchenDto(kitchen, cancellationToken));
        }

        return new ApiResponse<IReadOnlyList<AdminKitchenDto>>(true, payload, null);
    }

    public async Task<ApiResponse<AdminKitchenDto>> CreateKitchenAsync(UpsertKitchenRequest request, CancellationToken cancellationToken = default)
    {
        var city = await db.Cities.AsNoTracking().FirstOrDefaultAsync(c => c.CityId == request.CityId, cancellationToken);
        if (city is null)
        {
            return new ApiResponse<AdminKitchenDto>(false, null, new ApiError("CITY_NOT_FOUND", "City not found."));
        }

        var loginValidationError = await ValidateKitchenCredentialsAsync(request, null, cancellationToken);
        if (loginValidationError is not null)
        {
            return new ApiResponse<AdminKitchenDto>(false, null, loginValidationError);
        }

        var now = clock.UtcNow;
        var kitchen = new Kitchen
        {
            CityId = request.CityId,
            KitchenCode = BuildCode("KCH", request.Name, now),
            Name = request.Name.Trim(),
            AddressLine = string.IsNullOrWhiteSpace(request.AddressLine) ? null : request.AddressLine.Trim(),
            ContactPhone = string.IsNullOrWhiteSpace(request.ContactPhone) ? null : request.ContactPhone.Trim(),
            ManagerName = string.IsNullOrWhiteSpace(request.ManagerName) ? null : request.ManagerName.Trim(),
            LoginUsername = request.LoginUsername.Trim().ToLowerInvariant(),
            PasswordHash = passwordHashService.HashPassword(request.LoginPassword!.Trim()),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Kitchens.Add(kitchen);
        await db.SaveChangesAsync(cancellationToken);

        var reloaded = await db.Kitchens.AsNoTracking().Include(k => k.City).FirstAsync(k => k.KitchenId == kitchen.KitchenId, cancellationToken);
        return new ApiResponse<AdminKitchenDto>(true, await BuildKitchenDto(reloaded, cancellationToken), null);
    }

    public async Task<ApiResponse<AdminKitchenDto>> UpdateKitchenAsync(long kitchenId, UpsertKitchenRequest request, CancellationToken cancellationToken = default)
    {
        var kitchen = await db.Kitchens.FirstOrDefaultAsync(k => k.KitchenId == kitchenId, cancellationToken);
        if (kitchen is null)
        {
            return new ApiResponse<AdminKitchenDto>(false, null, new ApiError("KITCHEN_NOT_FOUND", "Kitchen not found."));
        }

        var city = await db.Cities.AsNoTracking().FirstOrDefaultAsync(c => c.CityId == request.CityId, cancellationToken);
        if (city is null)
        {
            return new ApiResponse<AdminKitchenDto>(false, null, new ApiError("CITY_NOT_FOUND", "City not found."));
        }

        var loginValidationError = await ValidateKitchenCredentialsAsync(request, kitchenId, cancellationToken);
        if (loginValidationError is not null)
        {
            return new ApiResponse<AdminKitchenDto>(false, null, loginValidationError);
        }

        kitchen.CityId = request.CityId;
        kitchen.Name = request.Name.Trim();
        kitchen.AddressLine = string.IsNullOrWhiteSpace(request.AddressLine) ? null : request.AddressLine.Trim();
        kitchen.ContactPhone = string.IsNullOrWhiteSpace(request.ContactPhone) ? null : request.ContactPhone.Trim();
        kitchen.ManagerName = string.IsNullOrWhiteSpace(request.ManagerName) ? null : request.ManagerName.Trim();
        kitchen.LoginUsername = request.LoginUsername.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(request.LoginPassword))
        {
            kitchen.PasswordHash = passwordHashService.HashPassword(request.LoginPassword.Trim());
        }
        kitchen.IsActive = request.IsActive;
        kitchen.UpdatedAtUtc = clock.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        var reloaded = await db.Kitchens.AsNoTracking().Include(k => k.City).FirstAsync(k => k.KitchenId == kitchenId, cancellationToken);
        return new ApiResponse<AdminKitchenDto>(true, await BuildKitchenDto(reloaded, cancellationToken), null);
    }

    public async Task<ApiResponse<IReadOnlyList<AdminHotelDto>>> GetHotelsAsync(CancellationToken cancellationToken = default)
    {
        var hotels = await db.Hotels
            .AsNoTracking()
            .Include(h => h.City)
            .Include(h => h.Kitchen)
            .OrderBy(h => h.Name)
            .ToListAsync(cancellationToken);

        var payload = new List<AdminHotelDto>(hotels.Count);
        foreach (var hotel in hotels)
        {
            payload.Add(await BuildHotelDto(hotel, cancellationToken));
        }

        return new ApiResponse<IReadOnlyList<AdminHotelDto>>(true, payload, null);
    }

    public async Task<ApiResponse<AdminHotelDto>> CreateHotelAsync(UpsertHotelRequest request, CancellationToken cancellationToken = default)
    {
        var city = await db.Cities.AsNoTracking().FirstOrDefaultAsync(c => c.CityId == request.CityId, cancellationToken);
        if (city is null)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("CITY_NOT_FOUND", "City not found."));
        }

        var kitchen = await db.Kitchens.AsNoTracking().FirstOrDefaultAsync(k => k.KitchenId == request.KitchenId, cancellationToken);
        if (kitchen is null)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("KITCHEN_NOT_FOUND", "Kitchen not found."));
        }

        if (kitchen.CityId != request.CityId)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("KITCHEN_CITY_MISMATCH", "Selected kitchen does not belong to selected city."));
        }

        var now = clock.UtcNow;
        var hotel = new Hotel
        {
            CityId = request.CityId,
            KitchenId = request.KitchenId,
            HotelCode = BuildCode("HTL", request.Name, now),
            Name = request.Name.Trim(),
            AddressLine = string.IsNullOrWhiteSpace(request.AddressLine) ? null : request.AddressLine.Trim(),
            RoomCount = Math.Max(0, request.RoomCount),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Hotels.Add(hotel);
        await db.SaveChangesAsync(cancellationToken);

        var reloaded = await db.Hotels.AsNoTracking().Include(h => h.City).Include(h => h.Kitchen).FirstAsync(h => h.HotelId == hotel.HotelId, cancellationToken);
        return new ApiResponse<AdminHotelDto>(true, await BuildHotelDto(reloaded, cancellationToken), null);
    }

    public async Task<ApiResponse<AdminHotelDto>> UpdateHotelAsync(long hotelId, UpsertHotelRequest request, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        var city = await db.Cities.AsNoTracking().FirstOrDefaultAsync(c => c.CityId == request.CityId, cancellationToken);
        if (city is null)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("CITY_NOT_FOUND", "City not found."));
        }

        var kitchen = await db.Kitchens.AsNoTracking().FirstOrDefaultAsync(k => k.KitchenId == request.KitchenId, cancellationToken);
        if (kitchen is null)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("KITCHEN_NOT_FOUND", "Kitchen not found."));
        }

        if (kitchen.CityId != request.CityId)
        {
            return new ApiResponse<AdminHotelDto>(false, null, new ApiError("KITCHEN_CITY_MISMATCH", "Selected kitchen does not belong to selected city."));
        }

        hotel.CityId = request.CityId;
        hotel.KitchenId = request.KitchenId;
        hotel.Name = request.Name.Trim();
        hotel.AddressLine = string.IsNullOrWhiteSpace(request.AddressLine) ? null : request.AddressLine.Trim();
        hotel.RoomCount = Math.Max(0, request.RoomCount);
        hotel.IsActive = request.IsActive;
        hotel.UpdatedAtUtc = clock.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        var reloaded = await db.Hotels.AsNoTracking().Include(h => h.City).Include(h => h.Kitchen).FirstAsync(h => h.HotelId == hotelId, cancellationToken);
        return new ApiResponse<AdminHotelDto>(true, await BuildHotelDto(reloaded, cancellationToken), null);
    }

    public async Task<ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>> GetMenuAsync(CancellationToken cancellationToken = default)
    {
        var categories = await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(cancellationToken);
        var items = await db.Items.AsNoTracking().OrderBy(i => i.Name).ToListAsync(cancellationToken);

        var itemIds = items.Select(i => i.ItemId).ToList();
        var now = clock.UtcNow;
        var availabilityRows = itemIds.Count == 0
            ? new List<KitchenItemAvailability>()
            : await db.KitchenItemAvailability
                .AsNoTracking()
                .Where(a => itemIds.Contains(a.ItemId) && a.IsAvailable && (a.EffectiveToUtc == null || a.EffectiveToUtc >= now))
                .ToListAsync(cancellationToken);

        var byItem = availabilityRows
            .GroupBy(a => a.ItemId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<long>)g.Select(x => x.KitchenId).Distinct().ToList());

        var payload = categories.Select(category =>
        {
            var categoryItems = items
                .Where(item => item.CategoryId == category.CategoryId)
                .Select(item => new AdminMenuItemDto(
                    item.ItemId,
                    item.CategoryId,
                    item.Name,
                    item.Description,
                    item.BasePrice,
                    item.IsVeg,
                    item.IsActive,
                    null,
                    null,
                    null,
                    byItem.TryGetValue(item.ItemId, out var kitchenIds) ? kitchenIds : Array.Empty<long>()))
                .ToList();

            return new AdminMenuCategoryDto(
                category.CategoryId,
                category.Name,
                category.CategoryIcon,
                category.SortOrder,
                categoryItems);
        }).ToList();

        return new ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>(true, payload, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> CreateMenuItemAsync(CreateMenuItemRequest request, CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("NAME_REQUIRED", "Item name is required."));
        }

        if (request.Price < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVALID_PRICE", "Price must be non-negative."));
        }

        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.CategoryId == request.CategoryId, cancellationToken);
        if (category is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("CATEGORY_NOT_FOUND", "Category not found."));
        }

        var exists = await db.Items.AnyAsync(i => i.CategoryId == request.CategoryId && i.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("ITEM_EXISTS", "Item already exists in selected category."));
        }

        var now = clock.UtcNow;
        var item = new Item
        {
            ItemCode = BuildCode("ITM", name, now),
            CategoryId = request.CategoryId,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            BasePrice = request.Price,
            IsVeg = request.IsVeg,
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        var allKitchenIds = await db.Kitchens.AsNoTracking().Where(k => k.IsActive).Select(k => k.KitchenId).ToListAsync(cancellationToken);
        var selectedKitchenIds = (request.AvailableKitchenIds ?? Array.Empty<long>())
            .Distinct()
            .Where(id => allKitchenIds.Contains(id))
            .ToList();

        if (selectedKitchenIds.Count == 0)
        {
            selectedKitchenIds = allKitchenIds;
        }

        if (selectedKitchenIds.Count > 0)
        {
            var rows = selectedKitchenIds.Select(kitchenId => new KitchenItemAvailability
            {
                KitchenId = kitchenId,
                ItemId = item.ItemId,
                IsAvailable = true,
                EffectivePrice = null,
                EffectiveFromUtc = now,
                EffectiveToUtc = null,
                UpdatedBy = "admin",
                UpdatedAtUtc = now
            });

            db.KitchenItemAvailability.AddRange(rows);
            await db.SaveChangesAsync(cancellationToken);
        }

        var dto = new AdminMenuItemDto(
            item.ItemId,
            item.CategoryId,
            item.Name,
            item.Description,
            item.BasePrice,
            item.IsVeg,
            item.IsActive,
            request.PrepTimeMinutes,
            string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            null,
            selectedKitchenIds);

        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> UpdateMenuItemStatusAsync(long itemId, UpdateMenuItemStatusRequest request, CancellationToken cancellationToken = default)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.ItemId == itemId, cancellationToken);
        if (item is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("ITEM_NOT_FOUND", "Menu item not found."));
        }

        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var now = clock.UtcNow;
        var kitchenIds = await db.KitchenItemAvailability
            .AsNoTracking()
            .Where(a => a.ItemId == itemId && a.IsAvailable && (a.EffectiveToUtc == null || a.EffectiveToUtc >= now))
            .Select(a => a.KitchenId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var dto = new AdminMenuItemDto(
            item.ItemId,
            item.CategoryId,
            item.Name,
            item.Description,
            item.BasePrice,
            item.IsVeg,
            item.IsActive,
            null,
            null,
            null,
            kitchenIds);

        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminMenuCategoryDto>> CreateCategoryAsync(UpsertCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_NAME_REQUIRED", "Category name is required."));
        }

        if (request.SortOrder <= 0)
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_SORT_INVALID", "Sort order must be greater than zero."));
        }

        var exists = await db.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_EXISTS", "Category already exists."));
        }

        var now = clock.UtcNow;
        var category = new Category
        {
            CategoryCode = BuildCode("CAT", name, now),
            Name = name,
            SortOrder = request.SortOrder,
            CategoryIcon = string.IsNullOrWhiteSpace(request.CategoryIcon) ? null : request.CategoryIcon.Trim(),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);

        return new ApiResponse<AdminMenuCategoryDto>(true, new AdminMenuCategoryDto(category.CategoryId, category.Name, category.CategoryIcon, category.SortOrder, Array.Empty<AdminMenuItemDto>()), null);
    }

    public async Task<ApiResponse<AdminMenuCategoryDto>> UpdateCategoryAsync(long categoryId, UpsertCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken);
        if (category is null)
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_NOT_FOUND", "Category not found."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_NAME_REQUIRED", "Category name is required."));
        }

        if (request.SortOrder <= 0)
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_SORT_INVALID", "Sort order must be greater than zero."));
        }

        var exists = await db.Categories.AnyAsync(c => c.CategoryId != categoryId && c.Name.ToLower() == name.ToLower(), cancellationToken);
        if (exists)
        {
            return new ApiResponse<AdminMenuCategoryDto>(false, null, new ApiError("CATEGORY_EXISTS", "Category already exists."));
        }

        category.Name = name;
        category.SortOrder = request.SortOrder;
        category.CategoryIcon = string.IsNullOrWhiteSpace(request.CategoryIcon) ? null : request.CategoryIcon.Trim();
        category.IsActive = request.IsActive;
        category.UpdatedAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new ApiResponse<AdminMenuCategoryDto>(true, new AdminMenuCategoryDto(category.CategoryId, category.Name, category.CategoryIcon, category.SortOrder, Array.Empty<AdminMenuItemDto>()), null);
    }

    public async Task<ApiResponse<bool>> DeleteCategoryAsync(long categoryId, CancellationToken cancellationToken = default)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken);
        if (category is null)
        {
            return new ApiResponse<bool>(false, false, new ApiError("CATEGORY_NOT_FOUND", "Category not found."));
        }

        var isInUse = await db.Items.AnyAsync(i => i.CategoryId == categoryId, cancellationToken);
        if (isInUse)
        {
            return new ApiResponse<bool>(false, false, new ApiError("CATEGORY_IN_USE", "Category has menu items and cannot be deleted."));
        }

        db.Categories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);
        return new ApiResponse<bool>(true, true, null);
    }

    public async Task<ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>> GetHotelMenuAsync(long hotelId, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        var payload = await BuildHotelMenuPayloadAsync(hotel, cancellationToken);
        return new ApiResponse<IReadOnlyList<AdminMenuCategoryDto>>(true, payload, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> CreateHotelMenuItemAsync(long hotelId, UpsertHotelMenuItemRequest request, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        if (request.InventoryQuantity < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVENTORY_INVALID", "Inventory must be non-negative."));
        }

        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.CategoryId == request.CategoryId, cancellationToken);
        if (category is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("CATEGORY_NOT_FOUND", "Category not found."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("NAME_REQUIRED", "Item name is required."));
        }

        if (request.Price < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVALID_PRICE", "Price must be non-negative."));
        }

        var now = clock.UtcNow;
        var item = await db.Items.FirstOrDefaultAsync(i => i.CategoryId == request.CategoryId && i.Name.ToLower() == name.ToLower(), cancellationToken);
        if (item is null)
        {
            item = new Item
            {
                ItemCode = BuildCode("ITM", name, now),
                CategoryId = request.CategoryId,
                Name = name,
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
                BasePrice = request.Price,
                IsVeg = request.IsVeg,
                IsActive = request.IsActive,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            db.Items.Add(item);
            await db.SaveChangesAsync(cancellationToken);
        }
        else
        {
            item.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            item.BasePrice = request.Price;
            item.IsVeg = request.IsVeg;
            item.IsActive = request.IsActive;
            item.UpdatedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
        }

        var hotelMenuItem = await db.HotelMenuItems.FirstOrDefaultAsync(x => x.HotelId == hotelId && x.ItemId == item.ItemId, cancellationToken);
        if (hotelMenuItem is null)
        {
            hotelMenuItem = new HotelMenuItem
            {
                HotelId = hotelId,
                ItemId = item.ItemId,
                IsActive = request.IsActive,
                InventoryQuantity = request.InventoryQuantity,
                PrepTimeMinutes = request.PrepTimeMinutes,
                ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            db.HotelMenuItems.Add(hotelMenuItem);
        }
        else
        {
            hotelMenuItem.IsActive = request.IsActive;
            hotelMenuItem.InventoryQuantity = request.InventoryQuantity;
            hotelMenuItem.PrepTimeMinutes = request.PrepTimeMinutes;
            hotelMenuItem.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
            hotelMenuItem.UpdatedAtUtc = now;
        }

        await UpsertKitchenAvailabilityForHotelItemAsync(hotel.KitchenId, item.ItemId, now, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var dto = await BuildHotelMenuItemDtoAsync(hotel.KitchenId, hotelMenuItem, item, cancellationToken);
        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuItemAsync(long hotelId, long itemId, UpsertHotelMenuItemRequest request, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        var hotelMenuItem = await db.HotelMenuItems.FirstOrDefaultAsync(x => x.HotelId == hotelId && x.ItemId == itemId, cancellationToken);
        if (hotelMenuItem is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_MENU_ITEM_NOT_FOUND", "Hotel menu item not found."));
        }

        var item = await db.Items.FirstOrDefaultAsync(i => i.ItemId == itemId, cancellationToken);
        if (item is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("ITEM_NOT_FOUND", "Menu item not found."));
        }

        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.CategoryId == request.CategoryId, cancellationToken);
        if (category is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("CATEGORY_NOT_FOUND", "Category not found."));
        }

        if (request.InventoryQuantity < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVENTORY_INVALID", "Inventory must be non-negative."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("NAME_REQUIRED", "Item name is required."));
        }

        if (request.Price < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVALID_PRICE", "Price must be non-negative."));
        }

        item.CategoryId = request.CategoryId;
        item.Name = name;
        item.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        item.BasePrice = request.Price;
        item.IsVeg = request.IsVeg;
        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = clock.UtcNow;

        hotelMenuItem.IsActive = request.IsActive;
        hotelMenuItem.InventoryQuantity = request.InventoryQuantity;
        hotelMenuItem.PrepTimeMinutes = request.PrepTimeMinutes;
        hotelMenuItem.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        hotelMenuItem.UpdatedAtUtc = clock.UtcNow;

        await UpsertKitchenAvailabilityForHotelItemAsync(hotel.KitchenId, item.ItemId, clock.UtcNow, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var dto = await BuildHotelMenuItemDtoAsync(hotel.KitchenId, hotelMenuItem, item, cancellationToken);
        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuItemStatusAsync(long hotelId, long itemId, UpdateHotelMenuItemStatusRequest request, CancellationToken cancellationToken = default)
    {
        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        var hotelMenuItem = await db.HotelMenuItems.FirstOrDefaultAsync(x => x.HotelId == hotelId && x.ItemId == itemId, cancellationToken);
        if (hotelMenuItem is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_MENU_ITEM_NOT_FOUND", "Hotel menu item not found."));
        }

        var item = await db.Items.AsNoTracking().FirstOrDefaultAsync(i => i.ItemId == itemId, cancellationToken);
        if (item is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("ITEM_NOT_FOUND", "Menu item not found."));
        }

        hotelMenuItem.IsActive = request.IsActive;
        hotelMenuItem.UpdatedAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var dto = await BuildHotelMenuItemDtoAsync(hotel.KitchenId, hotelMenuItem, item, cancellationToken);
        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<AdminMenuItemDto>> UpdateHotelMenuInventoryAsync(long hotelId, long itemId, UpdateHotelMenuInventoryRequest request, CancellationToken cancellationToken = default)
    {
        if (request.InventoryQuantity < 0)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("INVENTORY_INVALID", "Inventory must be non-negative."));
        }

        var hotel = await db.Hotels.AsNoTracking().FirstOrDefaultAsync(h => h.HotelId == hotelId, cancellationToken);
        if (hotel is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_NOT_FOUND", "Hotel not found."));
        }

        var hotelMenuItem = await db.HotelMenuItems.FirstOrDefaultAsync(x => x.HotelId == hotelId && x.ItemId == itemId, cancellationToken);
        if (hotelMenuItem is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("HOTEL_MENU_ITEM_NOT_FOUND", "Hotel menu item not found."));
        }

        var item = await db.Items.AsNoTracking().FirstOrDefaultAsync(i => i.ItemId == itemId, cancellationToken);
        if (item is null)
        {
            return new ApiResponse<AdminMenuItemDto>(false, null, new ApiError("ITEM_NOT_FOUND", "Menu item not found."));
        }

        hotelMenuItem.InventoryQuantity = request.InventoryQuantity;
        hotelMenuItem.UpdatedAtUtc = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var dto = await BuildHotelMenuItemDtoAsync(hotel.KitchenId, hotelMenuItem, item, cancellationToken);
        return new ApiResponse<AdminMenuItemDto>(true, dto, null);
    }

    public async Task<ApiResponse<bool>> DeleteHotelMenuItemAsync(long hotelId, long itemId, CancellationToken cancellationToken = default)
    {
        var hotelMenuItem = await db.HotelMenuItems.FirstOrDefaultAsync(x => x.HotelId == hotelId && x.ItemId == itemId, cancellationToken);
        if (hotelMenuItem is null)
        {
            return new ApiResponse<bool>(false, false, new ApiError("HOTEL_MENU_ITEM_NOT_FOUND", "Hotel menu item not found."));
        }

        db.HotelMenuItems.Remove(hotelMenuItem);
        await db.SaveChangesAsync(cancellationToken);
        return new ApiResponse<bool>(true, true, null);
    }

    private async Task<IReadOnlyList<AdminMenuCategoryDto>> BuildHotelMenuPayloadAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        var categories = await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var menuItems = await db.HotelMenuItems
            .AsNoTracking()
            .Include(x => x.Item)
            .ThenInclude(x => x.Category)
            .Where(x => x.HotelId == hotel.HotelId)
            .OrderBy(x => x.Item.Category.SortOrder)
            .ThenBy(x => x.Item.Name)
            .ToListAsync(cancellationToken);

        var availableItemIds = await db.KitchenItemAvailability
            .AsNoTracking()
            .Where(x => x.KitchenId == hotel.KitchenId && x.IsAvailable && (x.EffectiveToUtc == null || x.EffectiveToUtc >= clock.UtcNow))
            .Select(x => x.ItemId)
            .ToListAsync(cancellationToken);

        var availableItemIdSet = availableItemIds.ToHashSet();
        var itemsByCategory = menuItems
            .GroupBy(x => x.Item.CategoryId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(menuItem => new AdminMenuItemDto(
                    menuItem.ItemId,
                    menuItem.Item.CategoryId,
                    menuItem.Item.Name,
                    menuItem.Item.Description,
                    menuItem.Item.BasePrice,
                    menuItem.Item.IsVeg,
                    menuItem.Item.IsActive && menuItem.IsActive,
                    menuItem.PrepTimeMinutes,
                    menuItem.ImageUrl,
                    menuItem.InventoryQuantity,
                    menuItem.IsActive && menuItem.Item.IsActive && availableItemIdSet.Contains(menuItem.ItemId)
                        ? new[] { hotel.KitchenId }
                        : Array.Empty<long>()))
                .ToList() as IReadOnlyList<AdminMenuItemDto>);

        return categories
            .Select(category => new AdminMenuCategoryDto(
                category.CategoryId,
                category.Name,
                category.CategoryIcon,
                category.SortOrder,
                itemsByCategory.TryGetValue(category.CategoryId, out var items)
                    ? items
                    : Array.Empty<AdminMenuItemDto>()))
            .ToList();
    }

    private async Task<AdminMenuItemDto> BuildHotelMenuItemDtoAsync(long kitchenId, HotelMenuItem hotelMenuItem, Item item, CancellationToken cancellationToken)
    {
        var isAvailable = await db.KitchenItemAvailability
            .AsNoTracking()
            .AnyAsync(x => x.KitchenId == kitchenId && x.ItemId == item.ItemId && x.IsAvailable && (x.EffectiveToUtc == null || x.EffectiveToUtc >= clock.UtcNow), cancellationToken);

        return new AdminMenuItemDto(
            item.ItemId,
            item.CategoryId,
            item.Name,
            item.Description,
            item.BasePrice,
            item.IsVeg,
            item.IsActive && hotelMenuItem.IsActive,
            hotelMenuItem.PrepTimeMinutes,
            hotelMenuItem.ImageUrl,
            hotelMenuItem.InventoryQuantity,
            item.IsActive && hotelMenuItem.IsActive && isAvailable ? new[] { kitchenId } : Array.Empty<long>());
    }

    private async Task UpsertKitchenAvailabilityForHotelItemAsync(long kitchenId, long itemId, DateTime now, CancellationToken cancellationToken)
    {
        var availability = await db.KitchenItemAvailability.FirstOrDefaultAsync(x => x.KitchenId == kitchenId && x.ItemId == itemId, cancellationToken);
        if (availability is not null)
        {
            return;
        }

        db.KitchenItemAvailability.Add(new KitchenItemAvailability
        {
            KitchenId = kitchenId,
            ItemId = itemId,
            IsAvailable = true,
            EffectivePrice = null,
            EffectiveFromUtc = now,
            EffectiveToUtc = null,
            UpdatedBy = "admin",
            UpdatedAtUtc = now
        });
    }
    private async Task<ApiError?> ValidateKitchenCredentialsAsync(UpsertKitchenRequest request, long? existingKitchenId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LoginUsername))
        {
            return new ApiError("LOGIN_USERNAME_REQUIRED", "Kitchen login username is required.");
        }

        var normalizedUsername = request.LoginUsername.Trim().ToLowerInvariant();
        if (normalizedUsername.Length < 4)
        {
            return new ApiError("LOGIN_USERNAME_INVALID", "Kitchen login username must be at least 4 characters.");
        }

        var duplicateUsernameExists = await db.Kitchens.AnyAsync(
            k => k.LoginUsername == normalizedUsername && (!existingKitchenId.HasValue || k.KitchenId != existingKitchenId.Value),
            cancellationToken);

        if (duplicateUsernameExists)
        {
            return new ApiError("LOGIN_USERNAME_EXISTS", "Kitchen login username already exists.");
        }

        if (!existingKitchenId.HasValue && string.IsNullOrWhiteSpace(request.LoginPassword))
        {
            return new ApiError("LOGIN_PASSWORD_REQUIRED", "Kitchen login password is required.");
        }

        return null;
    }
    private async Task<AdminKitchenDto> BuildKitchenDto(Kitchen kitchen, CancellationToken cancellationToken)
    {
        var hotelsCount = await db.Hotels.CountAsync(h => h.KitchenId == kitchen.KitchenId, cancellationToken);
        var ordersCount = await db.Orders.CountAsync(o => o.KitchenId == kitchen.KitchenId, cancellationToken);
        var revenue = await db.Orders.Where(o => o.KitchenId == kitchen.KitchenId).SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        return new AdminKitchenDto(
            kitchen.KitchenId,
            kitchen.CityId,
            kitchen.City.Name,
            kitchen.KitchenCode,
            kitchen.Name,
            kitchen.AddressLine,
            kitchen.ContactPhone,
            kitchen.ManagerName,
            kitchen.LoginUsername,
            !string.IsNullOrWhiteSpace(kitchen.PasswordHash),
            kitchen.IsActive,
            hotelsCount,
            ordersCount,
            revenue);
    }

    private async Task<AdminHotelDto> BuildHotelDto(Hotel hotel, CancellationToken cancellationToken)
    {
        var ordersCount = await db.Orders.CountAsync(o => o.HotelId == hotel.HotelId, cancellationToken);
        var revenue = await db.Orders.Where(o => o.HotelId == hotel.HotelId).SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        return new AdminHotelDto(
            hotel.HotelId,
            hotel.CityId,
            hotel.City.Name,
            hotel.KitchenId,
            hotel.Kitchen.Name,
            hotel.HotelCode,
            hotel.Name,
            hotel.AddressLine,
            hotel.RoomCount,
            hotel.IsActive,
            ordersCount,
            revenue,
            BuildKitchenQrCodeUrl(hotel.Kitchen.KitchenCode));
    }

    private string BuildKitchenQrCodeUrl(string kitchenCode)
    {
        var guestBaseUrl = (configuration["AppUrls:GuestBaseUrl"] ?? "http://localhost:4200").TrimEnd('/');
        var routeUrl = $"{guestBaseUrl}/guest/{kitchenCode}";
        var data = Uri.EscapeDataString(routeUrl);
        return $"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={data}";
    }

    private static string BuildCode(string prefix, string source, DateTime utcNow)
    {
        var clean = new string(source.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        const int maxTotalLength = 16;
        const int timeLength = 6;
        const int separatorsLength = 2;
        var maxCleanLength = Math.Max(1, maxTotalLength - prefix.Length - separatorsLength - timeLength);
        if (clean.Length > maxCleanLength)
        {
            clean = clean[..maxCleanLength];
        }

        return $"{prefix}-{clean}-{utcNow:HHmmss}";
    }
}

