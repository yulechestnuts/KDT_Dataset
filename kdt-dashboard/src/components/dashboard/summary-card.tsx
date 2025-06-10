import { Card } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons'

interface SummaryCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
}

export function SummaryCard({ title, value, change, trend }: SummaryCardProps) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold">{value}</p>
        <span className={`ml-2 flex items-baseline text-sm font-semibold ${
          trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          {trend === 'up' ? (
            <ArrowUpIcon className="h-4 w-4" />
          ) : (
            <ArrowDownIcon className="h-4 w-4" />
          )}
          {change}
        </span>
      </div>
    </Card>
  )
} 