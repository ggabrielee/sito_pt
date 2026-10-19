using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using StudioApi.Contracts;
using StudioApi.Data;
using StudioApi.Models;
using StudioApi.Security;

namespace StudioApi.Endpoints;

public static class PrenotazioniEndpoints
{
    public static RouteGroupBuilder MapPrenotazioniEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/prenotazioni");

        // Pubblico: usato dal form del sito
        group.MapPost("/", CreaPrenotazione);

        // Area di gestione: espone dati personali, quindi richiede la chiave admin
        var admin = group.MapGroup("")
                         .AddEndpointFilter<AdminKeyFilter>();

        // Elenco dalla più recente, filtrabile per stato (?stato=DaRichiamare)
        admin.MapGet("/", ElencoPrenotazioni);

        // Segna come richiamato o rimetti da richiamare
        admin.MapPatch("/{id:int}/stato", CambiaStato);

        return group;
    }

    /// <summary>POST /api/prenotazioni — body: { "nome": "...", "telefono": "..." }</summary>
    private static async Task<Results<Created<PrenotazioneResponse>, ValidationProblem>> CreaPrenotazione(
        CreaPrenotazioneRequest request,
        StudioDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        // Validazione lato server: non ci si fida mai del client
        var risultati = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), risultati, validateAllProperties: true))
        {
            var errori = risultati
                .SelectMany(r => r.MemberNames.DefaultIfEmpty(string.Empty), (r, membro) => (membro, r.ErrorMessage ?? "Valore non valido."))
                .GroupBy(x => x.membro, x => x.Item2)
                .ToDictionary(g => g.Key, g => g.ToArray());
            return TypedResults.ValidationProblem(errori);
        }

        var prenotazione = new Prenotazione
        {
            Nome = request.Nome.Trim(),
            Telefono = new string(request.Telefono.Where(c => !char.IsWhiteSpace(c)).ToArray()),
            CreataIl = clock.GetUtcNow().UtcDateTime
        };

        db.Prenotazioni.Add(prenotazione);
        await db.SaveChangesAsync(ct);

        return TypedResults.Created((string?)null, PrenotazioneResponse.FromEntity(prenotazione));
    }

    private static async Task<Results<Ok<List<PrenotazioneResponse>>, ValidationProblem>> ElencoPrenotazioni(
        string? stato,
        StudioDbContext db,
        CancellationToken ct)
    {
        var query = db.Prenotazioni.AsNoTracking();

        if (!string.IsNullOrEmpty(stato))
        {
            if (!TryParseStato(stato, out var filtro))
                return TypedResults.ValidationProblem(ErroreStato(stato));
            query = query.Where(p => p.Stato == filtro);
        }

        var elenco = await query
            .OrderByDescending(p => p.CreataIl)
            .Select(p => PrenotazioneResponse.FromEntity(p))
            .ToListAsync(ct);

        return TypedResults.Ok(elenco);
    }

    /// <summary>PATCH /api/prenotazioni/{id}/stato — body: { "stato": "Richiamato" }</summary>
    private static async Task<Results<Ok<PrenotazioneResponse>, NotFound, ValidationProblem>> CambiaStato(
        int id,
        CambiaStatoRequest request,
        StudioDbContext db,
        CancellationToken ct)
    {
        if (!TryParseStato(request.Stato, out var nuovoStato))
            return TypedResults.ValidationProblem(ErroreStato(request.Stato));

        var prenotazione = await db.Prenotazioni.FindAsync([id], ct);
        if (prenotazione is null)
            return TypedResults.NotFound();

        prenotazione.Stato = nuovoStato;
        await db.SaveChangesAsync(ct);

        return TypedResults.Ok(PrenotazioneResponse.FromEntity(prenotazione));
    }

    /// <summary>Accetta solo i nomi esatti dell'enum, non i numeri ("7").</summary>
    private static bool TryParseStato(string? valore, out StatoPrenotazione stato) =>
        Enum.TryParse(valore, ignoreCase: true, out stato)
        && Enum.IsDefined(stato)
        && !int.TryParse(valore, out _);

    private static Dictionary<string, string[]> ErroreStato(string? valore) => new()
    {
        ["Stato"] = [$"Stato '{valore}' non valido. Valori ammessi: {string.Join(", ", Enum.GetNames<StatoPrenotazione>())}."]
    };
}
