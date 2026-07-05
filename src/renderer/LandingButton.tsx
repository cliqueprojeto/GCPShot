type LandingButtonProps = {
  label: string
  shortcut?: string
  onClick: () => void
  variant?: 'primary' | 'ghost'
  className?: string
}

export function LandingButton({
  label,
  shortcut,
  onClick,
  variant = 'ghost',
  className = ''
}: LandingButtonProps): JSX.Element {
  const baseClass = variant === 'primary' ? 'primary-button landing-action' : 'ghost-button large landing-action'

  return (
    <button type="button" className={`${baseClass} ${className}`.trim()} onClick={onClick}>
      <span className="landing-action-label">{label}</span>
      {shortcut ? <span className="landing-action-shortcut">{shortcut}</span> : null}
    </button>
  )
}
