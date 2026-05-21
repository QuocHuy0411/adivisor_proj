import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => onClose?.(), 3000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="toast-wrap">
      <div className={`toast ${type}`}>
        <span>{message}</span>
        <button className="toast-close" type="button" aria-label="Tắt thông báo" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
