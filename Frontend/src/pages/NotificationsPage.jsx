import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function IconButton({ label, icon, onClick }) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data));
    if (user?.loai_tai_khoan === 'khoa') {
      api.get('/khoa/assignments').then((res) => setAssignments(res.data));
    }
  }, [user?.loai_tai_khoan]);

  const khoaNotificationRows = useMemo(() => {
    const closedAssignments = assignments.filter((row) => row.trang_thai === 'Đã đóng');
    const years = [...new Set(closedAssignments.map((row) => row.nam_hoc))];
    return years.map((nam_hoc) => ({
      id: nam_hoc,
      ngay_gui: closedAssignments.find((row) => row.nam_hoc === nam_hoc)?.ngay_phan_cong || '-',
      tieu_de: 'Thông báo phân công',
      noi_dung: `Đã phân công giảng viên cho năm học ${nam_hoc}`,
      nam_hoc
    }));
  }, [assignments]);

  const rows = user?.loai_tai_khoan === 'khoa' ? khoaNotificationRows : notifications;
  const detailRows = selectedYear ? assignments.filter((row) => row.nam_hoc === selectedYear && row.trang_thai === 'Đã đóng') : [];

  return (
    <AppLayout title="Thông báo">
      <section className="panel">
        <DataTable columns={[
          { key: 'ngay_gui', label: 'Ngày gửi' },
          { key: 'tieu_de', label: 'Tiêu đề' },
          { key: 'noi_dung', label: 'Nội dung' }
        ]} rows={rows} actionLabel="" actions={user?.loai_tai_khoan === 'khoa' ? (row) => (
          <div className="icon-actions">
            <IconButton icon="🔍" label="Xem danh sách phân công" onClick={() => setSelectedYear(row.nam_hoc)} />
          </div>
        ) : null} />
      </section>

      {selectedYear ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Danh sách phân công năm học {selectedYear}</h2>
              <button className="secondary" type="button" onClick={() => setSelectedYear(null)}>Đóng</button>
            </header>
            <DataTable columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành' },
              { key: 'ten_co_van', label: 'Cố vấn học tập', render: (row) => row.ten_co_van || '-' },
              { key: 'nam_hoc', label: 'Năm học' }
            ]} rows={detailRows} />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
