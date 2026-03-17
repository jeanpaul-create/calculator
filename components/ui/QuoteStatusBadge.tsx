const STATUS_CONFIG = {
  DRAFT:    { label: 'Entwurf',    cls: 'badge-gray'  },
  SENT:     { label: 'Versendet',  cls: 'badge-blue'  },
  ACCEPTED: { label: 'Angenommen', cls: 'badge-green' },
  DECLINED: { label: 'Abgelehnt', cls: 'badge-red'   },
  EXPIRED:  { label: 'Abgelaufen', cls: 'badge-amber' },
} as const

type Status = keyof typeof STATUS_CONFIG

export default function QuoteStatusBadge({ status }: { status: Status }) {
  const { label, cls } = STATUS_CONFIG[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={cls}>{label}</span>
}
