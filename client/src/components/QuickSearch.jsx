import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Users, Car, Wrench, FileText, ArrowRight, Command } from 'lucide-react';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

/**
 * Global Quick Search Component
 * Opens with Ctrl+K or Cmd+K, allows quick navigation
 */
export default function QuickSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Quick actions when search is empty
  const quickActions = [
    { type: 'action', icon: Users, label: 'New Customer', path: '/customers', action: 'new' },
    { type: 'action', icon: Car, label: 'New Vehicle', path: '/vehicles', action: 'new' },
    { type: 'action', icon: Wrench, label: 'New Job', path: '/jobs', action: 'new' },
    { type: 'page', icon: Users, label: 'Go to Customers', path: '/customers' },
    { type: 'page', icon: Car, label: 'Go to Vehicles', path: '/vehicles' },
    { type: 'page', icon: Wrench, label: 'Go to Jobs', path: '/jobs' },
    { type: 'page', icon: FileText, label: 'Go to Invoices', path: '/invoices' },
  ];

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter quick actions based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults(quickActions);
    } else {
      const filtered = quickActions.filter(item => 
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    }
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation within search
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (item) => {
    onClose();
    navigate(item.path);
    // If it's a "new" action, we'd trigger the modal
    // This would require a global state manager, simplified for now
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay quick-search-overlay" onClick={onClose}>
      <div className="quick-search-modal" onClick={e => e.stopPropagation()}>
        <div className="quick-search-header">
          <Search size={20} className="quick-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, or type a command..."
            className="quick-search-input"
          />
          <div className="quick-search-shortcut">
            <kbd>ESC</kbd>
          </div>
        </div>
        
        <div className="quick-search-results">
          {results.length === 0 ? (
            <div className="quick-search-empty">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {query === '' && (
                <div className="quick-search-section-title">Quick Actions</div>
              )}
              {results.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    className={`quick-search-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon size={18} className="quick-search-item-icon" />
                    <span className="quick-search-item-label">{item.label}</span>
                    <ArrowRight size={14} className="quick-search-item-arrow" />
                  </button>
                );
              })}
            </>
          )}
        </div>
        
        <div className="quick-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
