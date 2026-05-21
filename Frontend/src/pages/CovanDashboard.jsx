import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

export default function CovanDashboard() {
  const [classes, setClasses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState({});

  async function load() {
    const [classRes, requestRes] = await Promise.all([
      api.get('/covan/classes'),
      api.get('/covan/replacement-requests')
    ]);
    setClasses(classRes.data);
    setRequests(requestRes.data);
  }

  useEffect(() => { load(); }, []);

  async function loadStudents(ma_lop) {
    const { data } = await api.get(`/covan/classes/${ma_lop}/students`);
    setStudents(data);
  }

  async function requestStop(row) {
    const { data } = await api.post('/covan/replacement-requests', {
      ma_lop: row.ma_lop,
      ly_do: reason[row.ma_lop]
    });
    setMessage(data.message);
    await load();
  }

  return (
    <AppLayout title="Cố vấn học tập">
      {message ? <div className="success">{message}</div> : null}
      <section className="panel">
        <h2>Lớp đang phụ trách</h2>
        <DataTable columns={[
          { key: 'ma_lop', label: 'Mã lớp' },
          { key: 'ten_lop', label: 'Tên lớp' },
          { key: 'chuyen_nganh', label: 'Chuyên ngành' },
          { key: 'so_luong_sv', label: 'Số SV' },
          { key: 'nam_hoc', label: 'Năm học' }
        ]} rows={classes} actions={(row) => (
          <>
            <button onClick={() => loadStudents(row.ma_lop)}>Sinh viên</button>
            <input placeholder="Lý do dừng" value={reason[row.ma_lop] || ''} onChange={(e) => setReason({ ...reason, [row.ma_lop]: e.target.value })} />
            <button className="secondary" onClick={() => requestStop(row)}>Gửi yêu cầu</button>
          </>
        )} />
      </section>
      <section className="panel">
        <h2>Sinh viên lớp đang chọn</h2>
        <DataTable columns={[
          { key: 'ma_sinh_vien', label: 'Mã SV' },
          { key: 'ho_va_ten', label: 'Họ tên' },
          { key: 'email', label: 'Email' },
          { key: 'so_dien_thoai', label: 'SĐT' }
        ]} rows={students} />
      </section>
      <section className="panel">
        <h2>Yêu cầu đã gửi</h2>
        <DataTable columns={[
          { key: 'ma_yeu_cau', label: 'Mã YC' },
          { key: 'ten_lop', label: 'Lớp' },
          { key: 'ly_do', label: 'Lý do' },
          { key: 'ten_co_van_moi', label: 'CVHT mới' },
          { key: 'trang_thai', label: 'Trạng thái' }
        ]} rows={requests} />
      </section>
    </AppLayout>
  );
}
