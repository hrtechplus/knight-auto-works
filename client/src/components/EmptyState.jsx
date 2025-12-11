import { Plus, FileText, Users, Car, Wrench, Package, Search } from 'lucide-react';

/**
 * Enhanced Empty State Component
 * Provides engaging illustrations and clear CTAs for empty data states
 */
export default function EmptyState({ 
  type = 'default', 
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon
}) {
  const configs = {
    customers: {
      icon: Users,
      title: 'No customers yet',
      description: 'Add your first customer to start managing their vehicles and jobs.',
      actionLabel: 'Add Customer'
    },
    vehicles: {
      icon: Car,
      title: 'No vehicles registered',
      description: 'Register a vehicle to start tracking service history and jobs.',
      actionLabel: 'Add Vehicle'
    },
    jobs: {
      icon: Wrench,
      title: 'No jobs found',
      description: 'Create a job to start tracking repairs and services.',
      actionLabel: 'New Job'
    },
    invoices: {
      icon: FileText,
      title: 'No invoices yet',
      description: 'Complete a job and generate an invoice to see it here.',
      actionLabel: 'View Jobs'
    },
    inventory: {
      icon: Package,
      title: 'Inventory is empty',
      description: 'Add parts and supplies to track your stock levels.',
      actionLabel: 'Add Item'
    },
    search: {
      icon: Search,
      title: 'No results found',
      description: 'Try adjusting your search terms or filters.',
      actionLabel: null
    },
    default: {
      icon: FileText,
      title: 'No data available',
      description: 'There\'s nothing here yet.',
      actionLabel: 'Get Started'
    }
  };

  const config = configs[type] || configs.default;
  const Icon = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;

  return (
    <div className="empty-state-enhanced">
      <div className="empty-state-illustration">
        <div className="empty-state-icon-wrapper">
          <Icon size={48} />
        </div>
        <div className="empty-state-decorations">
          <span className="decoration decoration-1"></span>
          <span className="decoration decoration-2"></span>
          <span className="decoration decoration-3"></span>
        </div>
      </div>
      
      <h3 className="empty-state-title">{displayTitle}</h3>
      <p className="empty-state-description">{displayDescription}</p>
      
      {displayActionLabel && onAction && (
        <button className="btn btn-primary empty-state-action" onClick={onAction}>
          <Plus size={18} />
          {displayActionLabel}
        </button>
      )}
      
      {type !== 'search' && (
        <div className="empty-state-tips">
          <p className="empty-state-tip">
            💡 <strong>Tip:</strong> {getTip(type)}
          </p>
        </div>
      )}
    </div>
  );
}

function getTip(type) {
  const tips = {
    customers: 'You can import customers from a CSV file in Settings.',
    vehicles: 'Each customer can have multiple vehicles registered.',
    jobs: 'Jobs can be assigned priorities: Low, Normal, High, or Urgent.',
    invoices: 'Invoices are automatically generated when you mark a job as complete.',
    inventory: 'Set low stock alerts to never run out of essential parts.',
    default: 'Explore the sidebar to discover all features.'
  };
  return tips[type] || tips.default;
}
