# generate_identity_mindmap_pdf.py
# -*- coding: utf-8 -*-
# 生成《人人媒好小程序 - 访客/会员/推荐官身份申请逻辑思维导图》PDF

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ─── 注册字体 ──────────────────────────────────
# 使用 Arial Unicode（TTF，非 TTC）确保中文正常渲染
FONT_PATH = '/Library/Fonts/Arial Unicode.ttf'
FONT_NAME = 'ArialUni'
try:
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))
except Exception:
    FONT_NAME = 'Helvetica'

W, H = landscape(A4)  # 横向 A4
CANVAS_W, CANVAS_H = W, H
CENTER_X = CANVAS_W / 2

BRAND_RED = HexColor('#C8102E')
BRAND_RED_LIGHT = HexColor('#F5E6E8')
DARK = HexColor('#333333')
GRAY = HexColor('#666666')
LIGHT_BG = HexColor('#F8F8F8')
WHITE = white

OUTPUT_PATH = '/Volumes/User/MacBookAir/人人媒好/相亲小程序/人人媒好身份申请逻辑思维导图.pdf'

# ─── 辅助函数 ──────────────────────────────────
def set_font(c, name=FONT_NAME, size=12, bold=False):
    c.setFont(name, size)

def draw_text(c, x, y, text, size=12, color=DARK, align='left', bold=False):
    c.saveState()
    set_font(c, FONT_NAME, size)
    c.setFillColor(color)
    bw = c.stringWidth(text, FONT_NAME, size)
    if align == 'center':
        tx = x - bw / 2
    elif align == 'right':
        tx = x - bw
    else:
        tx = x
    c.drawString(tx, y, text)
    c.restoreState()

def draw_rounded_rect(c, x, y, w, h, r=6, fill_color=None, stroke_color=None, stroke_width=1):
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    elif stroke_color:
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

# ═══════════════════════════════════════════
# 绘制"角色全景概览"
# ═══════════════════════════════════════════
def draw_role_overview(c, page_y):
    """绘制第2页：4大角色类型全景对比"""
    col_w = (CANVAS_W - 80) / 4
    col_gap = 10
    start_x = 40
    y = page_y - 30

    draw_text(c, CENTER_X, y + 30, '四大角色类型全景对比', 16, BRAND_RED, 'center')
    draw_text(c, CENTER_X, y + 12, '人人媒好小程序 · 身份体系总览', 10, GRAY, 'center')

    roles = [
        {
            'title': '访客 / 游客',
            'title_color': HexColor('#999999'),
            'points': [
                '未登录或 token 未建档',
                '可浏览首页、沙龙列表',
                '无推荐人绑定关系',
                '不可查看会员匹配',
                '可通过扫码或推荐码进入',
                '自动记录访客日志',
                '退出后清除所有状态',
            ],
            'exit_path': '扫码/链接进入 → 浏览 → 引导注册',
        },
        {
            'title': '单身会员',
            'title_color': HexColor('#E67E22'),
            'points': [
                '已登录+已建档（hasProfile=true）',
                '微信登录获取 openid+token',
                '建档费 ¥199 确保真实性',
                '需绑定推荐官（扫码/输入推荐码）',
                '推荐关系永久锁定不可更换',
                '可完善80+维度个人档案',
                'AI画像评分（0-100分六维）',
                '可参加沙龙、解锁匹配',
            ],
            'exit_path': '登录 → 填资料/支付 → 成为会员',
        },
        {
            'title': '推荐官体系（5种）',
            'title_color': HexColor('#C8102E'),
            'points': [
                '5种身份：公益/联创/专业/社区/城市',
                '等级值：user→公益→联创→社区→专业→城市(10→30→40→50→60→80)',
                '每种身份有独立入驻费和收益规则',
                '推荐建档得 ¥99/人（通用）',
                '推荐关系永久锁定',
            ],
            'exit_path': '用户/会员 → 申请 → 审核/支付 → 推荐官',
        },
        {
            'title': '管理员',
            'title_color': HexColor('#2C3E50'),
            'points': [
                '后端管理后台',
                'admin-panel 管理',
                '管理用户/推荐官/订单/佣金',
                '管理沙龙/评分规则',
                '分配邀请码给推荐官',
                '审核社区服务站申请',
                '审核实名认证',
            ],
            'exit_path': '无申请入口，后台直接配置',
        },
    ]

    for i, role in enumerate(roles):
        cx = start_x + i * (col_w + col_gap)
        # 标题
        draw_rounded_rect(c, cx, y - 18, col_w, 28, 6, role['title_color'], role['title_color'])
        draw_text(c, cx + 10, y - 10, role['title'], 12, WHITE)

        # 内容
        lines = role['points']
        line_h = 15
        box_h = len(lines) * line_h + 40
        draw_rounded_rect(c, cx, y - 18 - box_h, col_w, box_h, 6, LIGHT_BG, GRAY, 0.3)

        for j, pt in enumerate(lines):
            draw_text(c, cx + 8, y - 18 - 14 - j * line_h, '• ' + pt, 8, DARK)

        # 底部路径
        exit_text = role['exit_path']
        exit_w = c.stringWidth(exit_text, FONT_NAME, 7)
        draw_text(c, cx + 8, y - 18 - box_h + 5, '→ ' + exit_text, 7, HexColor('#8E44AD'))

    return y - 18 - 220

# ═══════════════════════════════════════════
# 绘制"访客 → 会员 流程图"
# ═══════════════════════════════════════════
def draw_guest_to_member_flow(c, y_pos):
    """第3页：访客到会员的完整流转"""
    start_x = 50
    box_w = 105
    gap = 20
    box_h = 60

    draw_text(c, CENTER_X, y_pos + 20, '访客 → 单身会员 · 完整注册流程', 16, BRAND_RED, 'center')

    steps = [
        ('扫码/分享\n进入小程序', '#9B59B6'),
        ('微信登录\n获取openid+token', '#3498DB'),
        ('绑定推荐人\n扫码/输入推荐码', '#1ABC9C'),
        ('填写个人资料\n5步80+维度', '#E67E22'),
        ('支付建档费\n¥199', '#C8102E'),
        ('成为单身会员\n解锁匹配+沙龙', '#27AE60'),
    ]

    for i, (label, color) in enumerate(steps):
        cx = start_x + i * (box_w + gap)
        color_hex = HexColor(color)
        draw_rounded_rect(c, cx, y_pos - box_h, box_w, box_h, 8, color_hex, color_hex)
        draw_text(c, cx + box_w / 2, y_pos - 18, label, 9, WHITE, 'center')
        # 箭头（向右）
        if i < len(steps) - 1:
            arrow_start_x = cx + box_w + 3
            arrow_end_x = cx + box_w + gap - 3
            ay = y_pos - box_h / 2
            c.saveState()
            c.setStrokeColor(HexColor('#999'))
            c.setLineWidth(1.5)
            c.line(arrow_start_x, ay, arrow_end_x, ay)
            # 箭头三角
            c.line(arrow_end_x - 5, ay - 4, arrow_end_x, ay)
            c.line(arrow_end_x - 5, ay + 4, arrow_end_x, ay)
            c.restoreState()

    # 详细说明
    detail_y = y_pos - box_h - 30
    details = [
        ('扫码/分享进入', '支持小程序码、普通二维码、公众号文章链接。scene参数解析推荐人ID或推荐码。访客日志自动上报。'),
        ('微信登录', 'wx.login() 获取临时 code → 后端 /v1/auth/wechat-login 换取 openid + token。登录成功后同步触发推荐关系绑定。'),
        ('绑定推荐人', '核心规则：扫码必绑定、永久锁定、不可更换。支持 direct_referrer_id 和 referral_code 两种方式。已锁定时拒绝新绑定。'),
        ('填写个人资料', '5步免费建档：基础信息 → 职业收入 → 兴趣偏好 → 认证资料 → 资产证明。全选填，实时计算80+维度AI画像评分。'),
        ('支付建档费', '会员建档费 ¥199（统一价）。创建支付订单 → 微信支付 → 支付成功回调 → 更新用户状态为 unlock。'),
        ('成为会员', '解锁后可查看匹配推荐、报名沙龙活动。享AI画像评分满分100分（六维：婚恋/家境/收入/形象/修养/性格）。'),
    ]

    for i, (title, desc) in enumerate(details):
        row_y = detail_y - i * 32
        draw_rounded_rect(c, 40, row_y - 24, CANVAS_W - 80, 28, 4, LIGHT_BG if i % 2 == 0 else WHITE)
        draw_text(c, 50, row_y - 17, title, 10, BRAND_RED)
        draw_text(c, 160, row_y - 17, desc, 8, DARK)

    return detail_y - 6 * 32 - 20

# ═══════════════════════════════════════════
# 绘制"5种推荐官身份申请对比"
# ═══════════════════════════════════════════
def draw_matchmaker_roles_detail(c, y_pos):
    """第4页：5种推荐官身份详细对比表"""
    draw_text(c, CENTER_X, y_pos + 20, '五种推荐官身份 · 申请条件与流程对比', 16, BRAND_RED, 'center')

    roles_data = [
        ['公益推荐官', '免费\n/ 自动审核', '无', '直接申请\n配推荐码', '推荐建档 ¥99/人\n提现扣13%', '需姓名/性别\n年龄/手机号'],
        ['联创推荐官', '¥399\n/ 支付后审核', '无', '申请+支付399\n→实名认证', '推荐建档 ¥99\n+沙龙补贴 ¥99/次\n+推荐联创 ¥399/人\n+推荐社区服务站权益', '需补充身份证\n微信号+经验+渠道+收款账户'],
        ['专业推荐官', '¥3999\n/支付后审核', '需由公益/联创\n/社区升级', '从现有身份升级\n+支付3999', '推荐建档 ¥99\n+推荐联创 ¥399/人\n+推荐城市合伙人 ¥1万\n+永久3%沉淀分红', '需全字段+资质\n+经验+渠道'],
        ['社区服务站', '免费\n/审核制(1-3天)', '必须由联创\n推荐官推荐', '提交申请\n待审核', '推荐建档 ¥99\n+自身10%沉淀资金\n+联创推荐人10%', '需单位信息\n+负责人信息+地址'],
        ['城市合伙人', '¥10,000\n/支付后审核', '需由专业推荐\n官推荐', '申请+支付1万\n+审核', '推荐建档 ¥99\n+承办沙龙(到手¥200/人)\n+区域沉淀资金70%', '需公司/个体+经验\n+运营方案+城市'],
    ]

    headers = ['身份名称', '入驻费', '推荐人\n要求', '申请流程', '核心收益', '必填字段']

    col_widths = [70, 55, 60, 75, 130, 80]
    total_w = sum(col_widths)
    start_x = (CANVAS_W - total_w) / 2

    # 表头
    row_h = 32
    header_y = y_pos - 10
    x = start_x
    for i, header in enumerate(headers):
        draw_rounded_rect(c, x, header_y - row_h, col_widths[i], row_h, 0, BRAND_RED, BRAND_RED)
        draw_text(c, x + col_widths[i] / 2, header_y - row_h + 8, header, 8, WHITE, 'center')
        x += col_widths[i]

    # 数据行
    current_y = header_y - row_h
    for row_idx, row in enumerate(roles_data):
        row_color = HexColor('#FFF5F5') if row_idx % 2 == 0 else WHITE
        x = start_x
        row_height = 58

        draw_rounded_rect(c, x, current_y - row_height, total_w, row_height, 0, row_color, HexColor('#E8E8E8'), 0.3)

        for col_idx, cell in enumerate(row):
            lines = cell.split('\n')
            line_count = len(lines)
            for li, line in enumerate(lines):
                is_title = col_idx == 0
                txt_color = BRAND_RED if is_title else DARK
                txt_size = 7.5
                line_y = current_y - 10 - (line_count - li - 1) * 13
                fw = col_widths[col_idx]
                draw_text(c, x + fw / 2, line_y - 2, line, txt_size, txt_color, 'center')

            x += col_widths[col_idx]

        current_y -= row_height

    return current_y - 20

# ═══════════════════════════════════════════
# 绘制"角色升级链路"
# ═══════════════════════════════════════════
def draw_role_upgrade_path(c, y_pos):
    """第5页：角色升级链路图"""
    draw_text(c, CENTER_X, y_pos + 20, '推荐官角色升级链路与准入规则', 16, BRAND_RED, 'center')

    roles = [
        ('普通会员\n/ 用户', '#95A5A6', 60, ['公益推荐官(免费)', '联创推荐官(¥399)', '社区服务站(联创推荐)']),
        ('公益推荐官', '#27AE60', 100, ['联创推荐官(¥399)', '专业推荐官(¥3,999)', '城市合伙人(¥10,000)']),
        ('联创推荐官', '#3498DB', 150, ['专业推荐官(¥3,999)', '城市合伙人(¥10,000)']),
        ('社区服务站', '#8E44AD', 200, ['专业推荐官(¥3,999)', '城市合伙人(¥10,000)']),
        ('专业推荐官', '#E67E22', 260, ['城市合伙人(¥10,000)']),
        ('城市合伙人', '#C8102E', 320, ['— 顶级身份 —']),
    ]

    node_w = 130
    node_h = 48
    left_x = 50
    arrow_x = left_x + node_w + 10

    for i, (name, color, y_offset, upgrades) in enumerate(roles):
        cy = y_pos - 10 - y_offset
        color_hex = HexColor(color)

        # 节点
        draw_rounded_rect(c, left_x, cy - node_h, node_w, node_h, 8, color_hex, WHITE, 1.5)
        draw_text(c, left_x + node_w / 2, cy - node_h / 2 - 6, name, 10, WHITE, 'center')

        # 升级箭头和可升级目标
        for j, upgrade in enumerate(upgrades):
            uy = cy - 8 + j * 14
            c.saveState()
            c.setStrokeColor(HexColor('#999'))
            c.setLineWidth(1)
            c.line(arrow_x, uy, arrow_x + 20, uy)
            c.line(arrow_x + 16, uy - 3, arrow_x + 20, uy)
            c.line(arrow_x + 16, uy + 3, arrow_x + 20, uy)
            c.restoreState()
            draw_text(c, arrow_x + 25, uy - 4, '→ ' + upgrade, 7.5, DARK)

    # 底部说明
    note_y = y_pos - 380
    notes = [
        '升级规则：城市合伙人和专业推荐官只能从现有推荐官身份升级，不能从普通会员直接申请。',
        '社区服务站申请条件：必须已有联创推荐官身份，或由联创推荐官推荐（永久享受其所在社区沉淀资金10%）。',
        '推荐联创推荐官规则：第1个推荐无收益，第2个起得 ¥399/人。',
        '推荐城市合伙人规则（专业推荐官专属）：第1个推荐无收益，第2个起得 ¥10,000 + 永久3%沉淀分红。',
        '推荐关系锁定：扫码推荐关系一经确认永久锁定，不可更改。新绑定请求若已有关系则直接拒绝。',
    ]

    for i, note in enumerate(notes):
        draw_text(c, 50, note_y - i * 16, '• ' + note, 8, GRAY)

    return note_y - 5 * 16 - 10

# ═══════════════════════════════════════════
# 绘制"核心业务逻辑"
# ═══════════════════════════════════════════
def draw_core_business_flow(c, y_pos):
    """第6页：核心业务逻辑"""
    draw_text(c, CENTER_X, y_pos + 20, '身份核心业务逻辑详解', 16, BRAND_RED, 'center')

    sections = [
        ('访客行为记录', [
            '扫码/链接进入时自动调用 logVisitor 上报访客日志',
            '记录 referrer_code, visitor_openid, nickname, avatar',
            '上报成功后清除 pending 标记，避免重复上报',
            '访客仅能浏览首页和沙龙列表，无法使用匹配功能',
        ]),
        ('推荐关系绑定', [
            '两种绑定方式：direct_referrer_id 和 referral_code（推荐码）',
            '推荐码前缀规则：GYRG=公益, LCRG=联创, ZYRG=专业, SQZD=社区, CSHH=城市',
            '扫码 scene 参数支持多种格式解析：URL参数、下划线分隔、纯数字/纯推荐码',
            '绑定后永久锁定，Storage持久化存储 referrer_id + referrer_locked + bind_time',
            '静默绑定失败时缓存到 Storage，避免重复请求后端',
        ]),
        ('评分系统与档案', [
            '访客/会员填写 5 步 80+ 维度资料，全选填、免费',
            'AI 画像评分六维度：婚恋观 / 家境背景 / 收入水平 / 形象气质 / 修养内涵 / 性格特质',
            '满分 100 分，实时计算并存储到 profile_score',
            '评分影响匹配推荐的分层展示（Tier Access）',
        ]),
        ('高端验资匹配', [
            '面向高端用户的独立子包，与普通会员流程分离',
            '需提交验资资料 → 审核 → 开始 AI 匹配 → 确认匹配对象',
            '可选创建10万基金托管服务',
            '与推荐建档的核心流程完全独立',
        ]),
        ('沙龙活动参与', [
            '会员可报名参与沙龙，支付门票（优惠价 ¥299 / 正价 ¥399）',
            '联创推荐官名下的会员参加沙龙，联创得 ¥99/人次补贴',
            '城市合伙人可承办沙龙，获得门票收益（到手 ¥200/人）',
            '沙龙配置动态管理：圈层主题 / 男性主题 / 女性主题',
        ]),
        ('收益分配与提现', [
            '推荐建档 ¥99/人（所有推荐官通用，无首推限制）',
            '推荐联创推荐官：第1个无收益，第2个起 ¥399/人',
            '推荐社区服务站（联创专属）：永久享推荐服务站沉淀资金10%',
            '推荐城市合伙人（专业推荐官专属）：第2个起 ¥10,000 + 永久3%分红',
            '沙龙补贴 ¥99/次（联创推荐官名下会员）',
            '提现扣除13%平台服务费（公益/联创/专业/社区），城市合伙人直接拿净额70%',
        ]),
    ]

    sec_w = (CANVAS_W - 100) / 2
    sec_h = 110
    sec_gap_x = 20
    sec_gap_y = 15

    for i, (title, points) in enumerate(sections):
        col = i % 2
        row = i // 2
        sx = 50 + col * (sec_w + sec_gap_x)
        sy = y_pos - 15 - row * (sec_h + sec_gap_y)

        draw_rounded_rect(c, sx, sy - sec_h, sec_w, sec_h, 6, LIGHT_BG, GRAY, 0.3)
        draw_rounded_rect(c, sx, sy - sec_h, sec_w, 22, 6, BRAND_RED, BRAND_RED)
        draw_rounded_rect(c, sx, sy - sec_h + 11, sec_w, 11, 0, BRAND_RED, BRAND_RED)
        draw_text(c, sx + 8, sy - sec_h + 5, title, 10, WHITE)

        for j, pt in enumerate(points):
            draw_text(c, sx + 8, sy - sec_h + 28 + j * 13, '• ' + pt, 7, DARK)

    last_row = (len(sections) + 1) // 2
    return y_pos - 15 - last_row * (sec_h + sec_gap_y) - 20

# ═══════════════════════════════════════════
# 绘制"关键数据表关联"
# ═══════════════════════════════════════════
def draw_data_tables(c, y_pos):
    """第7页：身份相关关键数据表"""
    draw_text(c, CENTER_X, y_pos + 20, '身份相关核心数据表结构', 16, BRAND_RED, 'center')

    tables = [
        ('users', '用户主表', 'id, openid, nickname, avatar, role, phone, gender,\nrecommended_by, has_profile, is_verified, verification_level'),
        ('profiles', '会员档案表', 'id, user_id, marital_status, income_level, education,\nheight, occupation, property, health_tags'),
        ('scores', 'AI画像评分表', 'id, user_id, total_score, tier,\nmarriage_score, family_score, income_score,\nappearance_score, cultivation_score, character_score'),
        ('referral_relations', '推荐关系表', 'id, referrer_id, member_id, bind_time,\nis_locked, referral_code'),
        ('referral_codes', '推荐码表', 'id, user_id, code, code_type,\nis_active, use_count, max_uses'),
        ('roles', '角色表', 'id, user_id, role_name, created_at,\nstatus, is_active'),
        ('matchmaker_applies', '推荐官申请表', 'id, user_id, target_role, status,\nreal_name, phone, experience,\nchannel, wechat, bank_account'),
        ('payments', '支付表', 'id, user_id, type, amount, status,\norder_no, pay_type, extra_info'),
        ('verifications', '实名认证表', 'id, user_id, real_name, id_number,\nstatus, level, face_auth_status'),
        ('commissions', '佣金表', 'id, from_user_id, to_user_id, type, amount,\nstatus, settled_at, related_order_id'),
    ]

    col_widths = [80, 100, 230]
    total_w = sum(col_widths)
    start_x = (CANVAS_W - total_w) / 2

    # 表头
    row_h = 22
    header_y = y_pos - 10
    x = start_x
    headers = ['表名', '说明', '关键字段']
    for i, header in enumerate(headers):
        draw_rounded_rect(c, x, header_y - row_h, col_widths[i], row_h, 0, BRAND_RED, BRAND_RED)
        draw_text(c, x + col_widths[i] / 2, header_y - row_h + 5, header, 9, WHITE, 'center')
        x += col_widths[i]

    current_y = header_y - row_h
    for row_idx, row in enumerate(tables):
        row_color = HexColor('#FFF5F5') if row_idx % 2 == 0 else WHITE
        x = start_x
        row_height = 36

        draw_rounded_rect(c, x, current_y - row_height, total_w, row_height, 0, row_color, HexColor('#E8E8E8'), 0.3)

        for col_idx, cell in enumerate(row):
            txt_size = 7.5 if col_idx == 2 else 8
            txt_color = BRAND_RED if col_idx == 0 else DARK
            fw = col_widths[col_idx]
            if '\n' in cell:
                for li, line in enumerate(cell.split('\n')):
                    draw_text(c, x + 6, current_y - 12 - (li == 1 and 14 or 0), line, txt_size - 1, txt_color)
            else:
                draw_text(c, x + 6, current_y - row_height + 9, cell, txt_size, txt_color)
            x += col_widths[col_idx]

        current_y -= row_height

    return current_y - 10

# ═══════════════════════════════════════════
# 主绘制函数
# ═══════════════════════════════════════════
def generate_pdf():
    c = canvas.Canvas(OUTPUT_PATH, pagesize=landscape(A4))

    # ── 第1页：封面 ──
    c.saveState()
    c.setFillColor(BRAND_RED)
    c.rect(0, 0, CANVAS_W, CANVAS_H, fill=1, stroke=0)
    draw_text(c, CENTER_X, CANVAS_H / 2 + 60, '人人媒好小程序', 36, WHITE, 'center')
    draw_text(c, CENTER_X, CANVAS_H / 2 + 10, '访客 · 单身会员 · 推荐官身份申请逻辑', 20, HexColor('#FFD0D0'), 'center')
    draw_text(c, CENTER_X, CANVAS_H / 2 - 30, '思维导图', 28, WHITE, 'center')
    draw_text(c, CENTER_X, CANVAS_H / 2 - 80, '版本 v1.0.15', 14, HexColor('#FFD0D0'), 'center')
    draw_text(c, CENTER_X, CANVAS_H / 2 - 140, '涵盖四大角色 | 五种推荐官 | 升级链路 | 收益规则 | 数据表结构', 12, HexColor('#FFD0D0'), 'center')

    c.saveState()
    c.setStrokeColor(HexColor('#FFD0D0'))
    c.setLineWidth(0.5)
    c.line(CANVAS_W / 2 - 150, CANVAS_H / 2 - 100, CANVAS_W / 2 + 150, CANVAS_H / 2 - 100)
    c.restoreState()

    c.restoreState()
    c.showPage()

    # ── 第2页：角色全景概览 ──
    page_y = CANVAS_H - 30
    draw_role_overview(c, page_y)
    c.showPage()

    # ── 第3页：访客→会员流程 ──
    page_y = CANVAS_H - 30
    draw_guest_to_member_flow(c, page_y)
    c.showPage()

    # ── 第4页：5种推荐官对比 ──
    page_y = CANVAS_H - 30
    draw_matchmaker_roles_detail(c, page_y)
    c.showPage()

    # ── 第5页：升级链路 ──
    page_y = CANVAS_H - 30
    draw_role_upgrade_path(c, page_y)
    c.showPage()

    # ── 第6页：核心业务逻辑 ──
    page_y = CANVAS_H - 30
    draw_core_business_flow(c, page_y)
    c.showPage()

    # ── 第7页：数据表 ──
    page_y = CANVAS_H - 30
    draw_data_tables(c, page_y)
    c.showPage()

    c.save()
    print(f'PDF 已生成: {OUTPUT_PATH}')
    print(f'文件大小: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB')

if __name__ == '__main__':
    generate_pdf()
