import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';

export default function SinhVienDashboard() {
  const [advisor, setAdvisor] = useState(null);

  useEffect(() => {
    api.get('/sinhvien/advisor').then((res) => setAdvisor(res.data));
  }, []);

  return (
    <AppLayout title="Sinh viên">
      <section className="panel detail-grid">
        <h2>Thông tin CVHT phụ trách lớp</h2>
        {advisor ? (
          <>
            <div><span>Lớp</span><strong>{advisor.ten_lop}</strong></div>
            <div><span>Khoa</span><strong>{advisor.ten_khoa}</strong></div>
            <div><span>Chuyên ngành</span><strong>{advisor.chuyen_nganh}</strong></div>
            <div><span>CVHT</span><strong>{advisor.ten_co_van || 'Chưa được phân công'}</strong></div>
            <div><span>Email</span><strong>{advisor.email || '-'}</strong></div>
            <div><span>Số điện thoại</span><strong>{advisor.so_dien_thoai || '-'}</strong></div>
          </>
        ) : <p>Đang tải dữ liệu...</p>}
      </section>
    </AppLayout>
  );
}
