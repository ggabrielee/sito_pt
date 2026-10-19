using Microsoft.EntityFrameworkCore;
using StudioApi.Models;

namespace StudioApi.Data;

public class StudioDbContext(DbContextOptions<StudioDbContext> options) : DbContext(options)
{
    public DbSet<Prenotazione> Prenotazioni => Set<Prenotazione>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Prenotazione>(entity =>
        {
            entity.ToTable("Prenotazioni");
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Nome).HasMaxLength(100).IsRequired();
            entity.Property(p => p.Telefono).HasMaxLength(20).IsRequired();

            // Salvato come testo ("DaRichiamare"): il database resta leggibile
            entity.Property(p => p.Stato)
                  .HasConversion<string>()
                  .HasMaxLength(20);

            // La gestione mostra le richieste dalla più recente
            entity.HasIndex(p => p.CreataIl);
        });
    }
}
