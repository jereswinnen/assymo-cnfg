const nl: Record<string, string> = {
  // App
  'app.title': 'Assymo Configurator',
  'app.description': 'Interactieve 3D configurator met prijsberekening',
  'app.reset': 'Opnieuw instellen',

  // Building types
  'buildingType.overkapping': 'Overkapping',
  'buildingType.berging': 'Berging',
  'buildingType.paal': 'Paal',
  'buildingType.muur': 'Muur',
  'buildingType.overkapping.desc': 'Open carport met palen',
  'buildingType.berging.desc': 'Gesloten berging met wanden',

  // Roof types
  'roofType.label': 'Daktype',
  'roofType.flat': 'Platdak',
  'roofType.pitched': 'Zadeldak',

  // Roof coverings
  'roofCovering.dakpannen': 'Dakpannen',
  'roofCovering.riet': 'Riet',
  'roofCovering.epdm': 'EPDM',
  'roofCovering.polycarbonaat': 'Polycarbonaat',
  'roofCovering.metaal': 'Staalplaten',

  // Trim colors
  'trimColor.antraciet': 'Antraciet',
  'trimColor.wit': 'Wit',
  'trimColor.zwart': 'Zwart',
  'trimColor.bruin': 'Bruin',
  'trimColor.groen': 'Groen',

  // Accordion sections
  'section.1': 'Gebouwen',
  'section.2': 'Afmetingen',
  'section.3': 'Dakbedekking',
  'section.4': 'Wanden',
  'section.5': 'Vloerbedekking',
  'section.6': 'Offerte',

  // Dimensions
  'dim.width': 'Lengte',
  'dim.depth': 'Breedte',
  'dim.height': 'Hoogte',
  'dim.roofPitch': 'Dakhelling',
  'dim.orientation': 'Oriëntatie',
  'dim.orientation.horizontal': 'Horizontaal',
  'dim.orientation.vertical': 'Verticaal',
  'dim.height.default': 'Standaard',
  'dim.height.override': 'Aangepast',
  'dim.height.reset': 'Reset naar standaard',

  // Walls
  'wall.front': 'Voorkant',
  'wall.back': 'Achterkant',
  'wall.left': 'Linkerkant',
  'wall.right': 'Rechterkant',
  'wall.select': 'Selecteer een wand om te configureren',
  'wall.clickToSelect': 'Klik op een wand in het 3D-model of selecteer hieronder',

  // Wall materials
  'material.wood': 'Hout',
  'material.brick': 'Steen',
  'material.render': 'Stucwerk',
  'material.metal': 'Metaal',
  'material.glass': 'Glas',

  // Wall cladding variants
  'material.vurenvert': 'Vuren planchetten (V)',
  'material.bevelhorz': 'Bevel siding (H)',
  'material.zwartsmal': 'Zwart smal (V)',
  'material.bruinvert': 'Bruin (V)',
  'material.zwartvuren': 'Zwart vuren (V)',
  'material.planchhorz': 'Planchet (H)',
  'material.naaldhout3': 'Naaldhout 3-var',

  // Roof coverings
  'material.dakpannen': 'Dakpannen',
  'material.riet': 'Riet',
  'material.epdm': 'EPDM',
  'material.polycarbonaat': 'Polycarbonaat',
  'material.metaal': 'Staalplaten',

  // Floor materials
  'material.geen': 'Geen',
  'material.tegels': 'Tegels',
  'material.beton': 'Beton',
  'material.hout': 'Hout (vlonders)',

  // Door materials
  'material.aluminium': 'Aluminium',
  'material.pvc': 'PVC',
  'material.staal': 'Staal',

  // Surface properties
  'surface.material': 'Materiaal',
  'surface.door': 'Deur',
  'surface.doorMaterial': 'Materiaal',
  'surface.doorSize': 'Formaat',
  'surface.doorSize.enkel': 'Enkel',
  'surface.doorSize.dubbel': 'Dubbel',
  'surface.doorHasWindow': 'Met raam',
  'surface.doorPosition': 'Positie',
  'surface.doorPosition.links': 'Links',
  'surface.doorPosition.midden': 'Midden',
  'surface.doorPosition.rechts': 'Rechts',
  'surface.doorSwing': 'Deur stand',
  'surface.doorSwing.dicht': 'Dicht',
  'surface.doorSwing.naar_binnen': 'Naar binnen',
  'surface.doorSwing.naar_buiten': 'Naar buiten',
  'surface.doorMirror': 'Spiegelen',
  'surface.windows': 'Ramen',
  'surface.windowCount': 'Aantal',
  'surface.skylight': 'Dakraam',
  'surface.properties': 'Eigenschappen',

  // Roof config
  'roof.covering': 'Dakbedekking',
  'roof.trimColor': 'Dakbakafwerking',
  'roof.insulation': 'Dakisolatie',
  'roof.thickness': 'Dikte',
  'roof.skylight': 'Dakraam',

  // Structure
  'structure.cornerBraces': 'Schoren',
  'structure.resetPoles': 'Auto-layout palen',
  'structure.cornerBraces.desc': 'Hoekschoren voor extra stabiliteit',

  // Quote
  'quote.title': 'Offerte overzicht',
  'quote.total': 'Totaal',
  'quote.posts': 'Staanders ({count}\u00D7)',
  'quote.braces': 'Schoren ({count}\u00D7)',
  'quote.pole': 'Paal',
  'quote.wall': 'Muur',
  'quote.roof': 'Dak',

  // Floor
  'floor.label': 'Vloer',
  'floor.material': 'Vloerbedekking',

  // Walls section
  'walls.disabled': 'Overkapping heeft geen wanden',
  'walls.disabled.muur': 'Configureer de wand hieronder',

  // Building manager
  'building.add.berging': 'Gebouw toevoegen',
  'building.add.overkapping': 'Overkapping toevoegen',
  'building.add.paal': 'Paal toevoegen',
  'building.add.muur': 'Muur toevoegen',
  'building.delete': 'Verwijderen',
  'building.name.berging': 'Gebouw',
  'building.name.overkapping': 'Overkapping',
  'building.name.paal': 'Paal',
  'building.name.muur': 'Muur',
  'connection.open': 'Open doorgang',
  'connection.closed': 'Gesloten',

  // Schematic
  'view.floorplan': 'Plattegrond',
  'view.elevation': 'Muurweergave',
  'view.backToFloorplan': 'Terug naar plattegrond',
  'schematic.title': 'Plattegrond',
  'schematic.width': 'Breedte',
  'schematic.depth': 'Diepte',
  'export.button': 'Exporteren',

  // Sidebar
  'sidebar.tab.objects': 'Objecten',
  'sidebar.tab.configure': 'Configureren',
  'sidebar.catalog.dragHint': 'Sleep naar canvas',
  'sidebar.catalog.switchTo2D': 'Schakel naar 2D om toe te voegen',
  'sidebar.placed': 'Geplaatst',
  'sidebar.emptyState': 'Selecteer een object om te configureren',
  'sidebar.section.dimensions': 'Afmetingen',
  'sidebar.section.material': 'Materiaal',
  'sidebar.section.structure': 'Structuur',
  'material.primary': 'Hoofdmateriaal',
  'material.primary.help': 'Wandfaces, deuren, palen en dakbakafwerking gebruiken dit materiaal tenzij apart ingesteld.',
  'material.inherit': 'Volgt hoofdmateriaal',
  'material.override': 'Eigen materiaal',
  'sidebar.section.walls': 'Wanden & Openingen',
  'sidebar.section.quote': 'Offerte',
  'sidebar.connections': 'Verbindingen',

  // Config code
  'code.title': 'Configuratiecode',
  'code.currentLabel': 'Uw configuratiecode',
  'code.copy': 'Kopieer',
  'code.copied': 'Gekopieerd!',
  'code.loadTitle': 'Code laden',
  'code.loadPlaceholder': 'Voer code in...',
  'code.load': 'Laden',
  'code.invalidCode': 'Ongeldige code',

  // Admin shell
  'admin.title': 'Beheer',
  'admin.signIn.title': 'Inloggen bij beheer',
  'admin.signIn.email': 'E-mailadres',
  'admin.signIn.submit': 'Stuur inloglink',
  'admin.signIn.sent': 'Check je inbox voor de inloglink.',
  'admin.signIn.error': 'Er ging iets mis. Probeer het opnieuw.',
  'admin.signOut': 'Uitloggen',
  'admin.nav.dashboard': 'Overzicht',
  'admin.nav.tenants': 'Tenants',
  'admin.nav.users': 'Gebruikers',
  'admin.nav.tenant': 'Mijn tenant',
  'admin.dashboard.greeting': 'Welkom, {name}',
  'admin.dashboard.tenant': 'Tenant: {tenant}',
  'admin.dashboard.role': 'Rol: {role}',

  // Admin — tenants
  'admin.tenants.title': 'Tenants',
  'admin.tenants.create': 'Nieuwe tenant',
  'admin.tenants.empty': 'Nog geen tenants.',
  'admin.tenants.col.id': 'ID',
  'admin.tenants.col.displayName': 'Naam',
  'admin.tenants.col.locale': 'Taal',
  'admin.tenants.col.currency': 'Valuta',
  'admin.tenants.create.title': 'Nieuwe tenant aanmaken',
  'admin.tenants.create.id': 'ID (slug)',
  'admin.tenants.create.displayName': 'Weergavenaam',
  'admin.tenants.create.submit': 'Aanmaken',
  'admin.tenants.create.error': 'Aanmaken mislukt: {error}',

  // Admin — single tenant detail
  'admin.tenant.section.details': 'Details',
  'admin.tenant.section.hosts': 'Hosts',
  'admin.tenant.section.branding': 'Branding',
  'admin.tenant.section.priceBook': 'Prijsboek',
  'admin.tenant.hosts.add': 'Host toevoegen',
  'admin.tenant.hosts.placeholder': 'partner.configurator.be',
  'admin.tenant.hosts.empty': 'Nog geen hosts gekoppeld.',
  'admin.tenant.hosts.delete': 'Verwijderen',
  'admin.tenant.branding.displayName': 'Weergavenaam',
  'admin.tenant.branding.logoUrl': 'Logo-URL',
  'admin.tenant.branding.primaryColor': 'Hoofdkleur',
  'admin.tenant.branding.accentColor': 'Accentkleur',
  'admin.tenant.branding.footer.contactEmail': 'Contact e-mail',
  'admin.tenant.branding.footer.address': 'Adres',
  'admin.tenant.branding.footer.vatNumber': 'BTW-nummer',
  'admin.tenant.save': 'Opslaan',
  'admin.tenant.saved': 'Opgeslagen',
  'admin.tenant.saveError': 'Opslaan mislukt: {error}',

  // Admin — users
  'admin.users.title': 'Gebruikers',
  'admin.users.invite': 'Gebruiker uitnodigen',
  'admin.users.empty': 'Nog geen gebruikers.',
  'admin.users.col.email': 'E-mail',
  'admin.users.col.name': 'Naam',
  'admin.users.col.role': 'Rol',
  'admin.users.col.tenant': 'Tenant',
  'admin.users.invite.title': 'Gebruiker uitnodigen',
  'admin.users.invite.email': 'E-mail',
  'admin.users.invite.name': 'Naam',
  'admin.users.invite.role': 'Rol',
  'admin.users.invite.tenant': 'Tenant',
  'admin.users.invite.submit': 'Uitnodigen',
  'admin.users.invite.success': 'Uitnodiging verstuurd naar {email}.',

  // Admin — common
  'admin.role.super_admin': 'Super admin',
  'admin.role.tenant_admin': 'Tenant admin',
  'admin.error.generic': 'Er ging iets mis.',
  'admin.error.forbidden': 'Geen toegang.',
};

export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = nl[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
