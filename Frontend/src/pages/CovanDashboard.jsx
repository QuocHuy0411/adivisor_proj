import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import Toast from '../components/Toast.jsx';
import ExpandableText from '../components/ExpandableText.jsx';

export default function CovanDashboard() {
  const [classes, setClasses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reason, setReason] = useState({});
  const [showReasonForm, setShowReasonForm] = useState({});

  // Nap dashboard CVHT: lop dang phu trach va toan bo yeu cau thay the da gui.
  async function load() {
    const [classRes, requestRes] = await Promise.all([
      api.get('/covan/classes'),
      api.get('/covan/replacement-requests')
    ]);
    setClasses(classRes.data);
    setRequests(requestRes.data);
  }

  useEffect(() => { load(); }, []);

  // CVHT xem sinh vien cua lop minh; backend se chan neu ma_lop khong thuoc CVHT.
  async function loadStudents(ma_lop) {
    const { data } = await api.get(`/covan/classes/${ma_lop}/students`);
    setStudents(data);
  }

  // Gui don xin dung co van cho lop dang phu trach, sau do refresh bang yeu cau da gui.
  async function requestStop(row) {
    try {
      const { data } = await api.post('/covan/replacement-requests', {
        ma_lop: row.ma_lop,
        ly_do: reason[row.ma_lop]
      });
      setMessage(data.message);
      setError('');
      setShowReasonForm({ ...showReasonForm, [row.ma_lop]: false });
      setReason({ ...reason, [row.ma_lop]: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được yêu cầu');
      setMessage('');
    }
  }

  return (
    <AppLayout title="Cố vấn học tập">
      <Toast message={error || message} type={error ? 'error' : 'success'} onClose={() => { setMessage(''); setError(''); }} />
      <section className="panel">
        <h2>Lớp đang phụ trách</h2>
        <DataTable pageSize={1} columns={[
          { key: 'ma_lop', label: 'Mã lớp', width: '14%' },
          { key: 'ten_lop', label: 'Tên lớp', width: '18%' },
          { key: 'chuyen_nganh', label: 'Chuyên ngành', width: '24%', minWidth: '180px' },
          { key: 'so_luong_sv', label: 'Số sinh viên', width: '10%', type: 'number' },
          { key: 'nam_hoc', label: 'Năm học', width: '12%' },
          {
            key: 'yeu_cau_dung',
            label: 'Yêu cầu dừng cố vấn',
            width: '22%',
            render: (row) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px' }}>
                <button
                  className="secondary"
                  onClick={() => setShowReasonForm({ ...showReasonForm, [row.ma_lop]: !showReasonForm[row.ma_lop] })}
                >
                  Nhập lý do
                </button>
                {showReasonForm[row.ma_lop] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                      placeholder="Lý do dừng"
                      value={reason[row.ma_lop] || ''}
                      onChange={(e) => setReason({ ...reason, [row.ma_lop]: e.target.value })}
                    />
                    <button className="primary" onClick={() => requestStop(row)}>Gửi yêu cầu</button>
                  </div>
                )}
              </div>
            )
          }
        ]} rows={classes} actions={(row) => (
          <button onClick={() => loadStudents(row.ma_lop)}>Thông tin Sinh viên</button>
        )} />
      </section>
      <section className="panel">
        <h2>Sinh viên lớp đang chọn</h2>
        <DataTable pageSize={5} columns={[
          { key: 'ma_sinh_vien', label: 'Mã sinh viên', width: '18%' },
          { key: 'ho_va_ten', label: 'Họ tên', width: '26%' },
          { key: 'email', label: 'Email', width: '34%', minWidth: '220px' },
          { key: 'so_dien_thoai', label: 'Số điện thoại', width: '18%', type: 'number' }
        ]} rows={students} />
      </section>
      <section className="panel">
        <h2>Yêu cầu đã gửi</h2>
        <DataTable pageSize={3} columns={[
          { key: 'ma_yeu_cau', label: 'Mã yêu cầu', width: '18%' },
          { key: 'ten_lop', label: 'Lớp', width: '12%' },
          { key: 'ten_co_van_moi', label: 'CVHT mới', width: '18%', render: (row) => row.ten_co_van_moi || '-' },
          { key: 'ly_do', label: 'Lý do', width: '32%', minWidth: '220px', render: (row) => <ExpandableText text={row.ly_do} /> },
          { key: 'trang_thai', label: 'Trạng thái', width: '20%' }
        ]} rows={requests} />
      </section>
    </AppLayout>
  );
}
