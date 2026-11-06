// Thư viện quy trình đi kèm phần mềm: mọi lĩnh vực, quy trình, loại phương tiện đo mặc định.
// Danh mục của từng công ty có thể đã sửa; "Cập nhật thư viện" chỉ thêm mục còn thiếu (theo id).
import { FIELDS, INSTRUMENT_TYPES, PROCEDURES } from "./catalog";

export const LIBRARY = { fields: FIELDS, procedures: PROCEDURES, types: INSTRUMENT_TYPES };
