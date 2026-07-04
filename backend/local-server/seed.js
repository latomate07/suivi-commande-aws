export function createSeedProducts() {
  const rows = [
    ["PRD-001", "Casque audio sans fil", "Reduction de bruit active, autonomie 30h.", "Audio", 79.9, 24, "🎧"],
    ["PRD-002", "Clavier mecanique compact", "Switches rouges, retroeclairage RGB.", "Informatique", 64.5, 15, "⌨️"],
    ["PRD-003", "Souris ergonomique", "Capteur 16000 DPI, sans fil.", "Informatique", 39.9, 32, "🖱️"],
    ["PRD-004", "Enceinte bluetooth portable", "Etanche IPX7, 12h d'autonomie.", "Audio", 49.0, 18, "🔊"],
    ["PRD-005", "Ecran 27 pouces 4K", "Dalle IPS, 99% sRGB.", "Informatique", 289.0, 8, "🖥️"],
    ["PRD-006", "Webcam full HD", "1080p 60fps, micro integre.", "Informatique", 45.0, 21, "📷"],
    ["PRD-007", "Chargeur rapide USB-C 65W", "Charge deux appareils simultanement.", "Accessoires", 29.9, 40, "🔌"],
    ["PRD-008", "Sac a dos pour ordinateur", "Compartiment rembourre 15 pouces.", "Accessoires", 54.0, 12, "🎒"]
  ];

  return rows.reduce((accumulator, row) => {
    const [id, name, description, category, price, stock, icon] = row;
    accumulator[id] = {
      id,
      name,
      description,
      category,
      price,
      stock,
      icon,
      order: null
    };
    return accumulator;
  }, {});
}
