import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import Toast from '../components/Toast.jsx';
import ExpandableText from '../components/ExpandableText.jsx';

const WAITING = 'Chờ phân công';
const ASSIGNED = 'Đã phân công';
const DIRECTOR_WAITING = 'Chờ giám đốc duyệt';
const CLOSED = 'Đã đóng';
const ASSIGNMENT_RECEIVED_STATUSES = [WAITING, ASSIGNED, DIRECTOR_WAITING];
const ASSIGNMENT_HISTORY_STATUSES = [CLOSED];
const REJECTED = 'Bị từ chối';
const REPLACEMENT_WAITING = 'Chờ duyệt';
const FACULTY_REVIEWING_REPLACEMENT = 'Khoa đang duyệt';
const FACULTY_APPROVED_REPLACEMENT = 'Khoa đã duyệt';
const DIRECTOR_REVIEWING_REPLACEMENT = 'Giám đốc đang duyệt';
const DIRECTOR_APPROVED_REPLACEMENT = 'Giám đốc đã duyệt';
const REPLACEMENT_HISTORY_STATUSES = [
  FACULTY_APPROVED_REPLACEMENT,
  DIRECTOR_REVIEWING_REPLACEMENT,
  DIRECTOR_APPROVED_REPLACEMENT,
  CLOSED,
  REJECTED
];
const REPLACEMENT_ACTIONABLE_STATUSES = [REPLACEMENT_WAITING, FACULTY_REVIEWING_REPLACEMENT];
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

function yearRank(value) {
  return Number(String(value || '').slice(0, 4)) || 0;
}

function dateRank(value) {
  const time = Date.parse(value || '');
  return Number.isNaN(time) ? 0 : time;
}

function IconButton({ label, icon, onClick }) {
  return (
    <button className="icon-button" type="button" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

// Hien thi cac trang thai Khoa da chuyen len CTSV nhu dang cho Giam doc duyet.
function replacementStatusLabel(status) {
  return [FACULTY_APPROVED_REPLACEMENT, DIRECTOR_REVIEWING_REPLACEMENT].includes(status)
    ? DIRECTOR_REVIEWING_REPLACEMENT
    : status;
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

  // Nap du lieu Khoa: phan cong, danh sach CVHT va yeu cau thay the thuoc khoa minh.
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

  // Goi cac thao tac duyet/tu choi va refresh lai bang sau khi backend cap nhat trang thai.
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

  // Khoa duyet buoc 1 yeu cau thay the, bat buoc chon CVHT moi truoc khi gui CTSV/Giam doc.
  async function approveReplacementRequest(row) {
    const maCoVanMoi = replacementAdvisor[row.ma_yeu_cau];
    if (!maCoVanMoi) {
      setError('Cần chọn cố vấn mới thay thế');
      setMessage('');
      return;
    }
    await action(`/khoa/replacement-requests/${row.ma_yeu_cau}/approve-step-1`, { ma_co_van_moi: maCoVanMoi });
  }

  // Chay auto-assign theo chuyen nganh, uu_tien va gioi han toi da 2 lop/CVHT.
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

  // Gui danh sach phan cong da chon CVHT len CTSV/Giam doc de duyet cuoi.
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

  // Truong Khoa chon CVHT thu cong cho tung lop khi auto-assign chua phu hop.
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

  // Cap nhat uu_tien CVHT 1-3 de dieu chinh thu tu uu tien trong auto-assign.
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

  // Mo chi tiet yeu cau phan cong va danh dau da xem de thong bao dot do khong lap lai.
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
    const key = `${assignment.nam_hoc}-${assignment.ma_khoa || ''}-${assignment.ten_truong_khoa || ''}`;
    if (!groups[key]) {
      groups[key] = {
        id: key,
        nam_hoc: assignment.nam_hoc,
        ten_khoa: assignment.ten_khoa || assignment.ma_khoa || '-',
        ten_truong_khoa: assignment.ten_truong_khoa || '-'
      };
    }
    return groups;
  }, {})).sort((a, b) => yearRank(b.nam_hoc) - yearRank(a.nam_hoc));
  const replacementHistory = requests
    .filter((request) => REPLACEMENT_HISTORY_STATUSES.includes(request.trang_thai))
    .sort((a, b) => dateRank(b.ngay_yeu_cau) - dateRank(a.ngay_yeu_cau)
      || yearRank(b.nam_hoc) - yearRank(a.nam_hoc)
      || String(b.ma_yeu_cau || '').localeCompare(String(a.ma_yeu_cau || '')));
  const pendingReplacementRequests = requests.filter((request) => REPLACEMENT_ACTIONABLE_STATUSES.includes(request.trang_thai));
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
              { key: 'ma_yeu_cau', label: 'Mã YC', width: '14%' },
              { key: 'ma_lop', label: 'Mã lớp', width: '12%' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ', width: '16%' },
              { key: 'ten_co_van_moi', label: 'CVHT mới', width: '16%' },
              { key: 'ly_do', label: 'Lý do dừng', width: '28%', minWidth: '220px', render: (row) => <ExpandableText text={row.ly_do} /> },
              { key: 'trang_thai', label: 'Trạng thái', width: '14%', render: (row) => replacementStatusLabel(row.trang_thai) }
            ]} rows={pendingReplacementRequests} actions={(row) => (
              <>
                {REPLACEMENT_ACTIONABLE_STATUSES.includes(row.trang_thai) ? (
                  <select value={replacementAdvisor[row.ma_yeu_cau] || ''} onChange={(e) => setReplacementAdvisor({ ...replacementAdvisor, [row.ma_yeu_cau]: e.target.value })}>
                    <option value="">CVHT mới</option>
                    {advisors.map((advisor) => <option key={advisor.ma_co_van} value={advisor.ma_co_van}>{advisor.ho_va_ten}</option>)}
                  </select>
                ) : null}
                {REPLACEMENT_ACTIONABLE_STATUSES.includes(row.trang_thai) ? <button onClick={() => approveReplacementRequest(row)}>Duyệt</button> : null}
                {REPLACEMENT_ACTIONABLE_STATUSES.includes(row.trang_thai) ? <button className="secondary" onClick={() => action(`/khoa/replacement-requests/${row.ma_yeu_cau}/reject-step-1`)}>Từ chối</button> : null}
              </>
            )} />
          </section>
        </>
      ) : activeSection === 'history' ? (
        <>
          <section className="panel">
            <h2>Lịch sử phân công</h2>
            <DataTable filterable pageSize={5} columns={[
              { key: 'nam_hoc', label: 'Năm học', width: '22%' },
              { key: 'ten_khoa', label: 'Tên khoa', width: '34%' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa', width: '34%' }
            ]} rows={assignmentHistoryGroups} actionLabel="" actions={(row) => (
              <div className="icon-actions">
                <IconButton icon={<SearchIcon />} label="Xem danh sách lớp" onClick={() => setHistoryModal(row)} />
              </div>
            )} />
          </section>

          <section className="panel">
            <h2>Lịch sử thay thế</h2>
            <DataTable filterable pageSize={5} columns={[
              { key: 'ma_yeu_cau', label: 'Mã yêu cầu', width: '14%' },
              { key: 'ma_lop', label: 'Mã lớp', width: '12%' },
              { key: 'ten_truong_khoa', label: 'Tên trưởng Khoa', width: '18%', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'ten_co_van_cu', label: 'CVHT cũ', width: '16%' },
              { key: 'ten_co_van_moi', label: 'CVHT mới', width: '16%', render: (row) => row.ten_co_van_moi || '-' },
              { key: 'trang_thai', label: 'Trạng thái', width: '14%' },
              { key: 'nam_hoc', label: 'Năm học', width: '10%', render: (row) => row.nam_hoc || '-' }
            ]} rows={replacementHistory} />
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Danh sách nhân viên</h2>
          <DataTable pageSize={5} columns={[
            { key: 'ma_co_van', label: 'Mã nhân viên', width: '18%' },
            { key: 'ho_va_ten', label: 'Họ tên', width: '26%' },
            { key: 'chuyen_nganh', label: 'Chuyên ngành', width: '28%', minWidth: '180px' },
            {
              key: 'uu_tien',
              label: 'Ưu tiên',
              width: '12%',
              type: 'number',
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
            { key: 'so_lop_dang_phu_trach', label: 'Số lớp', width: '16%', type: 'number' }
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
              { key: 'ma_phan_cong', label: 'Mã', width: '14%' },
              { key: 'ma_lop', label: 'Mã lớp', width: '12%' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành', width: '28%', minWidth: '180px' },
              {
                key: 'ten_co_van',
                label: 'Cố vấn học tập',
                width: '30%',
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
              { key: 'trang_thai', label: 'Trạng thái', width: '16%' }
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
              { key: 'ma_phan_cong', label: 'Mã phân công', width: '18%' },
              { key: 'ma_lop', label: 'Mã lớp', width: '14%' },
              { key: 'chuyen_nganh', label: 'Chuyên ngành', width: '28%', minWidth: '180px' },
              { key: 'so_luong_sv', label: 'Sĩ số', width: '12%', type: 'number' },
              { key: 'ten_co_van', label: 'Cố vấn học tập', width: '28%', render: (row) => row.ten_co_van || '-' }
            ]} rows={historyDetailRows} filterable />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
