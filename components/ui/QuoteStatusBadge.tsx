const STATUS_CONFIG = {
  DRAFT:    { label: 'Brouillon',  cls: 'badge-gray'  },
  SENT:     { label: 'Envoyé',     cls: 'badge-blue'  },
  ACCEPTED: { label: 'Accepté',   cls: 'badge-green' },
  DECLINED: { label: 'Refusé',    cls: 'badge-red'   },
  EXPIRED:  { label: 'Expiré',    cls: 'badge-amber' },
} as const

type Status = keyof typeof STATUS_CONFIG

export default function QuoteStatusBadge({ status }: { status: Status }) {
  const { label, cls } = STATUS_CONFIG[status] ?? { label: status, cls: 'badge-gray' }
  return <span className={cls}>{label}</span>
}
