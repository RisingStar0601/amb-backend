// utils/upload.ts
import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import dotenv from 'dotenv';

dotenv.config();
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY!,
  secretAccessKey: process.env.AWS_SECRET_KEY!,
  region: process.env.AWS_REGION!,
});

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET!,
    acl: 'public-read',
    metadata: function (_req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (_req, file, cb) {
      const uniqueName = Date.now().toString() + '-' + file.originalname;
      cb(null, uniqueName);
    },
  }),
});

export default upload;
