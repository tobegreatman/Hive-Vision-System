import { z } from 'zod';
/** 3D 向量：元组保证长度恒为 3，避免 any[] 泄漏到渲染层。 */
export declare const vec3Schema: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
export type Vec3 = z.infer<typeof vec3Schema>;
/** 仅接受 #RRGGBB，防止非法的 CSS 颜色穿透到 three 的 Color 构造器。 */
export declare const hexColorSchema: z.ZodString;
export declare const isoDateSchema: z.ZodString;
export declare const objectIdSchema: z.ZodString;
//# sourceMappingURL=primitives.d.ts.map