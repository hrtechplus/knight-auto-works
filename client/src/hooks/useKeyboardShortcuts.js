import { useEffect, useCallback } from 'react';

/**
 * Custom hook for global keyboard shortcuts
 * @param {Object} shortcuts - Map of keyboard shortcuts to callbacks
 * @example
 * useKeyboardShortcuts({
 *   'ctrl+k': () => openSearch(),
 *   'escape': () => closeModal(),
 *   'n': () => openNewForm()
 * });
 */
export default function useKeyboardShortcuts(shortcuts) {
  const handleKeyDown = useCallback((event) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;
    
    // Build the key combo string
    const combo = [];
    if (event.ctrlKey || event.metaKey) combo.push('ctrl');
    if (event.altKey) combo.push('alt');
    if (event.shiftKey) combo.push('shift');
    combo.push(event.key.toLowerCase());
    
    const keyCombo = combo.join('+');
    
    // Check if this combo has a handler
    const handler = shortcuts[keyCombo];
    
    if (handler) {
      // For ctrl combos, always trigger
      // For single keys, only trigger if not typing
      if (keyCombo.includes('ctrl') || keyCombo.includes('alt') || !isTyping) {
        event.preventDefault();
        handler(event);
      }
    }
    
    // Special case: Escape always works even when typing
    if (event.key === 'Escape' && shortcuts['escape']) {
      event.preventDefault();
      shortcuts['escape'](event);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Common keyboard shortcut presets
 */
export const SHORTCUTS = {
  SEARCH: 'ctrl+k',
  NEW: 'n',
  ESCAPE: 'escape',
  SAVE: 'ctrl+s',
  DELETE: 'delete'
};
