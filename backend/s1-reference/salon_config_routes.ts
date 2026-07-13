
// ==================== 沙龙配置管理 ====================
// 获取所有沙龙配置
router.get('/salon-configs', async (req: Request, res: Response) => {
  try {
    const configs = await prisma.$queryRaw<any[]>`SELECT * FROM salon_configs ORDER BY id`;
    
    const parsedConfigs = configs.map((config: any) => ({
      ...config,
      features: config.features ? JSON.parse(config.features) : null,
      registration: config.registration ? JSON.parse(config.registration) : null,
      permissions: config.permissions ? JSON.parse(config.permissions) : null,
      commission: config.commission ? JSON.parse(config.commission) : null,
      api: config.api ? JSON.parse(config.api) : null,
      theme: {
        color: config.theme_color,
        lightColor: config.theme_light_color,
        gradient: config.theme_gradient,
        bannerBg: config.theme_banner_bg,
        icon: config.theme_icon,
      },
      page: {
        list: config.page_list,
        detail: config.page_detail,
        create: config.page_create,
      },
    }));
    
    success(res, parsedConfigs, '获取成功');
  } catch (error: any) {
    console.error('[salon-config] 获取配置列表失败:', error);
    error(res, '获取配置列表失败', 500);
  }
});

// 获取单个沙龙配置
router.get('/salon-configs/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const configs = await prisma.$queryRaw<any[]>`SELECT * FROM salon_configs WHERE type = ${type}`;
    
    if (!configs || configs.length === 0) {
      return error(res, '配置不存在', 404);
    }
    
    const config = configs[0];
    const parsedConfig = {
      ...config,
      features: config.features ? JSON.parse(config.features) : null,
      registration: config.registration ? JSON.parse(config.registration) : null,
      permissions: config.permissions ? JSON.parse(config.permissions) : null,
      commission: config.commission ? JSON.parse(config.commission) : null,
      api: config.api ? JSON.parse(config.api) : null,
      theme: {
        color: config.theme_color,
        lightColor: config.theme_light_color,
        gradient: config.theme_gradient,
        bannerBg: config.theme_banner_bg,
        icon: config.theme_icon,
      },
      page: {
        list: config.page_list,
        detail: config.page_detail,
        create: config.page_create,
      },
    };
    
    success(res, parsedConfig, '获取成功');
  } catch (error: any) {
    console.error('[salon-config] 获取配置失败:', error);
    error(res, '获取配置失败', 500);
  }
});

// 创建沙龙配置
router.post('/salon-configs', async (req: Request, res: Response) => {
  try {
    const {
      type,
      name,
      description,
      emoji,
      theme,
      page,
      features,
      registration,
      permissions,
      commission,
      api,
      status,
    } = req.body;

    await prisma.$executeRaw`
      INSERT INTO salon_configs (
        type, name, description, emoji,
        theme_color, theme_light_color, theme_gradient, theme_banner_bg, theme_icon,
        page_list, page_detail, page_create,
        features, registration, permissions, commission, api,
        status
      ) VALUES (
        ${type}, ${name}, ${description}, ${emoji},
        ${theme?.color}, ${theme?.lightColor}, ${theme?.gradient}, ${theme?.bannerBg}, ${theme?.icon},
        ${page?.list}, ${page?.detail}, ${page?.create},
        ${JSON.stringify(features)}, ${JSON.stringify(registration)}, ${JSON.stringify(permissions)}, ${JSON.stringify(commission)}, ${JSON.stringify(api)},
        ${status || 'active'}
      )
    `;

    const newConfig = await prisma.$queryRaw<any[]>`SELECT * FROM salon_configs WHERE type = ${type}`;
    success(res, newConfig[0], '配置创建成功');
  } catch (error: any) {
    console.error('[salon-config] 创建配置失败:', error);
    error(res, '创建配置失败', 500);
  }
});

// 更新沙龙配置
router.put('/salon-configs/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const {
      name,
      description,
      emoji,
      theme,
      page,
      features,
      registration,
      permissions,
      commission,
      api,
      status,
    } = req.body;

    await prisma.$executeRaw`
      UPDATE salon_configs SET
        name = ${name},
        description = ${description},
        emoji = ${emoji},
        theme_color = ${theme?.color},
        theme_light_color = ${theme?.lightColor},
        theme_gradient = ${theme?.gradient},
        theme_banner_bg = ${theme?.bannerBg},
        theme_icon = ${theme?.icon},
        page_list = ${page?.list},
        page_detail = ${page?.detail},
        page_create = ${page?.create},
        features = ${JSON.stringify(features)},
        registration = ${JSON.stringify(registration)},
        permissions = ${JSON.stringify(permissions)},
        commission = ${JSON.stringify(commission)},
        api = ${JSON.stringify(api)},
        status = ${status},
        updated_at = CURRENT_TIMESTAMP
      WHERE type = ${type}
    `;

    const updatedConfig = await prisma.$queryRaw<any[]>`SELECT * FROM salon_configs WHERE type = ${type}`;
    success(res, updatedConfig[0], '配置更新成功');
  } catch (error: any) {
    console.error('[salon-config] 更新配置失败:', error);
    error(res, '更新配置失败', 500);
  }
});

// 删除沙龙配置
router.delete('/salon-configs/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    await prisma.$executeRaw`DELETE FROM salon_configs WHERE type = ${type}`;
    success(res, null, '配置删除成功');
  } catch (error: any) {
    console.error('[salon-config] 删除配置失败:', error);
    error(res, '删除配置失败', 500);
  }
});

// 启用/禁用沙龙配置
router.patch('/salon-configs/:type/status', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { status } = req.body;
    
    await prisma.$executeRaw`
      UPDATE salon_configs SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE type = ${type}
    `;
    
    const updatedConfig = await prisma.$queryRaw<any[]>`SELECT * FROM salon_configs WHERE type = ${type}`;
    success(res, updatedConfig[0], `配置已${status === 'active' ? '启用' : '禁用'}`);
  } catch (error: any) {
    console.error('[salon-config] 更新状态失败:', error);
    error(res, '更新状态失败', 500);
  }
});
