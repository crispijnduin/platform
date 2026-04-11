using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Infrastructure.Migrations;

namespace Platform.Migrations;

public class ContentMigratie : MigrationBase
{
    private readonly IContentService _contentService;
    private readonly IContentTypeService _contentTypeService;

    public ContentMigratie(
        IMigrationContext context,
        IContentService contentService,
        IContentTypeService contentTypeService) : base(context)
    {
        _contentService = contentService;
        _contentTypeService = contentTypeService;
    }

    protected override void Migrate()
    {
        VoegPartituurToolToe();
    }

    private void VoegPartituurToolToe()
    {
        var contentType = _contentTypeService.Get("toolsOverzicht");
        if (contentType == null) return;

        var toolsOverzicht = _contentService
            .GetPagedOfType(contentType.Id, 0, 1, out _, null)
            .FirstOrDefault();
        if (toolsOverzicht == null) return;

        // Voorkom duplicaat
        var toolPaginaType = _contentTypeService.Get("toolPagina");
        if (toolPaginaType != null)
        {
            var bestaand = _contentService
                .GetPagedOfType(toolPaginaType.Id, 0, 500, out _, null)
                .FirstOrDefault(x => x.GetValue<string>("toolUrl") == "/partituur/");
            if (bestaand != null) return;
        }

        var tool = _contentService.Create("Partituur", toolsOverzicht.Id, "toolPagina");
        tool.SetValue("beschrijving", "Sleeptegelsbord met ritme-modus en whiteboard voor muziekonderwijs");
        tool.SetValue("categorie", "Muziek");
        tool.SetValue("emoji", "🎵");
        tool.SetValue("toolUrl", "/partituur/");
        tool.SetValue("isPremium", false);

        _contentService.SaveAndPublish(tool);
    }
}
