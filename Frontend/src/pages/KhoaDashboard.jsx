import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import Toast from '../components/Toast.jsx';

const WAITING = 'Chờ phân công';
const ASSIGNED = 'Đã phân công';
const DIRECTOR_WAITING = 'Chờ giám đốc duyệt';
const CLOSED = 'Đã đóng';
const ASSIGNMENT_RECEIVED_STATUSES = [WAITING, ASSIGNED, DIRECTOR_WAITING];
const ASSIGNMENT_HISTORY_STATUSES = [CLOSED];
const REPLACEMENT_HISTORY_STATUSES = ['Đã đóng', 'Bị từ chối'];
const sectionTitle = {
  assignment: 'Phân công',
  employees: 'Danh sách nhân viên',
  history: 'Lịch sử phân công'
};

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

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
  const [manualAdvisor, setManualAdvisor] = useState({});
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

  async function submitAssignments() {
    setAssignmentBusy(true);
    try {
      const { data } = await api.post('/khoa/assignments/submit-all');
      setMessage(data.message);
      setError('');
      setAssignmentModalOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi danh sách phân công được');
      setMessage('');
    } finally {
      setAssignmentBusy(false);
    }
  }

  async function chooseManualAdvisor(assignment, advisorName) {
    const selectedName = advisorName.trim();
    if (!selectedName || selectedName === (assignment.ten_co_van || '')) return;
    const advisor = advisors.find((item) => item.ho_va_ten === selectedName);
    if (!advisor) {
      setError('Vui lòng chọn cố vấn học tập có trong danh sách');
      setMessage('');
      return;
    }
    setAssignmentBusy(true);
    try {
      const { data } = await api.post(`/khoa/assignments/${assignment.ma_phan_cong}/assign`, {
        ma_co_van: advisor.ma_co_van
      });
      setMessage(data.message);
      setError('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không chọn cố vấn học tập được');
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

  const [seenDetails, setSeenDetails] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('seen_khoa_assignment_details') || '[]');
    } catch {
      return [];
    }
  });

  const hasUnreadDetails = useMemo(() => {
    const waitingList = receivedAssignments.filter((a) => a.trang_thai === 'Chờ phân công');
    return waitingList.some((a) => !seenDetails.includes(a.ma_phan_cong));
  }, [receivedAssignments, seenDetails]);

  function handleOpenAssignmentModal() {
    setAssignmentModalOpen(true);
    const waitingList = receivedAssignments.filter((a) => a.trang_thai === 'Chờ phân công');
    const nextSeen = Array.from(new Set([...seenDetails, ...waitingList.map((a) => a.ma_phan_cong)]));
    setSeenDetails(nextSeen);
    localStorage.setItem('seen_khoa_assignment_details', JSON.stringify(nextSeen));
    window.dispatchEvent(new Event('local-storage-update'));
  }

  const view = searchParams.get('view');
  const activeSection = ['employees', 'history'].includes(view) ? view : 'assignment';
  const assignmentHistory = assignments.filter((assignment) => ASSIGNMENT_HISTORY_STATUSES.includes(assignment.trang_thai));
  const assignmentHistoryGroups = Object.values(assignmentHistory.reduce((groups, assignment) => {
    const key = `${assignment.nam_hoc}-${assignment.ten_truong_khoa || ''}`;
    if (!groups[key]) {
      groups[key] = {
        id: key,
        nam_hoc: assignment.nam_hoc,
        ten_truong_khoa: assignment.ten_truong_khoa || '-'
      };
    }
    return groups;
  }, {}));
  const replacementHistory = requests.filter((request) => REPLACEMENT_HISTORY_STATUSES.includes(request.trang_thai));
  const pendingReplacementRequests = requests.filter((request) => !REPLACEMENT_HISTORY_STATUSES.includes(request.trang_thai));
  const historyDetailRows = historyModal
    ? assignmentHistory.filter((assignment) => (
      assignment.nam_hoc === historyModal.nam_hoc
      && (assignment.ten_truong_khoa || '-') === historyModal.ten_truong_khoa
    ))
    : [];
  const hasWaitingAssignment = receivedAssignments.some((assignment) => assignment.trang_thai === WAITING);
  const hasAssignedAssignment = receivedAssignments.some((assignment) => assignment.trang_thai === ASSIGNED);
  const hasDirectorWaitingAssignment = receivedAssignments.some((assignment) => assignment.trang_thai === DIRECTOR_WAITING);
  const canAutoAssign = hasWaitingAssignment && !assignmentBusy;
  const canSubmitAssignments = hasAssignedAssignment && !assignmentBusy;
  const assignmentSummaryStatus = !receivedAssignments.length
    ? 'Chưa có yêu cầu'
    : hasDirectorWaitingAssignment && !hasWaitingAssignment && !hasAssignedAssignment
      ? DIRECTOR_WAITING
      : WAITING;

  return (
    <AppLayout title={sectionTitle[activeSection]}>
      <Toast message={error || message} type={error ? 'error' : 'success'} onClose={() => { setMessage(''); setError(''); }} />

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
                  <tr>
                    <td>{receivedAssignments.length ? 'Có yêu cầu phân công' : 'Chưa có yêu cầu'}</td>
                    <td>{assignmentSummaryStatus}</td>
                    <td>
                      <button
                        type="button"
                        disabled={!receivedAssignments.length}
                        onClick={handleOpenAssignmentModal}
                        style={{ position: 'relative' }}
                      >
                        Xem yêu cầu
                        {hasUnreadDetails && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              width: '10px',
                              height: '10px',
                              backgroundColor: '#ef4444',
                              borderRadius: '50%',
                              border: '2px solid #ffffff',
                              display: 'block'
                            }}
                          />
                        )}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Yêu cầu thay đổi</h2>
            <DataTable pageSize={5} columns={[
              { key: 'ma_yeu_cau', label: 'Mã YC' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ' },
              { key: 'ten_co_van_moi', label: 'CVHT mới' },
              { key: 'ly_do', label: 'Lý do dừng' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={pendingReplacementRequests} actions={(row) => (
              <>
                <select value={replacementAdvisor[row.ma_yeu_cau] || ''} onChange={(e) => setReplacementAdvisor({ ...replacementAdvisor, [row.ma_yeu_cau]: e.target.value })}>
                  <option value="">CVHT mới</option>
                  {advisors.map((advisor) => <option key={advisor.ma_co_van} value={advisor.ma_co_van}>{advisor.ho_va_ten}</option>)}
                </select>
                {row.trang_thai === 'Chờ duyệt' ? <button onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/approve-step-1`, { ma_co_van_moi: replacementAdvisor[row.ma_yeu_cau] })}>Duyệt</button> : null}
                {row.trang_thai === 'Chờ duyệt' ? <button className="secondary" onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/reject-step-1`)}>Từ chối</button> : null}
              </>
            )} />
          </section>
        </>
      ) : activeSection === 'history' ? (
        <>
          <section className="panel">
            <h2>Lịch sử phân công</h2>
            <DataTable pageSize={5} columns={[
              { key: 'nam_hoc', label: 'Năm học' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa' }
            ]} rows={assignmentHistoryGroups} actionLabel="" actions={(row) => (
              <div className="icon-actions">
                <IconButton icon={<SearchIcon />} label="Xem danh sách lớp" onClick={() => setHistoryModal(row)} />
              </div>
            )} />
          </section>

          <section className="panel">
            <h2>Lịch sử thay thế</h2>
            <DataTable pageSize={5} columns={[
              { key: 'ma_yeu_cau', label: 'Mã yêu cầu' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ' },
              { key: 'ten_co_van_moi', label: 'CVHT mới', render: (row) => row.ten_co_van_moi || '-' },
              { key: 'trang_thai', label: 'Trạng thái' },
              { key: 'nam_hoc', label: 'Năm học', render: (row) => row.nam_hoc || '-' }
            ]} rows={replacementHistory} />
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Danh sách nhân viên</h2>
          <DataTable pageSize={5} columns={[
            { key: 'ma_co_van', label: 'Mã nhân viên' },
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
          ]} rows={advisors} filterable />
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
                  disabled={!canAutoAssign}
                  onClick={autoAssign}
                >
                  {assignmentBusy ? 'Đang xử lý...' : 'Tự động'}
                </button>
                <button
                  type="button"
                  disabled={!canSubmitAssignments}
                  onClick={submitAssignments}
                >
                  Gửi
                </button>
                <button className="secondary" type="button" onClick={() => setAssignmentModalOpen(false)}>Đóng</button>
              </div>
            </header>
            <datalist id="advisor-options">
              {advisors.map((advisor) => (
                <option
                  key={advisor.ma_co_van}
                  value={advisor.ho_va_ten}
                  label={`Độ ưu tiên ${advisor.uu_tien}`}
                />
              ))}
            </datalist>
            <DataTable pageSize={5} columns={[
              { key: 'ma_phan_cong', label: 'Mã' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành' },
              {
                key: 'ten_co_van',
                label: 'Cố vấn học tập',
                render: (row) => [WAITING, ASSIGNED].includes(row.trang_thai) ? (
                  <input
                    className="table-input"
                    list="advisor-options"
                    value={manualAdvisor[row.ma_phan_cong] ?? row.ten_co_van ?? ''}
                    placeholder="Chọn cố vấn học tập"
                    disabled={assignmentBusy}
                    onChange={(event) => setManualAdvisor({
                      ...manualAdvisor,
                      [row.ma_phan_cong]: event.target.value
                    })}
                    onBlur={(event) => chooseManualAdvisor(row, event.target.value)}
                  />
                ) : (row.ten_co_van || '-')
              },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={receivedAssignments} filterable />
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
            <DataTable pageSize={5} columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành' },
              { key: 'so_luong_sv', label: 'Sĩ số' },
              { key: 'ten_co_van', label: 'Cố vấn học tập', render: (row) => row.ten_co_van || '-' }
            ]} rows={historyDetailRows} filterable />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
