import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

function Select({ label, value, onChange, options = [], placeholder = 'Select...', required = false, name }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
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
          {options.length > 0 ? (
            options.map((option) => (
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
            <div className="custom-select-empty">No options</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Select;
