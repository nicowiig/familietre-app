export function LoadingSpinner({ size = 'md', text, fullPage }) {
  const cls = size === 'lg' ? 'spinner spinner-lg' : 'spinner'

  if (fullPage) {
    return (
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className={cls} />
        {text && <span className="text-muted">{text}</span>}
      </div>
    )
  }

  if (text) {
    return (
      <div className="loading-center">
        <div className={cls} />
        <span className="text-muted">{text}</span>
      </div>
    )
  }

  return <div className={cls} />
}
