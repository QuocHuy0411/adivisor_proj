import { useState } from 'react';

export default function ExpandableText({ text }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return '-';

  return (
    <div style={{ maxWidth: '280px' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Thu gọn' : 'Xem đầy đủ'}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          padding: 0,
          textAlign: 'left'
        }}
      >
        <span
          style={expanded ? {
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          } : {
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {text}
        </span>
      </button>
      {expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#0ea5e9',
            padding: '4px 0 0',
            fontSize: '0.9em',
            cursor: 'pointer',
            fontWeight: 500,
            textDecoration: 'underline'
          }}
        >
          Thu gọn
        </button>
      ) : null}
    </div>
  );
}
