using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HotelRoomOrdering.Api.Data;

public sealed class OrderingDbContextFactory : IDesignTimeDbContextFactory<OrderingDbContext>
{
    public OrderingDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<OrderingDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=hotel_room_ordering;Username=postgres;Password=postgres");
        return new OrderingDbContext(optionsBuilder.Options);
    }
}


