import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// ============================================
// TOAST NOTIFICATION COMPONENT
// ============================================

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const toastColors = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--info)'
};

export function Toast({ message, type = 'info', onClose, duration = 5000 }) {
  const Icon = toastIcons[type] || Info;
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className="toast" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '1rem 1.25rem',
      background: 'var(--bg-secondary)',
      border: `1px solid ${toastColors[type]}`,
      borderLeft: `4px solid ${toastColors[type]}`,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      minWidth: '300px',
      maxWidth: '500px',
      animation: 'slideIn 0.3s ease'
    }}>
      <Icon size={20} color={toastColors[type]} />
      <span style={{ flex: 1, fontSize: '0.9rem' }}>{message}</span>
      <button 
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          color: 'var(--text-muted)',
          display: 'flex'
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

// ============================================
// TOAST CONTAINER
// ============================================

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// ============================================
// USE TOAST HOOK
// ============================================

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

// ============================================
// CONFIRM DIALOG COMPONENT
// ============================================

export function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger' // 'danger', 'warning', 'info'
}) {
  if (!isOpen) return null;

  const colors = {
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)'
  };

  const buttonClass = {
    danger: 'btn-danger',
    warning: 'btn-warning',
    info: 'btn-primary'
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
      animation: 'fadeIn 0.2s ease'
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-secondary)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        animation: 'scaleIn 0.2s ease'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <AlertTriangle size={24} color={colors[type]} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
        </div>
        
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '1.5rem',
          lineHeight: 1.5
        }}>
          {message}
        </p>
        
        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          justifyContent: 'flex-end' 
        }}>
          <button 
            className="btn btn-ghost" 
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${buttonClass[type]}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              background: colors[type],
              borderColor: colors[type]
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// USE CONFIRM HOOK
// ============================================

export function useConfirm() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });

  const confirm = ({ title, message, type = 'danger', confirmText = 'Delete' }) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        onConfirm: () => resolve(true)
      });
    });
  };

  const close = () => {
    setState(prev => ({ ...prev, isOpen: false }));
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmText={state.confirmText}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
