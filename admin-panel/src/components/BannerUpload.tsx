import React, { useState, useEffect } from 'react';
import { Upload, message, Button, Input, Select, Space, Typography, Card } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import axios from '../utils/axios.config';

const { Text } = Typography;

// 页面链接选项
const PAGE_OPTIONS = [
  { label: '不跳转', value: '' },
  { label: '首页', value: '/pages/index/index' },
  { label: '会员档案', value: '/pages/dating/index' },
  { label: '沙龙列表', value: '/pages/salon/list/index' },
  { label: '沙龙详情', value: '/pages/salon/detail/index' },
  { label: '个人中心', value: '/pages/profile/index' },
  { label: '会员中心', value: '/pages/member/index' },
  { label: '关于我们', value: '/pages/about/index' },
  { label: '外部链接', value: '__external__' },
];

interface BannerItem {
  url: string;
  link: string;
  externalUrl?: string;
}

interface BannerUploadProps {
  value?: string; // JSON字符串：[{url, link, externalUrl}]
  onChange?: (value: string) => void;
  maxSizeMB?: number;
  accept?: string;
  maxCount?: number;
}

const BannerUpload: React.FC<BannerUploadProps> = ({
  value = '[]',
  onChange,
  maxSizeMB = 2,
  accept = 'image/jpeg,image/png,image/webp',
  maxCount = 5,
}) => {
  const [bannerList, setBannerList] = useState<BannerItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // 解析value
  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) {
        setBannerList(parsed);
      }
    } catch {
      setBannerList([]);
    }
  }, [value]);

  // 触发onChange
  const triggerChange = (list: BannerItem[]) => {
    setBannerList(list);
    onChange?.(JSON.stringify(list));
  };

  // 上传图片
  const uploadImage = async (file: File): Promise<string> => {
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res: any = await axios.post('/v1/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.code === 0 || res.code === 200 || res.success) {
        // 后端返回格式: { code: 0, data: { url: '...' }, message: '...' }
        const url = res.data?.url || '';
        if (!url) {
          throw new Error('上传成功但未获取到图片地址');
        }
        return url;
      } else {
        throw new Error(res.message || '上传失败');
      }
    } catch (err: any) {
      message.error(err.message || '上传失败');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = async (file: File) => {
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

    // 检查数量限制
    if (bannerList.length >= maxCount) {
      message.error(`最多上传 ${maxCount} 张轮播图`);
      return false;
    }

    try {
      const url = await uploadImage(file);
      triggerChange([...bannerList, { url, link: '' }]);
      message.success('上传成功');
    } catch {
      // 错误已在uploadImage中处理
    }

    return false;
  };

  // 删除轮播图
  const handleRemove = (index: number) => {
    const newList = [...bannerList];
    newList.splice(index, 1);
    triggerChange(newList);
  };

  // 更新链接
  const handleLinkChange = (index: number, link: string, externalUrl?: string) => {
    const newList = [...bannerList];
    newList[index] = {
      ...newList[index],
      link,
      externalUrl: link === '__external__' ? externalUrl : undefined,
    };
    triggerChange(newList);
  };

  // 更新外部链接
  const handleExternalUrlChange = (index: number, externalUrl: string) => {
    const newList = [...bannerList];
    newList[index] = {
      ...newList[index],
      externalUrl,
    };
    triggerChange(newList);
  };

  // 上移
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...bannerList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    triggerChange(newList);
  };

  // 下移
  const handleMoveDown = (index: number) => {
    if (index === bannerList.length - 1) return;
    const newList = [...bannerList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    triggerChange(newList);
  };

  return (
    <div>
      {/* 轮播图列表 */}
      {bannerList.map((item, index) => (
        <Card
          key={index}
          size="small"
          style={{ marginBottom: 12 }}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* 图片预览 */}
            <div
              style={{
                width: 120,
                height: 64,
                backgroundImage: `url(${item.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: 4,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => setPreviewUrl(item.url)}
            />

            {/* 链接配置 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <LinkOutlined style={{ color: '#1890ff' }} />
                <Select
                  value={item.link}
                  onChange={(value) => handleLinkChange(index, value)}
                  placeholder="选择跳转页面"
                  style={{ width: 200 }}
                  size="small"
                  options={PAGE_OPTIONS}
                />
              </div>

              {/* 外部链接输入 */}
              {item.link === '__external__' && (
                <Input
                  value={item.externalUrl || ''}
                  onChange={(e) => handleExternalUrlChange(index, e.target.value)}
                  placeholder="请输入外部链接（http:// 或 https://）"
                  size="small"
                  style={{ marginTop: 4 }}
                />
              )}

              {/* 排序按钮 */}
              <div style={{ marginTop: 8 }}>
                <Button
                  type="link"
                  size="small"
                  disabled={index === 0}
                  onClick={() => handleMoveUp(index)}
                >
                  上移
                </Button>
                <Button
                  type="link"
                  size="small"
                  disabled={index === bannerList.length - 1}
                  onClick={() => handleMoveDown(index)}
                >
                  下移
                </Button>
              </div>
            </div>

            {/* 删除按钮 */}
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(index)}
            >
              删除
            </Button>
          </div>
        </Card>
      ))}

      {/* 上传按钮 */}
      {bannerList.length < maxCount && (
        <Upload
          accept={accept}
          showUploadList={false}
          beforeUpload={handleFileChange as any}
          maxCount={1}
        >
          <Button
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={uploading}
          >
            上传轮播图 ({bannerList.length}/{maxCount})
          </Button>
        </Upload>
      )}

      <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
        支持 JPG、PNG、WebP 格式，大小不超过 {maxSizeMB}MB，建议尺寸 750×400px，最多上传 {maxCount} 张
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

export default BannerUpload;
