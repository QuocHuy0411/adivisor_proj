import { badRequest } from './httpError.js';

export const PHAN_CONG = {
  CHO_PHAN_CONG: 'Chờ phân công',
  DANG_PHAN_CONG: 'Đang phân công',
  DA_PHAN_CONG: 'Đã phân công',
  DA_DONG: 'Đã đóng'
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
  DANG_DUYET_BUOC_1: 'Đang duyệt bước 1',
  DA_DUYET_BUOC_1: 'Đã duyệt bước 1',
  DANG_DUYET_BUOC_2: 'Đang duyệt bước 2',
  DA_DUYET_BUOC_2: 'Đã duyệt bước 2',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

const transitions = {
  phanCong: {
    [PHAN_CONG.CHO_PHAN_CONG]: [PHAN_CONG.DANG_PHAN_CONG],
    [PHAN_CONG.DANG_PHAN_CONG]: [PHAN_CONG.DA_PHAN_CONG],
    [PHAN_CONG.DA_PHAN_CONG]: [PHAN_CONG.DA_DONG],
    [PHAN_CONG.DA_DONG]: []
  },
  thayThe: {
    [YEU_CAU_THAY_THE.CHO_DUYET]: [
      YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DANG_DUYET_BUOC_1]: [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_1,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DA_DUYET_BUOC_1]: [
      YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DANG_DUYET_BUOC_2]: [
      YEU_CAU_THAY_THE.DA_DUYET_BUOC_2,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.DA_DUYET_BUOC_2]: [YEU_CAU_THAY_THE.DA_DONG],
    [YEU_CAU_THAY_THE.DA_DONG]: [],
    [YEU_CAU_THAY_THE.BI_TU_CHOI]: []
  }
};

export function assertTransition(flow, from, to) {
  const allowed = transitions[flow]?.[from] || [];
  if (!allowed.includes(to)) {
    throw badRequest(`Chuyen trang thai khong hop le: ${from} -> ${to}`);
  }
}
