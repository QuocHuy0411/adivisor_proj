import { badRequest } from './httpError.js';

export const LOP = {
  CHUA_CO_CVHT: 'Chưa có cố vấn',
  CHO_PHAN_CONG: 'Chờ phân công',
  DANG_PHAN_CONG: 'Đang phân công',
  DA_CO_CVHT: 'Đã có cố vấn',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

export const PHAN_CONG = {
  CHO_PHAN_CONG: 'Chờ phân công',
  DA_PHAN_CONG: 'Đã phân công',
  CHO_GIAM_DOC_DUYET: 'Chờ giám đốc duyệt',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

export const DANH_SACH_DUYET = {
  CHO_DUYET: 'Chờ duyệt',
  DANG_DUYET: 'Đang duyệt',
  DA_DUYET: 'Đã duyệt',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

export const YEU_CAU_THAY_THE = {
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET_BUOC_1: 'Khoa đã duyệt',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

const transitions = {
  phanCong: {
    [PHAN_CONG.CHO_PHAN_CONG]: [PHAN_CONG.DA_PHAN_CONG],
    [PHAN_CONG.DA_PHAN_CONG]: [PHAN_CONG.CHO_GIAM_DOC_DUYET],
    [PHAN_CONG.CHO_GIAM_DOC_DUYET]: [PHAN_CONG.DA_DONG, PHAN_CONG.CHO_PHAN_CONG],
    [PHAN_CONG.DA_DONG]: []
  },
  thayThe: {
    [YEU_CAU_THAY_THE.CHO_DUYET]: [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_1,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DA_DUYET_BUOC_1]: [
      YEU_CAU_THAY_THE.DA_DONG,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DA_DONG]: [],
    [YEU_CAU_THAY_THE.BI_TU_CHOI]: []
  }
};

export function assertTransition(flow, from, to) {
  const allowed = transitions[flow]?.[from] || [];
  if (!allowed.includes(to)) {
    throw badRequest(`Chuyển trạng thái không hợp lệ: ${from} -> ${to}`);
  }
}
