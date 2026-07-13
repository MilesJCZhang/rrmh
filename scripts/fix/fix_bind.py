#!/usr/bin/env python3
"""Fix bind endpoint to support referrer_id"""
with open("/home/ubuntu/renrenmeihao-api/src/routes/referral.ts", "r") as f:
    content = f.read()

old_text = """      else {
        return error(res, '\u8bf7\u63d0\u4f9b\u63a8\u8350\u7801', 400);
      }"""

new_text = """      // \u65b9\u5f0f3\uff1a\u901a\u8fc7 referrer_id \u76f4\u63a5\u7ed1\u5b9a
      else if (req.body.referrer_id) {
        const rid = parseInt(req.body.referrer_id);
        if (!rid || isNaN(rid)) {
          return error(res, '\u63a8\u8350\u4ebaID\u65e0\u6548', 400);
        }
        const referrer = await prisma.user.findUnique({ where: { id: rid } });
        if (!referrer) {
          return error(res, '\u63a8\u8350\u4eba\u4e0d\u5b58\u5728', 400);
        }
        referrerId = rid;
      }
      else {
        return error(res, '\u8bf7\u63d0\u4f9b\u63a8\u8350\u7801', 400);
      }"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open("/home/ubuntu/renrenmeihao-api/src/routes/referral.ts", "w") as f:
        f.write(content)
    print("SUCCESS: bind endpoint updated")
else:
    print("FAIL: Could not find target text")
    # Search for similar content
    import re
    for m in re.finditer(r'else \{[\s\S]{0,200}请提供推荐码', content):
        print("Found:", repr(m.group()[:100]))
