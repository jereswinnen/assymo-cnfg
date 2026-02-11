const nl: Record<string, string> = {
  // App
  'app.title': 'Assymo Configurator',
  'app.description': 'Interactieve 3D configurator met prijsberekening',
  'app.reset': 'Opnieuw instellen',

  // Building types
  'buildingType.overkapping': 'Overkapping',
  'buildingType.berging': 'Berging',
  'buildingType.combined': 'Gecombineerd',
  'buildingType.overkapping.desc': 'Open carport met palen',
  'buildingType.berging.desc': 'Gesloten berging met wanden',
  'buildingType.combined.desc': 'Carport + berging onder één dak',

  // Roof types
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
  'section.1': 'Type gebouw',
  'section.2': 'Afmetingen',
  'section.3': 'Dakbedekking',
  'section.4': 'Wanden',
  'section.5': 'Offerte',

  // Dimensions
  'dim.width': 'Breedte',
  'dim.depth': 'Diepte',
  'dim.height': 'Hoogte',
  'dim.roofPitch': 'Dakhelling',
  'dim.bergingWidth': 'Breedte berging',

  // Walls
  'wall.front': 'Voorkant',
  'wall.back': 'Achterkant',
  'wall.left': 'Linkerkant',
  'wall.right': 'Rechterkant',
  'wall.divider': 'Tussenwand',
  'wall.select': 'Selecteer een wand om te configureren',
  'wall.clickToSelect': 'Klik op een wand in het 3D-model of selecteer hieronder',

  // Wall materials
  'material.wood': 'Hout',
  'material.brick': 'Steen',
  'material.render': 'Stucwerk',
  'material.metal': 'Metaal',

  // Finishes
  'finish.mat': 'Mat',
  'finish.satijn': 'Satijn',
  'finish.glans': 'Glans',

  // Surface properties
  'surface.material': 'Materiaal',
  'surface.finish': 'Afwerking',
  'surface.insulation': 'Isolatie',
  'surface.thickness': 'Dikte',
  'surface.door': 'Deur',
  'surface.windows': 'Ramen',
  'surface.windowCount': 'Aantal',
  'surface.skylight': 'Dakraam',
  'surface.properties': 'Eigenschappen',

  // Roof config
  'roof.covering': 'Dakbedekking',
  'roof.trimColor': 'Randafwerking',
  'roof.insulation': 'Dakisolatie',
  'roof.thickness': 'Dikte',
  'roof.skylight': 'Dakraam',

  // Quote
  'quote.title': 'Offerte overzicht',
  'quote.total': 'Totaal',
  'quote.posts': 'Staanders',
  'quote.roof': 'Dak',

  // Walls section
  'walls.disabled': 'Overkapping heeft geen wanden',
};

export function t(key: string): string {
  return nl[key] ?? key;
}
