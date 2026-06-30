import citiesData from './cities.json';

export function getGlobalVilles(paysCode?: string): { nom: string; region: string }[] {
  const data = citiesData as { name: string; state_name: string; country_code: string }[];
  if (!paysCode) {
    return data.map((c) => ({ nom: c.name, region: c.state_name }));
  }
  return data.filter((c) => c.country_code === paysCode).map((c) => ({ nom: c.name, region: c.state_name }));
}
