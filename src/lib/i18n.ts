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
  'quote.posts': 'Staanders',
  'quote.braces': 'Schoren',
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
};

export function t(key: string): string {
  return nl[key] ?? key;
}
