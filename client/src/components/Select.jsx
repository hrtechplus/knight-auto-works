import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

function Select({ 
  label, 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select...', 
  required = false, 
  name,
  onSearch,
  isLoading = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(''); // Reset search on close
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle Search with Debounce
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (onSearch) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onSearch(term);
      }, 300); // 300ms debounce
    }
  };

  const selectedOption = options.find(opt => opt.value === value);
  
  // If onSearch is provided, we assume options are already filtered by the parent/server
  // Otherwise, we filter client-side
  const filteredOptions = onSearch 
    ? options 
    : options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      {label && <label className="form-label">{label} {required && '*'}</label>}
      
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={!selectedOption ? 'placeholder' : ''}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={`arrow ${isOpen ? 'rotated' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select-menu">
          <div className="custom-select-search">
            <Search size={16} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
            />
            {isLoading && <div className="spinner-sm" style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></div>}
          </div>
          
          <div className="custom-select-options">
            {isLoading && options.length === 0 ? (
               <div className="custom-select-empty">Loading...</div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`custom-select-option ${value === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                  {value === option.value && <Check size={16} className="check-icon" />}
                </div>
              ))
            ) : (
              <div className="custom-select-empty">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Select;
