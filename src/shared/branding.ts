export const DEVELOPER_CREDIT = 'Desenvolvido: Por Bruno Albertini'
export const ORGANIZATION_NAME = 'Gestão Cultural Pro'
export const GCP_SITE_URL = 'https://gestaoculturalpro.com.br/'

export function isProjectSiteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      ['gestaoculturalpro.com.br', 'www.gestaoculturalpro.com.br'].includes(url.hostname)
  } catch { return false }
}
