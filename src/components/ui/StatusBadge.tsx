import React from 'react'
import {
  Clock, CheckCircle2, XCircle, Banknote, FileText,
  AlertTriangle, Circle, MinusCircle, CalendarCheck,
} from 'lucide-react'

type Status =
  | 'pending' | 'approved' | 'rejected' | 'funded' | 'draft'
  | 'cancelled' | 'stale' | 'active' | 'inactive' | 'paid'
  | 'overdue' | 'upcoming' | 'completed' | 'waived'
  | 'open' | 'inprogress' | 'done' | 'on_hold'

const STATUS_MAP: Record<Status, { label: string; icon: React.ReactNode; css: string }> = {
  pending:    { label: 'Pending',      icon: <Clock size={10} />,        css: 'badge-pending'   },
  approved:   { label: 'Approved',     icon: <CheckCircle2 size={10} />, css: 'badge-approved'  },
  funded:     { label: 'Funded',       icon: <Banknote size={10} />,     css: 'badge-funded'    },
  rejected:   { label: 'Rejected',     icon: <XCircle size={10} />,      css: 'badge-rejected'  },
  stale:      { label: 'Stale',        icon: <MinusCircle size={10} />,  css: 'badge-stale'     },
  draft:      { label: 'Draft',        icon: <FileText size={10} />,     css: 'badge-draft'     },
  cancelled:  { label: 'Cancelled',    icon: <MinusCircle size={10} />,  css: 'badge-cancelled' },
  active:     { label: 'Active',       icon: <CheckCircle2 size={10} />, css: 'badge-active'    },
  inactive:   { label: 'Inactive',     icon: <Circle size={10} />,       css: 'badge-inactive'  },
  paid:       { label: 'Paid',         icon: <Banknote size={10} />,     css: 'badge-paid'      },
  overdue:    { label: 'Overdue',      icon: <AlertTriangle size={10} />,css: 'badge-overdue'   },
  upcoming:   { label: 'Upcoming',     icon: <Clock size={10} />,        css: 'badge-upcoming'  },
  completed:  { label: 'Completed',    icon: <CalendarCheck size={10} />,css: 'badge-completed' },
  waived:     { label: 'Waived',       icon: <MinusCircle size={10} />,  css: 'badge-stale'     },
  open:       { label: 'Open',         icon: <Circle size={10} />,       css: 'badge-pending'   },
  inprogress: { label: 'In Progress',  icon: <Clock size={10} />,        css: 'badge-info'      },
  done:       { label: 'Done',         icon: <CheckCircle2 size={10} />, css: 'badge-completed' },
  on_hold:    { label: 'On Hold',      icon: <MinusCircle size={10} />,  css: 'badge-stale'     },
}

interface StatusBadgeProps {
  status: string
  /** Override the displayed label */
  label?: string
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const key = status?.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') as Status
  const map = STATUS_MAP[key]
  if (!map) {
    return (
      <span className="badge badge-draft">
        {status}
      </span>
    )
  }
  return (
    <span className={`badge ${map.css}`}>
      {map.icon}
      {label ?? map.label}
    </span>
  )
}
