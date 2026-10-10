import {
  Accessibility,
  Building2,
  CircleAlert,
  Droplets,
  Lightbulb,
  Shield,
  ShieldAlert,
  Trash2,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from './types'

export const categoryIcon: Record<CategoryId, LucideIcon> = {
  infrastructure: Wrench,
  lighting: Lightbulb,
  water: Droplets,
  cleanliness: Trash2,
  safety: Shield,
  harassment: ShieldAlert,
  classroom: Building2,
  internet: Wifi,
  accessibility: Accessibility,
  other: CircleAlert,
}
