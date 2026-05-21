export default function DataTable({ columns, rows, actions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            {actions ? <th>Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + (actions ? 1 : 0)}>Chưa có dữ liệu</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id || row.ma_tai_khoan || row.ma_co_van || row.ma_lop || row.ma_phan_cong || row.ma_yeu_cau || row.ma_thong_bao}>
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
