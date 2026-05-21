import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data));
  }, []);

  return (
    <AppLayout title="Thông báo">
      <section className="panel">
        <DataTable columns={[
          { key: 'ngay_gui', label: 'Ngày gửi' },
          { key: 'tieu_de', label: 'Tiêu đề' },
          { key: 'noi_dung', label: 'Nội dung' }
        ]} rows={notifications} />
      </section>
    </AppLayout>
  );
}
