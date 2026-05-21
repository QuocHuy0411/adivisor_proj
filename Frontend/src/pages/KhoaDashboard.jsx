import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

const ASSIGNMENT_RECEIVED_STATUSES = ['Đang phân công', 'Đã phân công'];
const HISTORY_STATUSES = ['Đã đóng', 'Bị từ chối'];
const sectionTitle = {
  assignment: 'Phân công',
  employees: 'Danh sách nhân viên',
  history: 'Lịch sử phân công'
};

function IconButton({ label, icon, onClick }) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

export default function KhoaDashboard() {
  const [searchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [priorityBusy, setPriorityBusy] = useState('');
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [replacementAdvisor, setReplacementAdvisor] = useState({});

  async function load() {
    const [assignmentRes, advisorRes, requestRes] = await Promise.all([
      api.get('/khoa/assignments'),
      api.get('/khoa/advisors'),
      api.get('/khoa/replacement-requests')
    ]);
    setAssignments(assignmentRes.data);
    setAdvisors(advisorRes.data);
    setRequests(requestRes.data);
  }

  useEffect(() => { load(); }, []);

  async function action(url, body) {
    try {
      const { data } = await api.post(url, body);
      setMessage(data.message);
      setError('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thực hiện được thao tác');
      setMessage('');
    }
  }

  async function autoAssign() {
    setAssignmentBusy(true);
    try {
      const { data } = await api.post('/khoa/assignments/auto-assign');
      setMessage(data.message);
      setError('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không phân công tự động được');
      setMessage('');
    } finally {
      setAssignmentBusy(false);
    }
  }

  async function updatePriority(ma_co_van, uu_tien) {
    setPriorityBusy(ma_co_van);
    try {
      const { data } = await api.patch(`/khoa/advisors/${ma_co_van}/priority`, { uu_tien: Number(uu_tien) });
      setMessage(data.message);
      setError('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được độ ưu tiên');
      setMessage('');
    } finally {
      setPriorityBusy('');
    }
  }

  const receivedAssignments = assignments.filter((assignment) => (
    ASSIGNMENT_RECEIVED_STATUSES.includes(assignment.trang_thai)
  ));
  const view = searchParams.get('view');
  const activeSection = ['employees', 'history'].includes(view) ? view : 'assignment';
  const assignmentHistory = assignments.filter((assignment) => HISTORY_STATUSES.includes(assignment.trang_thai));
  const replacementHistory = requests.filter((request) => HISTORY_STATUSES.includes(request.trang_thai));
  const pendingReplacementRequests = requests.filter((request) => !HISTORY_STATUSES.includes(request.trang_thai));
  const historyDetailRows = historyModal
    ? assignmentHistory.filter((assignment) => (
      assignment.nam_hoc === historyModal.nam_hoc && assignment.trang_thai === historyModal.trang_thai
    ))
    : [];
  const hasPendingAssignment = receivedAssignments.some((assignment) => assignment.trang_thai === 'Đang phân công');
  const assignmentSummaryStatus = receivedAssignments.length && !hasPendingAssignment ? 'Đã phân công' : '';

  return (
    <AppLayout title={sectionTitle[activeSection]}>
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {activeSection === 'assignment' ? (
        <>
          <section className="panel">
            <h2>Yêu cầu phân công</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Yêu cầu</th>
                    <th>Trạng thái</th>
                    <th>Xem yêu cầu</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedAssignments.length ? (
                    <tr>
                      <td>Có yêu cầu phân công</td>
                      <td>{assignmentSummaryStatus}</td>
                      <td>
                        <button type="button" onClick={() => setAssignmentModalOpen(true)}>
                          Xem yêu cầu
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan="3">Chưa có dữ liệu</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Yêu cầu thay đổi</h2>
            <DataTable columns={[
              { key: 'ma_yeu_cau', label: 'Mã YC' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ' },
              { key: 'ten_co_van_moi', label: 'CVHT mới' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={pendingReplacementRequests} actions={(row) => (
              <>
                <select value={replacementAdvisor[row.ma_yeu_cau] || ''} onChange={(e) => setReplacementAdvisor({ ...replacementAdvisor, [row.ma_yeu_cau]: e.target.value })}>
                  <option value="">CVHT mới</option>
                  {advisors.map((advisor) => <option key={advisor.ma_co_van} value={advisor.ma_co_van}>{advisor.ho_va_ten}</option>)}
                </select>
                {row.trang_thai === 'Chờ duyệt' ? <button onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/start-step-1`)}>Duyệt bước 1</button> : null}
                {row.trang_thai === 'Đang duyệt bước 1' ? <button onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/approve-step-1`, { ma_co_van_moi: replacementAdvisor[row.ma_yeu_cau] })}>Chấp nhận</button> : null}
                {['Chờ duyệt', 'Đang duyệt bước 1'].includes(row.trang_thai) ? <button className="secondary" onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/reject-step-1`)}>Từ chối</button> : null}
              </>
            )} />
          </section>
        </>
      ) : activeSection === 'history' ? (
        <>
          <section className="panel">
            <h2>Lịch sử phân công</h2>
            <DataTable columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'nam_hoc', label: 'Năm học' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={assignmentHistory} actions={(row) => (
              <div className="icon-actions">
                <IconButton icon="🔎" label="Xem danh sách lớp" onClick={() => setHistoryModal(row)} />
              </div>
            )} />
          </section>

          <section className="panel">
            <h2>Lịch sử thay thế</h2>
            <DataTable columns={[
              { key: 'ma_yeu_cau', label: 'Mã yêu cầu' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'nam_hoc', label: 'Năm học', render: (row) => row.nam_hoc || '-' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ' },
              { key: 'ten_co_van_moi', label: 'CVHT mới', render: (row) => row.ten_co_van_moi || '-' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={replacementHistory} />
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Danh sách nhân viên</h2>
          <DataTable columns={[
            { key: 'ma_co_van', label: 'Mã' },
            { key: 'ho_va_ten', label: 'Họ tên' },
            { key: 'chuyen_nganh', label: 'Chuyên ngành' },
            {
              key: 'uu_tien',
              label: 'Ưu tiên',
              render: (row) => (
                <select
                  value={String(row.uu_tien)}
                  disabled={priorityBusy === row.ma_co_van}
                  onChange={(event) => updatePriority(row.ma_co_van, event.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              )
            },
            { key: 'so_lop_dang_phu_trach', label: 'Số lớp' }
          ]} rows={advisors} />
        </section>
      )}

      {activeSection === 'assignment' && assignmentModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Danh sách yêu cầu phân công</h2>
              <div className="modal-actions">
                <button
                  type="button"
                  disabled={!hasPendingAssignment || assignmentBusy}
                  onClick={autoAssign}
                >
                  {assignmentBusy ? 'Đang phân công...' : 'Phân công tự động và gửi CTSV'}
                </button>
                <button className="secondary" type="button" onClick={() => setAssignmentModalOpen(false)}>Đóng</button>
              </div>
            </header>
            <DataTable columns={[
              { key: 'ma_phan_cong', label: 'Mã' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành' },
              { key: 'ten_co_van', label: 'CVHT', render: (row) => row.ten_co_van || '-' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={receivedAssignments} />
          </section>
        </div>
      ) : null}

      {activeSection === 'history' && historyModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Danh sách lớp đã phân công {historyModal.nam_hoc}</h2>
              <button className="secondary" type="button" onClick={() => setHistoryModal(null)}>Đóng</button>
            </header>
            <DataTable columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành' },
              { key: 'ten_co_van', label: 'CVHT', render: (row) => row.ten_co_van || '-' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={historyDetailRows} />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
