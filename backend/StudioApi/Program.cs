using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using StudioApi.Data;
using StudioApi.Endpoints;
using StudioApi.Security;

var builder = WebApplication.CreateBuilder(args);

// ---------- Servizi ----------

// EF Core + SQLite. La connection string è in appsettings.json.
builder.Services.AddDbContext<StudioDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Studio")));

builder.Services.AddSingleton(TimeProvider.System);

// Risposte d'errore standard RFC 9457 (application/problem+json)
builder.Services.AddProblemDetails();

// CORS: il frontend può girare su un'altra origine (es. Live Server su :5500)
const string FrontendCors = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCors, policy =>
        policy.WithOrigins(allowedOrigins)
              .WithMethods("GET", "POST", "PATCH")
              .WithHeaders("Content-Type", "Accept", AdminKeyFilter.HeaderName)));

var app = builder.Build();

// Crea il database (studio.db) o lo aggiorna all'ultima migrazione:
// basta `dotnet run`, senza passare da `dotnet ef database update`.
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<StudioDbContext>().Database.Migrate();
}

// ---------- Pipeline ----------

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    // Serve anche il frontend dalla stessa origine:
    // sito su http://localhost:5080, gestione su http://localhost:5080/admin.html
    var frontendPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "frontend"));
    if (Directory.Exists(frontendPath))
    {
        var files = new PhysicalFileProvider(frontendPath);
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
        app.UseStaticFiles(new StaticFileOptions { FileProvider = files });
    }
}

app.UseCors(FrontendCors);

app.MapPrenotazioniEndpoints();

app.Run();
