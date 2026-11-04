import { z } from 'zod';
/** 3D 向量：元组保证长度恒为 3，避免 any[] 泄漏到渲染层。 */
export const vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
/** 仅接受 #RRGGBB，防止非法的 CSS 颜色穿透到 three 的 Color 构造器。 */
export const hexColorSchema = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '必须为 #RRGGBB 形式的十六进制颜色');
export const isoDateSchema = z.string().datetime({ offset: true });
export const objectIdSchema = z.string().uuid();
//# sourceMappingURL=primitives.js.map