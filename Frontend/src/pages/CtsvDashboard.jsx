import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

export default function CtsvDashboard() {
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [classForm, setClassForm] = useState({ ma_lop: '', ten_lop: '', ma_khoa: 'CNTT', chuyen_nganh: '', nam_hoc: '2026-2027', so_luong_sv: 0 });

  async function load() {
    const [classRes, assignmentRes, requestRes] = await Promise.all([
      api.get('/ctsv/classes'),
      api.get('/ctsv/assignments'),
      api.get('/ctsv/replacement-requests')
    ]);
    setClasses(classRes.data);
    setAssignments(assignmentRes.data);
    setRequests(requestRes.data);
  }

  useEffect(() => { load(); }, []);

  async function createClass(event) {
    event.preventDefault();
    const { data } = await api.post('/ctsv/classes', classForm);
    setMessage(data.message);
    setClassForm({ ma_lop: '', ten_lop: '', ma_khoa: 'CNTT', chuyen_nganh: '', nam_hoc: '2026-2027', so_luong_sv: 0 });
    await load();
  }

  async function createAssignment(row) {
    const { data } = await api.post('/ctsv/assignments', { ma_lop: row.ma_lop, nam_hoc: row.nam_hoc });
    setMessage(data.message);
    await load();
  }

  async function action(url) {
    const { data } = await api.post(url);
    setMessage(data.message);
    await load();
  }

  return (
    <AppLayout title="Phòng Công tác Sinh viên">
      {message ? <div className="success">{message}</div> : null}
      <form className="panel form-row" onSubmit={createClass}>
        <input placeholder="Mã lớp" value={classForm.ma_lop} onChange={(e) => setClassForm({ ...classForm, ma_lop: e.target.value })} />
        <input placeholder="Tên lớp" value={classForm.ten_lop} onChange={(e) => setClassForm({ ...classForm, ten_lop: e.target.value })} />
        <select value={classForm.ma_khoa} onChange={(e) => setClassForm({ ...classForm, ma_khoa: e.target.value })}>
          <option value="CNTT">CNTT</option><option value="VT">VT</option><option value="QTKD">QTKD</option><option value="KTDT">KTDT</option>
        </select>
        <input placeholder="Chuyên ngành" value={classForm.chuyen_nganh} onChange={(e) => setClassForm({ ...classForm, chuyen_nganh: e.target.value })} />
        <input placeholder="Năm học" value={classForm.nam_hoc} onChange={(e) => setClassForm({ ...classForm, nam_hoc: e.target.value })} />
        <button>Tạo lớp</button>
      </form>

      <section className="panel">
        <h2>Lớp</h2>
        <DataTable columns={[
          { key: 'ma_lop', label: 'Mã lớp' },
          { key: 'ten_lop', label: 'Tên lớp' },
          { key: 'ten_khoa', label: 'Khoa' },
          { key: 'nam_hoc', label: 'Năm học' },
          { key: 'ten_co_van', label: 'CVHT' },
          { key: 'trang_thai_lop', label: 'Trạng thái' }
        ]} rows={classes} actions={(row) => <button onClick={() => createAssignment(row)}>Lập DS</button>} />
      </section>

      <section className="panel">
        <h2>Danh sách phân công</h2>
        <DataTable columns={[
          { key: 'ma_phan_cong', label: 'Mã' },
          { key: 'ten_lop', label: 'Lớp' },
          { key: 'ma_khoa', label: 'Khoa' },
          { key: 'ten_co_van', label: 'CVHT' },
          { key: 'trang_thai', label: 'Trạng thái' }
        ]} rows={assignments} actions={(row) => (
          <>
            {row.trang_thai === 'Chờ phân công' ? <button onClick={() => action(`/ctsv/assignments/${row.ma_phan_cong}/send`)}>Gửi Khoa</button> : null}
            {row.trang_thai === 'Đã phân công' ? <button onClick={() => action(`/ctsv/assignments/${row.ma_phan_cong}/approve`)}>Duyệt</button> : null}
            {row.trang_thai === 'Đã phân công' ? <button className="secondary" onClick={() => action(`/ctsv/assignments/${row.ma_phan_cong}/reject`)}>Từ chối</button> : null}
          </>
        )} />
      </section>

      <section className="panel">
        <h2>Yêu cầu thay thế CVHT</h2>
        <DataTable columns={[
          { key: 'ma_yeu_cau', label: 'Mã YC' },
          { key: 'ten_lop', label: 'Lớp' },
          { key: 'ten_co_van_cu', label: 'CVHT cũ' },
          { key: 'ten_co_van_moi', label: 'CVHT mới' },
          { key: 'trang_thai', label: 'Trạng thái' }
        ]} rows={requests} actions={(row) => (
          <>
            {row.trang_thai === 'Đã duyệt bước 1' ? <button onClick={() => action(`/ctsv/replacement-requests/${row.ma_yeu_cau}/start-step-2`)}>Duyệt bước 2</button> : null}
            {row.trang_thai === 'Đang duyệt bước 2' ? <button onClick={() => action(`/ctsv/replacement-requests/${row.ma_yeu_cau}/approve`)}>Chấp nhận</button> : null}
            {['Đã duyệt bước 1', 'Đang duyệt bước 2'].includes(row.trang_thai) ? <button className="secondary" onClick={() => action(`/ctsv/replacement-requests/${row.ma_yeu_cau}/reject`)}>Từ chối</button> : null}
          </>
        )} />
      </section>
    </AppLayout>
  );
}
