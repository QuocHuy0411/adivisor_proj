import { useMemo, useState, useEffect } from 'react';

function searchableValue(column, row) {
  if (column.renderText) return column.renderText(row);
  return row[column.key];
}

const NUMBER_KEYS = new Set([
  'so_luong_sv',
  'so_sinh_vien',
  'si_so',
  'so_lop',
  'so_lop_dang_phu_trach',
  'uu_tien',
  'so_dien_thoai'
]);

const DEFAULT_WIDTH_BY_KEY = {
  ngay_gui: '14%',
  nam_hoc: '14%',
  ma: '15%',
  ma_lop: '12%',
  ma_khoa: '12%',
  ma_don_vi: '28%',
  ma_co_van: '15%',
  ma_sinh_vien: '15%',
  ma_phan_cong: '16%',
  ma_yeu_cau: '16%',
  ho_va_ten: '22%',
  ten_lop: '18%',
  ten_khoa: '22%',
  ten_don_vi: '72%',
  ten_tai_khoan: '18%',
  ten_truong_khoa: '22%',
  ten_co_van: '20%',
  ten_co_van_cu: '18%',
  ten_co_van_moi: '18%',
  email: '24%',
  vai_tro: '14%',
  trang_thai: '14%',
  trang_thai_lop: '14%',
  chuyen_nganh: '22%',
  ly_do: '28%',
  noi_dung: '60%',
  tieu_de: '26%',
  so_luong_sv: '10%',
  so_sinh_vien: '10%',
  si_so: '10%',
  so_lop: '10%',
  so_lop_dang_phu_trach: '10%',
  uu_tien: '10%',
  so_dien_thoai: '14%'
};

const DEFAULT_MIN_WIDTH_BY_KEY = {
  email: '180px',
  ly_do: '220px',
  noi_dung: '320px',
  chuyen_nganh: '180px',
  ten_co_van: '170px',
  ten_co_van_cu: '150px',
  ten_co_van_moi: '150px',
  ten_truong_khoa: '170px',
  trang_thai: '130px'
};

function columnAlign(column) {
  if (column.align) return column.align;
  if (column.type === 'number' || NUMBER_KEYS.has(column.key)) return 'center';
  return 'left';
}

function columnStyle(column) {
  return {
    width: column.width || DEFAULT_WIDTH_BY_KEY[column.key],
    minWidth: column.minWidth || DEFAULT_MIN_WIDTH_BY_KEY[column.key],
    textAlign: columnAlign(column)
  };
}

export default function DataTable({ columns, rows, actions, actionLabel = 'Thao tác', filterable = false, pageSize }) {
  const [filters, setFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const visibleRows = useMemo(() => {
    if (!filterable) return rows;
    return rows.filter((row) => columns.every((column) => {
      const filter = String(filters[column.key] || '').trim().toLowerCase();
      if (!filter) return true;
      return String(searchableValue(column, row) ?? '').toLowerCase().includes(filter);
    }));
  }, [columns, filterable, filters, rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, rows]);

  const paginatedRows = useMemo(() => {
    if (!pageSize) return visibleRows;
    const start = (currentPage - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, pageSize, currentPage]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(visibleRows.length / pageSize)) : 1;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <colgroup>
          {columns.map((column) => <col key={column.key} style={columnStyle(column)} />)}
          {actions ? <col className="data-table-action-col" /> : null}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={`align-${columnAlign(column)}`} key={column.key} style={columnStyle(column)}>
                {column.label}
              </th>
            ))}
            {actions ? <th className="actions-header">{actionLabel}</th> : null}
          </tr>
          {filterable ? (
            <tr className="filter-row">
              {columns.map((column) => (
                <th className={`align-${columnAlign(column)}`} key={`${column.key}-filter`} style={columnStyle(column)}>
                  <input
                    aria-label={`Tìm kiếm ${column.label}`}
                    className={`align-${columnAlign(column)}`}
                    value={filters[column.key] || ''}
                    onChange={(event) => setFilters({ ...filters, [column.key]: event.target.value })}
                  />
                </th>
              ))}
              {actions ? <th className="actions-header" /> : null}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {paginatedRows.length === 0 ? (
            <tr><td colSpan={columns.length + (actions ? 1 : 0)}>Chưa có dữ liệu</td></tr>
          ) : paginatedRows.map((row) => (
            <tr key={row.id || row.ma_tai_khoan || row.ma_sinh_vien || row.ma_co_van || row.ma_lop || row.ma_phan_cong || row.ma_yeu_cau || row.ma_thong_bao || row.ma_don_vi || row.ma}>
              {columns.map((column) => (
                <td className={`align-${columnAlign(column)}`} key={column.key} style={columnStyle(column)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
              {actions ? <td className="actions">{actions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {pageSize && (
        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem', alignItems: 'center' }}>
          <button className="secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Trước</button>
          <span>Trang {currentPage} / {totalPages}</span>
          <button className="secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Sau</button>
        </div>
      )}
    </div>
  );
}
