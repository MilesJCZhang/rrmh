/**
 * routes_upload.js - 文件上传路由
 *
 * 端点：
 *   POST /v1/upload/avatar  上传头像
 *   POST /v1/upload/image   上传图片
 *   POST /v1/upload/voice   上传语音
 *
 * 使用 multer 处理 multipart/form-data，文件保存到 public/uploads/ 目录
 * 返回完整 HTTP URL 供小程序直接展示
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');

const router = express.Router();

// 上传目录
const UPLOAD_BASE = path.join(__dirname, 'public', 'uploads');
// 确保目录存在
['avatar', 'image', 'voice'].forEach(dir => {
  const p = path.join(UPLOAD_BASE, dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

// 构建完整 URL
function buildFileUrl(req, relativePath) {
  const host = req.get('host') || '127.0.0.1:3000';
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/public/${relativePath.replace(/\\/g, '/')}`;
}

// multer 配置：根据上传类型切换存储子目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 从路由路径判断类型：/v1/upload/avatar → avatar, /v1/upload/image → image
    const segs = req.path.split('/').filter(Boolean);
    const type = segs[segs.length - 1] || 'image';
    const allowed = ['avatar', 'image', 'voice'];
    const dir = allowed.includes(type) ? type : 'image';
    cb(null, path.join(UPLOAD_BASE, dir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // 头像/图片只接受图片格式，语音接受音频格式
    const segs = req.path.split('/').filter(Boolean);
    const type = segs[segs.length - 1] || 'image';
    if (type === 'voice') {
      const allowed = /\.(mp3|wav|ogg|aac|m4a)$/i;
      if (!allowed.test(path.extname(file.originalname))) {
        return cb(new Error('仅支持 mp3/wav/ogg/aac/m4a 格式'));
      }
    } else {
      const allowed = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
      if (!allowed.test(path.extname(file.originalname))) {
        return cb(new Error('仅支持 jpg/png/gif/webp 图片格式'));
      }
    }
    cb(null, true);
  },
});

function handleUpload(req, res) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.json({ code: -1, message: '上传失败: ' + err.message });
      }
      return res.json({ code: -1, message: err.message || '上传失败' });
    }
    if (!req.file) {
      return res.json({ code: -1, message: '请选择文件' });
    }

    const relativePath = path.relative(path.join(__dirname, 'public'), req.file.path);
    const url = buildFileUrl(req, relativePath);

    logger.info(`[upload] ${req.file.fieldname} saved: ${url}`);

    res.json({
      code: 0,
      message: '上传成功',
      data: { url, path: req.file.path },
    });
  });
}

// 兼容前端 uploadFile 中使用的字段名（avatar / image / voice）
router.post('/avatar', (req, res) => {
  const fieldUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
  }).single('avatar');
  fieldUpload(req, res, (err) => {
    if (err) {
      return res.json({ code: -1, message: '头像上传失败: ' + (err.message || '') });
    }
    if (!req.file) {
      return res.json({ code: -1, message: '请选择头像文件' });
    }
    const relativePath = path.relative(path.join(__dirname, 'public'), req.file.path);
    const url = buildFileUrl(req, relativePath);
    logger.info(`[upload] avatar saved: ${url}`);
    res.json({
      code: 0,
      message: '上传成功',
      data: { url, path: req.file.path },
    });
  });
});

router.post('/image', (req, res) => {
  const fieldUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single('image');
  fieldUpload(req, res, (err) => {
    if (err) {
      return res.json({ code: -1, message: '图片上传失败: ' + (err.message || '') });
    }
    if (!req.file) {
      return res.json({ code: -1, message: '请选择图片文件' });
    }
    const relativePath = path.relative(path.join(__dirname, 'public'), req.file.path);
    const url = buildFileUrl(req, relativePath);
    logger.info(`[upload] image saved: ${url}`);
    res.json({
      code: 0,
      message: '上传成功',
      data: { url, path: req.file.path },
    });
  });
});

router.post('/voice', (req, res) => {
  const fieldUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
  }).single('voice');
  fieldUpload(req, res, (err) => {
    if (err) {
      return res.json({ code: -1, message: '语音上传失败: ' + (err.message || '') });
    }
    if (!req.file) {
      return res.json({ code: -1, message: '请选择语音文件' });
    }
    const relativePath = path.relative(path.join(__dirname, 'public'), req.file.path);
    const url = buildFileUrl(req, relativePath);
    logger.info(`[upload] voice saved: ${url}`);
    res.json({
      code: 0,
      message: '上传成功',
      data: { url, path: req.file.path },
    });
  });
});

module.exports = router;
