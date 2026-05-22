import { useMemo, useState } from 'react';

function searchableValue(column, row) {
  if (column.renderText) return column.renderText(row);
  return row[column.key];
}

export default function DataTable({ columns, rows, actions, actionLabel = 'Thao tác', filterable = false }) {
  const [filters, setFilters] = useState({});
  const visibleRows = useMemo(() => {
    if (!filterable) return rows;
    return rows.filter((row) => columns.every((column) => {
      const filter = String(filters[column.key] || '').trim().toLowerCase();
      if (!filter) return true;
      return String(searchableValue(column, row) ?? '').toLowerCase().includes(filter);
    }));
  }, [columns, filterable, filters, rows]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            {actions ? <th>{actionLabel}</th> : null}
          </tr>
          {filterable ? (
            <tr className="filter-row">
              {columns.map((column) => (
                <th key={`${column.key}-filter`}>
                  <input
                    aria-label={`Tìm kiếm ${column.label}`}
                    value={filters[column.key] || ''}
                    onChange={(event) => setFilters({ ...filters, [column.key]: event.target.value })}
                  />
                </th>
              ))}
              {actions ? <th /> : null}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={columns.length + (actions ? 1 : 0)}>Chưa có dữ liệu</td></tr>
          ) : visibleRows.map((row) => (
            <tr key={row.id || row.ma_tai_khoan || row.ma_sinh_vien || row.ma_co_van || row.ma_lop || row.ma_phan_cong || row.ma_yeu_cau || row.ma_thong_bao || row.ma_don_vi || row.ma}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
              {actions ? <td className="actions">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
