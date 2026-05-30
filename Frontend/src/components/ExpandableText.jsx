import { useState } from 'react';

export default function ExpandableText({ text, maxWords = 50 }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return '-';

  const words = text.split(/\s+/);
  const isLong = words.length > maxWords;

  return (
    <div style={{ maxWidth: '280px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {expanded || !isLong ? text : `${words.slice(0, maxWords).join(' ')}...`}
      {isLong && (
        <div style={{ marginTop: '4px' }}>
          <button 
            type="button" 
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0ea5e9',
              padding: 0,
              fontSize: '0.9em',
              cursor: 'pointer',
              fontWeight: 500,
              textDecoration: 'underline'
            }}
          >
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        </div>
      )}
    </div>
  );
}
