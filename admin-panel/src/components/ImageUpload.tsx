import React, { useState, useEffect } from 'react';
import { Upload, message, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import axios from '../utils/axios.config';

const { Text } = Typography;

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  maxSizeMB?: number;
  accept?: string;
  tip?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value = '',
  onChange,
  maxSizeMB = 2,
  accept = 'image/jpeg,image/png,image/webp',
  tip = `支持 jpg、png、webp 格式，大小不超过 ${maxSizeMB}MB`,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // 初始化文件列表
  useEffect(() => {
    if (value) {
      setFileList([
        {
          uid: '-1',
          name: value.split('/').pop() || 'image',
          status: 'done',
          url: value,
        },
      ]);
    } else {
      setFileList([]);
    }
  }, [value]);

  // 自定义上传
  const handleUpload = async (file: File) => {
    // 检查文件类型
    const isValidType = accept.split(',').some(type => {
      const ext = type.trim().split('/')[1];
      return file.name.toLowerCase().endsWith(`.${ext}`);
    });
    if (!isValidType && !file.type.startsWith('image/')) {
      message.error(`只支持 ${accept.split(',').map(t => t.split('/')[1]).join('、')} 格式`);
      return false;
    }

    // 检查文件大小
    const isLtMaxSize = file.size / 1024 / 1024 < maxSizeMB;
    if (!isLtMaxSize) {
      message.error(`图片大小不能超过 ${maxSizeMB}MB`);
      return false;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res: any = await axios.post('/v1/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.code === 0 || res.code === 200 || res.success) {
        const url = res.data?.url || '';
        if (!url) {
          message.error('上传成功但未获取到图片地址');
          return;
        }
        // 立即更新 fileList 显示预览，不等 form value 回传
        setFileList([{
          uid: '-1',
          name: url.split('/').pop() || 'image',
          status: 'done' as const,
          url: url,
        }]);
        onChange?.(url);
        message.success('上传成功');
      } else {
        message.error(res.message || '上传失败');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '上传失败，请重试');
    } finally {
      setLoading(false);
    }

    return false; // 阻止自动上传
  };

  const handleRemove = () => {
    onChange?.('');
    setFileList([]);
  };

  const handlePreview = () => {
    if (value) {
      setPreviewUrl(value);
    }
  };

  const uploadProps: UploadProps = {
    listType: 'picture-card',
    fileList,
    beforeUpload: handleUpload as any,
    onRemove: handleRemove,
    maxCount: 1,
  };

  return (
    <div>
      <Upload {...uploadProps}>
        {fileList.length === 0 && (
          <div>
            {loading ? <UploadOutlined spin /> : <UploadOutlined />}
            <div style={{ marginTop: 8 }}>上传图片</div>
          </div>
        )}
      </Upload>

      {value && (
        <Space style={{ marginTop: 8 }}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={handlePreview}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={handleRemove}
          >
            删除
          </Button>
        </Space>
      )}

      <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
        {tip}
      </Text>

      {/* 图片预览 */}
      {previewUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPreviewUrl('')}
        >
          <img
            src={previewUrl}
            style={{ maxWidth: '90%', maxHeight: '90%' }}
            alt="preview"
          />
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
