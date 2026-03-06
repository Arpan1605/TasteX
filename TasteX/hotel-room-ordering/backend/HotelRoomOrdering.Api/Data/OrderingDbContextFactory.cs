using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HotelRoomOrdering.Api.Data;

public sealed class OrderingDbContextFactory : IDesignTimeDbContextFactory<OrderingDbContext>
{
    public OrderingDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<OrderingDbContext>();
        optionsBuilder.UseSqlServer("Server=localhost;Database=HotelRoomOrdering;Trusted_Connection=True;TrustServerCertificate=True;");
        return new OrderingDbContext(optionsBuilder.Options);
    }
}
