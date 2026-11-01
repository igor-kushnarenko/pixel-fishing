export const FISH_TYPES = [
  { name: 'Карась', color: '#d2aa99', size: 0.8, rarity: 45, points: 10, biteWindow: 0.9 },
  { name: 'Окунь', color: '#6daa2c', size: 1, rarity: 28, points: 20, biteWindow: 0.75 },
  { name: 'Форель', color: '#6dc2ca', size: 1.2, rarity: 16, points: 40, biteWindow: 0.6 },
  { name: 'Щука', color: '#346524', size: 1.5, rarity: 8, points: 80, biteWindow: 0.5 },
  { name: 'Золотая рыбка', color: '#dad45e', size: 0.9, rarity: 3, points: 200, biteWindow: 0.4 }
];
export const DAY_LENGTH = 180;
export const NIGHT_WEIGHTS = [20, 24, 28, 18, 10];

export function chooseFish(isNight, random = Math.random) {
  const weights = isNight ? NIGHT_WEIGHTS : FISH_TYPES.map(fish => fish.rarity);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, fish] of FISH_TYPES.entries()) {
    roll -= weights[index];
    if (roll < 0) return fish;
  }
  return FISH_TYPES.at(-1);
}

export function daylightAt(time) {
  return (Math.sin(time / DAY_LENGTH * Math.PI * 2) + 1) / 2;
}
