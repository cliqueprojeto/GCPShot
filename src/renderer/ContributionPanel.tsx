import { useState } from 'react'
import type { AppLanguage } from '../shared/i18n'
import { t } from '../shared/i18n'
import qrPix from './assets/qr-pix.png'
import qrStripe from './assets/qr-stripe.png'

export const GCP_SITE_URL = 'https://gestaoculturalpro.com.br/'
export const PIX_KEY =
  '00020126850014br.gov.bcb.pix0136e474b71b-7491-4eac-992f-632652e5a4eb0223DEV GESTAO CULTURAL PRO5204000053039865802BR5915BRUNO ALBERTINI6006BRASIL62200516ChromeExtensions63042B27'
export const STRIPE_DONATE_URL = 'https://donate.stripe.com/fZu4gzeBSfhbd7451F6Ri00'

type ContributionPanelProps = {
  language: AppLanguage
}

export function ContributionPanel({ language }: ContributionPanelProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  async function copyPixKey(): Promise<void> {
    try {
      await navigator.clipboard.writeText(PIX_KEY)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside className="contribution-card" aria-label={t(language, 'contributeTitle')}>
      <span className="contribution-badge">{t(language, 'contributeBadge')}</span>
      <h3>{t(language, 'contributeTitle')}</h3>
      <p className="contribution-lead">{t(language, 'contributeLead')}</p>
      <p className="contribution-note">{t(language, 'contributeNote')}</p>

      <section className="contribution-block">
        <h4>{t(language, 'contributePixTitle')}</h4>
        <p className="contribution-label">{t(language, 'contributePixKey')}</p>
        <div className="contribution-row">
          <div className="contribution-field-wrap">
            <input className="contribution-field" readOnly value={PIX_KEY} aria-label={t(language, 'contributePixKey')} />
            <button type="button" className="contribution-copy" onClick={() => void copyPixKey()} title={t(language, 'contributeCopy')}>
              {copied ? '✓' : '⧉'}
            </button>
          </div>
          <figure className="contribution-qr">
            <img src={qrPix} alt={t(language, 'contributePixScan')} />
            <figcaption>{t(language, 'contributePixScan')}</figcaption>
          </figure>
        </div>
        {copied && <p className="contribution-copied">{t(language, 'contributeCopied')}</p>}
      </section>

      <section className="contribution-block">
        <h4>{t(language, 'contributeStripeTitle')}</h4>
        <p className="contribution-label">{t(language, 'contributeStripeLink')}</p>
        <div className="contribution-row">
          <div className="contribution-stripe-copy">
            <button
              type="button"
              className="contribution-stripe-button"
              onClick={() => window.open(STRIPE_DONATE_URL, '_blank', 'noopener,noreferrer')}
            >
              {t(language, 'contributeStripeButton')}
            </button>
            <p className="contribution-stripe-hint">{t(language, 'contributeStripeHint')}</p>
            <a className="contribution-link" href={STRIPE_DONATE_URL} target="_blank" rel="noreferrer">
              {STRIPE_DONATE_URL}
            </a>
          </div>
          <figure className="contribution-qr">
            <img src={qrStripe} alt={t(language, 'contributePixScan')} />
            <figcaption>{t(language, 'contributePixScan')}</figcaption>
          </figure>
        </div>
      </section>

      <p className="contribution-footer">{t(language, 'contributeFooter')}</p>
    </aside>
  )
}
