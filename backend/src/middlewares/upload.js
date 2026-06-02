import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const storage = multer.memoryStorage();

const excelFilter = (req, file, cb) => {
  const ok =
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    /\.xlsx$/i.test(file.originalname);
  if (ok) return cb(null, true);
  cb(ApiError.badRequest('Solo se permiten archivos Excel (.xlsx)'));
};

export const uploadExcel = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: excelFilter,
}).single('file');
