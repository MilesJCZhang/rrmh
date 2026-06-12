#!/usr/bin/env python3
"""
将 Markdown 文件转换为 PDF，包含 Mermaid 图表的渲染
使用在线 API 渲染 Mermaid 图表
"""
import re
import os
import requests
import base64
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 注册中文字体
try:
    pdfmetrics.registerFont(TTFont('SimSun', '/System/Library/Fonts/Supplemental/Songti SC.ttf'))
    chinese_font = 'SimSun'
except:
    try:
        pdfmetrics.registerFont(TTFont('SimSun', '/System/Library/Fonts/STHeiti Light.ttc'))
        chinese_font = 'SimSun'
    except:
        chinese_font = 'Helvetica'
        print("⚠️ 警告：无法加载中文字体，将使用默认字体")

def extract_mermaid_blocks(md_content):
    """提取 Markdown 中的 Mermaid 代码块"""
    pattern = r'```mermaid\n(.*?)\n```'
    blocks = re.findall(pattern, md_content, re.DOTALL)
    return blocks

def render_mermaid_online(mermaid_code, output_file):
    """使用 Kroki API 将 Mermaid 代码渲染为图片（SVG）"""
    try:
        # 使用 Kroki API（开源、稳定）
        response = requests.post(
            'https://kroki.io/mermaid/svg',
            data=mermaid_code.encode('utf-8'),
            headers={'Content-Type': 'text/plain'},
            timeout=30
        )
        
        if response.status_code == 200:
            # 保存为 SVG
            svg_file = output_file.replace('.png', '.svg')
            with open(svg_file, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ 渲染成功: {svg_file}")
            return svg_file  # 返回 SVG 文件路径
        else:
            print(f"❌ API 返回错误: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 渲染异常: {e}")
        return False

def parse_md_content(md_file, image_dir):
    """解析 Markdown 内容，提取文本和 Mermaid 图表"""
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 Mermaid 代码块
    mermaid_blocks = extract_mermaid_blocks(content)
    print(f"📊 找到 {len(mermaid_blocks)} 个 Mermaid 图表")
    
    # 渲染 Mermaid 图表
    image_files = []
    for i, mermaid_code in enumerate(mermaid_blocks):
        output_file = os.path.join(image_dir, f'mermaid_{i+1}.png')
        print(f"🎨 渲染图表 {i+1}/{len(mermaid_blocks)}...")
        if render_mermaid_online(mermaid_code, output_file):
            image_files.append(output_file)
        else:
            print(f"   跳过图表 {i+1}")
    
    # 解析 Markdown 内容（移除 Mermaid 代码块）
    text_content = re.sub(r'```mermaid\n.*?\n```', '<<MERMAID_CHART>>', content, flags=re.DOTALL)
    
    return text_content, image_files

def create_pdf(md_file, pdf_file):
    """创建包含 Mermaid 图表的 PDF"""
    # 创建临时图片目录
    image_dir = os.path.join(os.path.dirname(md_file), 'mermaid_images')
    os.makedirs(image_dir, exist_ok=True)
    
    # 解析内容
    print("📖 解析 Markdown 内容...")
    text_content, image_files = parse_md_content(md_file, image_dir)
    
    # 创建 PDF
    print("📄 创建 PDF...")
    doc = SimpleDocTemplate(pdf_file, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    
    # 定义样式
    styles = getSampleStyleSheet()
    
    if 'ChineseHeading1' not in styles:
        styles.add(ParagraphStyle(
            name='ChineseHeading1',
            fontName=chinese_font,
            fontSize=18,
            spaceAfter=12,
            spaceBefore=12
        ))
    
    if 'ChineseHeading2' not in styles:
        styles.add(ParagraphStyle(
            name='ChineseHeading2',
            fontName=chinese_font,
            fontSize=14,
            spaceAfter=10,
            spaceBefore=10
        ))
    
    if 'ChineseNormal' not in styles:
        styles.add(ParagraphStyle(
            name='ChineseNormal',
            fontName=chinese_font,
            fontSize=10,
            spaceAfter=6
        ))
    
    # 解析文本并构建 PDF 内容
    story = []
    lines = text_content.split('\n')
    image_index = 0
    in_code_block = False
    code_lines = []
    
    for line in lines:
        # 处理代码块
        if line.startswith('```'):
            if in_code_block:
                # 结束代码块
                if code_lines:
                    code_text = '\n'.join(code_lines)
                    # 这里可以添加代码格式化
                    code_lines = []
                in_code_block = False
                continue
            else:
                in_code_block = True
                continue
        
        if in_code_block:
            code_lines.append(line)
            continue
        
        # 处理 Mermaid 图表占位符
        if line.strip() == '<<MERMAID_CHART>>':
            if image_index < len(image_files) and os.path.exists(image_files[image_index]):
                img_file = image_files[image_index]
                try:
                    img = Image(img_file, width=16*cm, height=12*cm, kind='proportional')
                    story.append(Spacer(1, 0.5*cm))
                    story.append(img)
                    story.append(Spacer(1, 0.5*cm))
                except Exception as e:
                    print(f"⚠️ 插入图片失败: {img_file} - {e}")
                image_index += 1
            continue
        
        # 处理标题
        if line.startswith('# '):
            text = line[2:].strip()
            story.append(Paragraph(text, styles['ChineseHeading1']))
        elif line.startswith('## '):
            text = line[3:].strip()
            story.append(Paragraph(text, styles['ChineseHeading2']))
        elif line.startswith('### '):
            text = line[4:].strip()
            story.append(Paragraph(text, styles['ChineseHeading2']))
        # 处理列表
        elif line.startswith('- ') or line.startswith('* '):
            text = line[2:].strip()
            story.append(Paragraph(f'• {text}', styles['ChineseNormal']))
        # 处理空行
        elif line.strip() == '':
            story.append(Spacer(1, 0.2*cm))
        # 处理普通文本
        elif line.strip() and not line.strip().startswith('```'):
            try:
                story.append(Paragraph(line, styles['ChineseNormal']))
            except:
                pass
    
    # 生成 PDF
    try:
        doc.build(story)
        print(f"✅ PDF 创建成功: {pdf_file}")
        print(f"📍 文件路径: {os.path.abspath(pdf_file)}")
    except Exception as e:
        print(f"❌ PDF 创建失败: {e}")
    finally:
        # 清理临时图片
        for img_file in image_files:
            if os.path.exists(img_file):
                os.remove(img_file)
        if os.path.exists(image_dir) and not os.listdir(image_dir):
            os.rmdir(image_dir)

if __name__ == '__main__':
    md_file = '/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/docs/referral-system-flowchart.md'
    pdf_file = '/Volumes/User/MacBookAir/人人媒好/相亲小程序/miniprogram/docs/referral-system-flowchart-with-charts.pdf'
    
    print("🚀 开始转换 Markdown 到 PDF（包含 Mermaid 图表）...")
    create_pdf(md_file, pdf_file)
    print("✅ 转换完成！")
