export interface CharacterDef {
  id: string;
  name: string;
  file: string;
  gender: 'male' | 'female';
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'm_farmer', name: 'Masala Chai', file: 'm_Worker.gltf', gender: 'male' },
  { id: 'm_worker', name: 'Worker', file: 'm_Worker.gltf', gender: 'male' },
  { id: 'm_hoodie', name: 'Casual', file: 'm_Casual_Hoodie.gltf', gender: 'male' },
  { id: 'f_casual', name: 'Casual', file: 'f_Casual.gltf', gender: 'female' },
  { id: 'f_worker', name: 'Worker', file: 'f_Worker.gltf', gender: 'female' },
  { id: 'f_adventurer', name: 'Adventurer', file: 'f_Adventurer.gltf', gender: 'female' },
];

export function getCharacter(id: string): CharacterDef | undefined {
  return CHARACTERS.find(c => c.id === id);
}

const STORAGE_KEY = 'robocode_character';

export function getSavedCharacterId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function saveCharacterId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, id);
}
