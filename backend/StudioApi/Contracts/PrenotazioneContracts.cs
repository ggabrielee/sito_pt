using System.ComponentModel.DataAnnotations;
using StudioApi.Models;

namespace StudioApi.Contracts;

/// <summary>
/// DTO in ingresso: è il JSON inviato dal form del sito.
/// Separato dall'entità per non esporre campi interni (Id, Stato, CreataIl).
/// </summary>
public record CreaPrenotazioneRequest
{
    [Required(ErrorMessage = "Il nome è obbligatorio.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Il nome deve avere tra 2 e 100 caratteri.")]
    public string Nome { get; init; } = string.Empty;

    [Required(ErrorMessage = "Il telefono è obbligatorio.")]
    [RegularExpression(@"^\s*\+?[\d\s]{7,20}\s*$", ErrorMessage = "Numero di telefono non valido.")]
    public string Telefono { get; init; } = string.Empty;
}

/// <summary>Body del PATCH che cambia lo stato: { "stato": "Richiamato" }.</summary>
public record CambiaStatoRequest(string? Stato);

public record PrenotazioneResponse(
    int Id,
    string Nome,
    string Telefono,
    string Stato,
    DateTime CreataIl)
{
    public static PrenotazioneResponse FromEntity(Prenotazione p) =>
        new(p.Id, p.Nome, p.Telefono, p.Stato.ToString(), p.CreataIl);
}
