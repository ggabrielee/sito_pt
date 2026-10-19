using System.Security.Cryptography;
using System.Text;

namespace StudioApi.Security;

/// <summary>
/// Protegge gli endpoint di gestione con una chiave condivisa, inviata
/// nell'header <c>X-Admin-Key</c> e letta dalla configurazione "Admin:ApiKey".
/// Protezione volutamente semplice: in produzione andrebbe sostituita da
/// un'autenticazione vera (cookie + ASP.NET Core Identity, oppure JWT).
/// </summary>
public class AdminKeyFilter(IConfiguration configuration) : IEndpointFilter
{
    public const string HeaderName = "X-Admin-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var expected = configuration["Admin:ApiKey"];

        // Nessuna chiave configurata = area admin disattivata, mai aperta a tutti
        if (string.IsNullOrWhiteSpace(expected))
        {
            return TypedResults.Problem(
                title: "Area di gestione non configurata.",
                detail: "Imposta Admin:ApiKey nella configurazione del server.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        var provided = context.HttpContext.Request.Headers[HeaderName].ToString();

        // Confronto a tempo costante: non rivela quanti caratteri sono corretti
        var valid = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(provided),
            Encoding.UTF8.GetBytes(expected));

        if (!valid)
        {
            return TypedResults.Problem(
                title: "Chiave di accesso mancante o non valida.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        return await next(context);
    }
}
