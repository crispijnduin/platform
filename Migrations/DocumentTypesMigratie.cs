using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Migrations;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Migrations.Upgrade;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Notifications;
using Microsoft.Extensions.Logging;

namespace Platform.Migrations;

// ── Notification handler: wordt aangeroepen bij Umbraco startup ──
public class PlatformMigratieHandler : INotificationHandler<UmbracoApplicationStartedNotification>
{
    private readonly IMigrationPlanExecutor _migrationPlanExecutor;
    private readonly ICoreScopeProvider _coreScopeProvider;
    private readonly KeyValueService _keyValueService;
    private readonly ILogger<PlatformMigratieHandler> _logger;

    public PlatformMigratieHandler(
        IMigrationPlanExecutor migrationPlanExecutor,
        ICoreScopeProvider coreScopeProvider,
        KeyValueService keyValueService,
        ILogger<PlatformMigratieHandler> logger)
    {
        _migrationPlanExecutor = migrationPlanExecutor;
        _coreScopeProvider = coreScopeProvider;
        _keyValueService = keyValueService;
        _logger = logger;
    }

    public void Handle(UmbracoApplicationStartedNotification notification)
    {
        var plan = new MigrationPlan("PlatformDocumentTypes");
        plan.From(string.Empty).To<DocumentTypesMigratie>("v1.0.0");

        var upgrader = new Upgrader(plan);
        upgrader.Execute(_migrationPlanExecutor, _coreScopeProvider, _keyValueService);
        _logger.LogInformation("Platform Document Types migratie uitgevoerd.");
    }
}

// ── De daadwerkelijke migratie ────────────────────────────────────
public class DocumentTypesMigratie : MigrationBase
{
    private readonly IContentTypeService _contentTypeService;
    private readonly IDataTypeService _dataTypeService;
    private readonly IFileService _fileService;

    public DocumentTypesMigratie(
        IMigrationContext context,
        IContentTypeService contentTypeService,
        IDataTypeService dataTypeService,
        IFileService fileService) : base(context)
    {
        _contentTypeService = contentTypeService;
        _dataTypeService = dataTypeService;
        _fileService = fileService;
    }

    protected override void Migrate()
    {
        MaakHomePageAan();
        MaakToolsOverzichtAan();
        MaakToolPaginaAan();
        StelAllowedChildrenIn();
    }

    // ── Hulpfunctie: datatype ophalen op naam ─────────────────────
    private IDataType? HaalDataTypeOp(string naam)
        => _dataTypeService.GetAll().FirstOrDefault(x => x.Name == naam);

    // ── Hulpfunctie: property aanmaken ────────────────────────────
    private PropertyType MaakProperty(string naam, string alias, string dataTypeNaam, string beschrijving = "")
    {
        var dataType = HaalDataTypeOp(dataTypeNaam)
            ?? throw new Exception($"DataType '{dataTypeNaam}' niet gevonden.");

        return new PropertyType(ShortStringHelper, dataType)
        {
            Name        = naam,
            Alias       = alias,
            Description = beschrijving,
            Mandatory   = false,
        };
    }

    // ── HomePage ──────────────────────────────────────────────────
    private void MaakHomePageAan()
    {
        if (_contentTypeService.Get("homePage") != null) return;

        var template = _fileService.GetTemplate("HomePage");
        var ct = new ContentType(ShortStringHelper, -1)
        {
            Name        = "HomePage",
            Alias       = "homePage",
            Icon        = "icon-home",
            AllowedAsRoot = true,
            Description = "De homepage van het platform",
        };

        if (template != null)
            ct.SetDefaultTemplate(template);

        // Property group "Content"
        var groep = new PropertyGroup(new PropertyTypeCollection(false)) { Name = "Content", SortOrder = 0 };
        groep.PropertyTypes!.Add(MaakProperty("Introtekst",        "introTekst",       "Textarea",   "Korte tekst onder de hero-kop"));
        groep.PropertyTypes!.Add(MaakProperty("SEO titel",         "seoTitel",         "Textstring", "Paginatitel voor zoekmachines"));
        groep.PropertyTypes!.Add(MaakProperty("SEO omschrijving",  "seoOmschrijving",  "Textarea",   "Omschrijving voor zoekmachines"));
        ct.PropertyGroups.Add(groep);

        _contentTypeService.Save(ct);
    }

    // ── ToolsOverzicht ────────────────────────────────────────────
    private void MaakToolsOverzichtAan()
    {
        if (_contentTypeService.Get("toolsOverzicht") != null) return;

        var template = _fileService.GetTemplate("ToolsOverzicht");
        var ct = new ContentType(ShortStringHelper, -1)
        {
            Name        = "ToolsOverzicht",
            Alias       = "toolsOverzicht",
            Icon        = "icon-grid",
            AllowedAsRoot = false,
            Description = "Overzichtspagina van alle tools",
        };

        if (template != null)
            ct.SetDefaultTemplate(template);

        _contentTypeService.Save(ct);
    }

    // ── ToolPagina ────────────────────────────────────────────────
    private void MaakToolPaginaAan()
    {
        if (_contentTypeService.Get("toolPagina") != null) return;

        var template = _fileService.GetTemplate("ToolPagina");
        var ct = new ContentType(ShortStringHelper, -1)
        {
            Name        = "ToolPagina",
            Alias       = "toolPagina",
            Icon        = "icon-tool",
            AllowedAsRoot = false,
            Description = "Een individuele interactieve tool",
        };

        if (template != null)
            ct.SetDefaultTemplate(template);

        // Property group "Tool"
        var groep = new PropertyGroup(new PropertyTypeCollection(false)) { Name = "Tool", SortOrder = 0 };
        groep.PropertyTypes!.Add(MaakProperty("Beschrijving", "beschrijving", "Textarea",    "Korte omschrijving van de tool"));
        groep.PropertyTypes!.Add(MaakProperty("Categorie",    "categorie",    "Textstring",  "Bijv: Muziek, Rekenen, Taal"));
        groep.PropertyTypes!.Add(MaakProperty("Emoji",        "emoji",        "Textstring",  "Één emoji als icoon, bijv: 🎵"));
        groep.PropertyTypes!.Add(MaakProperty("Tool URL",     "toolUrl",      "Textstring",  "Pad naar de tool, bijv: /tools/tileboard/index.html"));
        groep.PropertyTypes!.Add(MaakProperty("Is Premium",   "isPremium",    "True/false",  "Vinkje = premium, leeg = gratis"));
        ct.PropertyGroups.Add(groep);

        _contentTypeService.Save(ct);
    }

    // ── Allowed children instellen ────────────────────────────────
    private void StelAllowedChildrenIn()
    {
        var homePage        = _contentTypeService.Get("homePage");
        var toolsOverzicht  = _contentTypeService.Get("toolsOverzicht");
        var toolPagina      = _contentTypeService.Get("toolPagina");

        if (homePage == null || toolsOverzicht == null || toolPagina == null) return;

        // HomePage mag ToolsOverzicht als kind hebben
        if (!homePage.AllowedContentTypes!.Any(x => x.Alias == "toolsOverzicht"))
        {
            var allowed = homePage.AllowedContentTypes!.ToList();
            allowed.Add(new ContentTypeSort(toolsOverzicht.Key, allowed.Count, toolsOverzicht.Alias));
            homePage.AllowedContentTypes = allowed;
            _contentTypeService.Save(homePage);
        }

        // ToolsOverzicht mag ToolPagina als kind hebben
        if (!toolsOverzicht.AllowedContentTypes!.Any(x => x.Alias == "toolPagina"))
        {
            var allowed = toolsOverzicht.AllowedContentTypes!.ToList();
            allowed.Add(new ContentTypeSort(toolPagina.Key, allowed.Count, toolPagina.Alias));
            toolsOverzicht.AllowedContentTypes = allowed;
            _contentTypeService.Save(toolsOverzicht);
        }
    }
}
