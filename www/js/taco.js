// www/js/taco.js
// Base Nutricional TACO (Valores por 100g) + Motor de Substituicoes Equivalentes

export const TACO_DB = [
  // CEREAIS, PAES E TUBERCULOS
  { id: 't1', name: 'Arroz branco cozido', cat: 'Carboidratos', kcal: 128, ptn: 2.5, cho: 28.1, lip: 0.2, fib: 1.6, medida: '1 colher de servir (45g)', pesoMedida: 45 },
  { id: 't2', name: 'Arroz integral cozido', cat: 'Carboidratos', kcal: 124, ptn: 2.6, cho: 25.8, lip: 1.0, fib: 2.7, medida: '1 colher de servir (45g)', pesoMedida: 45 },
  { id: 't3', name: 'Batata doce cozida', cat: 'Carboidratos', kcal: 77, ptn: 0.6, cho: 18.4, lip: 0.1, fib: 2.2, medida: '1 fatia media (70g)', pesoMedida: 70 },
  { id: 't4', name: 'Batata inglesa cozida', cat: 'Carboidratos', kcal: 52, ptn: 1.2, cho: 11.9, lip: 0.0, fib: 1.3, medida: '1 unidade media (100g)', pesoMedida: 100 },
  { id: 't5', name: 'Mandioca (Aipim) cozida', cat: 'Carboidratos', kcal: 125, ptn: 0.6, cho: 30.1, lip: 0.3, fib: 1.6, medida: '1 pedaco medio (80g)', pesoMedida: 80 },
  { id: 't6', name: 'Inhame cozido', cat: 'Carboidratos', kcal: 97, ptn: 2.1, cho: 23.2, lip: 0.1, fib: 1.7, medida: '1 pedaco medio (80g)', pesoMedida: 80 },
  { id: 't7', name: 'Aveia em flocos', cat: 'Carboidratos', kcal: 394, ptn: 13.9, cho: 66.6, lip: 8.5, fib: 9.1, medida: '2 colheres de sopa (30g)', pesoMedida: 30 },
  { id: 't8', name: 'Pao frances', cat: 'Carboidratos', kcal: 300, ptn: 8.0, cho: 58.6, lip: 3.1, fib: 2.3, medida: '1 unidade (50g)', pesoMedida: 50 },
  { id: 't9', name: 'Pao de forma integral', cat: 'Carboidratos', kcal: 253, ptn: 9.4, cho: 49.9, lip: 3.7, fib: 6.9, medida: '2 fatias (50g)', pesoMedida: 50 },
  { id: 't10', name: 'Goma de tapioca hidratada', cat: 'Carboidratos', kcal: 240, ptn: 0.0, cho: 60.0, lip: 0.0, fib: 0.0, medida: '3 colheres de sopa (60g)', pesoMedida: 60 },
  { id: 't11', name: 'Cuscuz de milho cozido', cat: 'Carboidratos', kcal: 113, ptn: 2.2, cho: 25.3, lip: 0.7, fib: 2.1, medida: '1 fatia media (100g)', pesoMedida: 100 },
  { id: 't12', name: 'Macarrao cozido', cat: 'Carboidratos', kcal: 158, ptn: 5.8, cho: 30.9, lip: 0.9, fib: 1.8, medida: '1 pegador (100g)', pesoMedida: 100 },

  // LEGUMINOSAS
  { id: 't13', name: 'Feijao carioca cozido', cat: 'Leguminosas', kcal: 76, ptn: 4.8, cho: 13.6, lip: 0.5, fib: 8.5, medida: '1 concha media (86g)', pesoMedida: 86 },
  { id: 't14', name: 'Feijao preto cozido', cat: 'Leguminosas', kcal: 77, ptn: 4.5, cho: 14.0, lip: 0.5, fib: 8.4, medida: '1 concha media (86g)', pesoMedida: 86 },
  { id: 't15', name: 'Lentilha cozida', cat: 'Leguminosas', kcal: 93, ptn: 6.3, cho: 16.3, lip: 0.5, fib: 7.9, medida: '1 concha media (80g)', pesoMedida: 80 },
  { id: 't16', name: 'Grao de bico cozido', cat: 'Leguminosas', kcal: 164, ptn: 8.9, cho: 27.4, lip: 2.6, fib: 7.6, medida: '3 colheres de sopa (75g)', pesoMedida: 75 },

  // PROTEINAS (CARNES, AVES, PEIXES, OVOS)
  { id: 't17', name: 'Peito de frango grelhado', cat: 'Proteinas', kcal: 159, ptn: 32.0, cho: 0.0, lip: 2.5, fib: 0.0, medida: '1 file medio (120g)', pesoMedida: 120 },
  { id: 't18', name: 'Patinho bovino grelhado/moido', cat: 'Proteinas', kcal: 219, ptn: 35.9, cho: 0.0, lip: 7.3, fib: 0.0, medida: '1 bife medio (100g)', pesoMedida: 100 },
  { id: 't19', name: 'Alcatra bovina grelhada', cat: 'Proteinas', kcal: 241, ptn: 31.9, cho: 0.0, lip: 11.6, fib: 0.0, medida: '1 bife medio (100g)', pesoMedida: 100 },
  { id: 't20', name: 'File de tilapia grelhado', cat: 'Proteinas', kcal: 128, ptn: 26.2, cho: 0.0, lip: 2.7, fib: 0.0, medida: '1 file medio (120g)', pesoMedida: 120 },
  { id: 't21', name: 'Salmao grelhado', cat: 'Proteinas', kcal: 243, ptn: 26.1, cho: 0.0, lip: 14.5, fib: 0.0, medida: '1 posta media (100g)', pesoMedida: 100 },
  { id: 't22', name: 'Atum em agua (lata drenado)', cat: 'Proteinas', kcal: 116, ptn: 25.5, cho: 0.0, lip: 0.8, fib: 0.0, medida: '1 lata drenada (120g)', pesoMedida: 120 },
  { id: 't23', name: 'Ovo de galinha cozido/mexido', cat: 'Proteinas', kcal: 146, ptn: 13.3, cho: 0.6, lip: 9.5, fib: 0.0, medida: '2 unidades (100g)', pesoMedida: 100 },
  { id: 't24', name: 'Clara de ovo cozida', cat: 'Proteinas', kcal: 52, ptn: 10.9, cho: 0.7, lip: 0.2, fib: 0.0, medida: '3 claras (100g)', pesoMedida: 100 },
  { id: 't25', name: 'Lombo suino assado', cat: 'Proteinas', kcal: 210, ptn: 35.7, cho: 0.0, lip: 6.4, fib: 0.0, medida: '1 fatia media (100g)', pesoMedida: 100 },
  { id: 't26', name: 'Tofu firme', cat: 'Proteinas', kcal: 76, ptn: 8.1, cho: 1.9, lip: 4.8, fib: 0.3, medida: '2 fatias (100g)', pesoMedida: 100 },

  // LATICINIOS E SUPLEMENTOS
  { id: 't27', name: 'Iogurte natural desnatado', cat: 'Laticinios', kcal: 41, ptn: 3.8, cho: 5.8, lip: 0.3, fib: 0.0, medida: '1 pote (170g)', pesoMedida: 170 },
  { id: 't28', name: 'Iogurte natural integral', cat: 'Laticinios', kcal: 51, ptn: 4.1, cho: 1.9, lip: 3.0, fib: 0.0, medida: '1 pote (170g)', pesoMedida: 170 },
  { id: 't29', name: 'Leite desnatado', cat: 'Laticinios', kcal: 35, ptn: 3.4, cho: 5.0, lip: 0.2, fib: 0.0, medida: '1 copo (200ml)', pesoMedida: 200 },
  { id: 't30', name: 'Queijo minas frescal', cat: 'Laticinios', kcal: 264, ptn: 17.4, cho: 3.2, lip: 20.2, fib: 0.0, medida: '1 fatia media (30g)', pesoMedida: 30 },
  { id: 't31', name: 'Queijo cottage', cat: 'Laticinios', kcal: 98, ptn: 11.1, cho: 3.4, lip: 4.3, fib: 0.0, medida: '2 colheres de sopa (50g)', pesoMedida: 50 },
  { id: 't32', name: 'Requeijao cremoso light', cat: 'Laticinios', kcal: 180, ptn: 10.0, cho: 3.5, lip: 14.0, fib: 0.0, medida: '1 colher de sopa (30g)', pesoMedida: 30 },
  { id: 't33', name: 'Whey Protein Concentrado (80%)', cat: 'Proteinas', kcal: 400, ptn: 80.0, cho: 8.0, lip: 5.0, fib: 0.0, medida: '1 scoop (30g)', pesoMedida: 30 },

  // FRUTAS
  { id: 't34', name: 'Banana prata', cat: 'Frutas', kcal: 98, ptn: 1.3, cho: 26.0, lip: 0.1, fib: 2.0, medida: '1 unidade media (70g)', pesoMedida: 70 },
  { id: 't35', name: 'Maca fuji com casca', cat: 'Frutas', kcal: 56, ptn: 0.3, cho: 15.2, lip: 0.0, fib: 1.3, medida: '1 unidade media (130g)', pesoMedida: 130 },
  { id: 't36', name: 'Mamao papaia', cat: 'Frutas', kcal: 40, ptn: 0.5, cho: 10.4, lip: 0.1, fib: 1.0, medida: '1/2 unidade (150g)', pesoMedida: 150 },
  { id: 't37', name: 'Morango cru', cat: 'Frutas', kcal: 30, ptn: 0.9, cho: 6.8, lip: 0.3, fib: 1.7, medida: '10 unidades (120g)', pesoMedida: 120 },
  { id: 't38', name: 'Melao cru', cat: 'Frutas', kcal: 29, ptn: 0.7, cho: 7.5, lip: 0.0, fib: 0.3, medida: '1 fatia grande (150g)', pesoMedida: 150 },
  { id: 't39', name: 'Abacaxi perola', cat: 'Frutas', kcal: 48, ptn: 0.9, cho: 12.3, lip: 0.1, fib: 1.0, medida: '2 fatias (150g)', pesoMedida: 150 },
  { id: 't40', name: 'Laranja pera', cat: 'Frutas', kcal: 37, ptn: 1.0, cho: 8.9, lip: 0.1, fib: 0.8, medida: '1 unidade media (140g)', pesoMedida: 140 },
  { id: 't41', name: 'Uva rubi', cat: 'Frutas', kcal: 49, ptn: 0.6, cho: 12.7, lip: 0.2, fib: 0.9, medida: '1 cacho pequeno (100g)', pesoMedida: 100 },
  { id: 't42', name: 'Abacate cru', cat: 'Gorduras', kcal: 96, ptn: 1.2, cho: 6.0, lip: 8.4, fib: 6.3, medida: '2 colheres de sopa (60g)', pesoMedida: 60 },

  // GORDURAS E OLEAGINOSAS
  { id: 't43', name: 'Azeite de oliva extra virgem', cat: 'Gorduras', kcal: 884, ptn: 0.0, cho: 0.0, lip: 100.0, fib: 0.0, medida: '1 colher de sopa (10g)', pesoMedida: 10 },
  { id: 't44', name: 'Pasta de amendoim integral', cat: 'Gorduras', kcal: 588, ptn: 25.0, cho: 20.0, lip: 50.0, fib: 6.0, medida: '1 colher de sopa (15g)', pesoMedida: 15 },
  { id: 't45', name: 'Castanha do Para', cat: 'Gorduras', kcal: 643, ptn: 14.5, cho: 15.1, lip: 63.5, fib: 7.9, medida: '2 unidades (10g)', pesoMedida: 10 },
  { id: 't46', name: 'Castanha de caju torrada', cat: 'Gorduras', kcal: 570, ptn: 18.5, cho: 29.1, lip: 46.3, fib: 3.7, medida: '10 unidades (20g)', pesoMedida: 20 },
  { id: 't47', name: 'Semente de chia', cat: 'Gorduras', kcal: 486, ptn: 16.5, cho: 42.1, lip: 30.7, fib: 34.4, medida: '1 colher de sopa (15g)', pesoMedida: 15 },

  // VERDURAS E LEGUMES
  { id: 't48', name: 'Brocolis cozido', cat: 'Vegetais', kcal: 25, ptn: 2.1, cho: 4.4, lip: 0.5, fib: 3.4, medida: '3 floretes (80g)', pesoMedida: 80 },
  { id: 't49', name: 'Alface crespa crua', cat: 'Vegetais', kcal: 11, ptn: 1.3, cho: 1.7, lip: 0.2, fib: 1.8, medida: '1 prato sobremesa (50g)', pesoMedida: 50 },
  { id: 't50', name: 'Tomate cru', cat: 'Vegetais', kcal: 15, ptn: 1.1, cho: 3.1, lip: 0.2, fib: 1.2, medida: '4 fatias (80g)', pesoMedida: 80 },
  { id: 't51', name: 'Cenoura cozida', cat: 'Vegetais', kcal: 30, ptn: 0.8, cho: 6.7, lip: 0.2, fib: 2.6, medida: '3 colheres de sopa (75g)', pesoMedida: 75 },
  { id: 't52', name: 'Abobrinha italiana cozida', cat: 'Vegetais', kcal: 15, ptn: 1.1, cho: 3.0, lip: 0.2, fib: 1.6, medida: '3 colheres de sopa (80g)', pesoMedida: 80 },
  { id: 't53', name: 'Couve manteiga refogada', cat: 'Vegetais', kcal: 90, ptn: 1.7, cho: 8.7, lip: 6.6, fib: 5.7, medida: '2 colheres de sopa (50g)', pesoMedida: 50 }
];

export function calcMacros(food, grams) {
  const f = (Number(grams) || 0) / 100;
  return {
    kcal: Math.round(food.kcal * f),
    ptn: +(food.ptn * f).toFixed(1),
    cho: +(food.cho * f).toFixed(1),
    lip: +(food.lip * f).toFixed(1),
    fib: +((food.fib || 0) * f).toFixed(1)
  };
}

// Gera ate 3 substitutos equivalentes na mesma categoria ajustando automaticamente a gramagem pelas calorias
export function getSubstitutes(foodId, grams) {
  const base = TACO_DB.find(f => f.id === foodId);
  if (!base || base.kcal <= 0) return [];
  const targetKcal = (base.kcal * grams) / 100;
  return TACO_DB
    .filter(f => f.cat === base.cat && f.id !== base.id && f.kcal > 0)
    .slice(0, 3)
    .map(sub => {
      const eqGrams = Math.max(5, Math.round((targetKcal / sub.kcal) * 100));
      return `${sub.name} (${eqGrams}g)`;
    });
}
