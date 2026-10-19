namespace StudioApi.Models;

/// <summary>
/// Richiesta di sessione di prova lasciata dal form del sito:
/// il trainer richiama il cliente entro 24 ore.
/// </summary>
public class Prenotazione
{
    public int Id { get; set; }

    public required string Nome { get; set; }

    /// <summary>Salvato senza spazi, es. "+393331234567".</summary>
    public required string Telefono { get; set; }

    public StatoPrenotazione Stato { get; set; } = StatoPrenotazione.DaRichiamare;

    /// <summary>Timestamp di ricezione, sempre in UTC.</summary>
    public DateTime CreataIl { get; set; }
}

public enum StatoPrenotazione
{
    DaRichiamare,
    Richiamato
}
