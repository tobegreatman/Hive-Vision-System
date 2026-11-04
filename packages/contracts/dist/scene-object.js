import { z } from 'zod';
import { hexColorSchema, isoDateSchema, objectIdSchema, vec3Schema } from './primitives.js';
/** 实体类型，决定渲染时的几何体与材质策略。 */
export const sceneObjectKindSchema = z.enum(['core', 'satellite', 'beacon']);
export const sceneObjectSchema = z.object({
    id: objectIdSchema,
    name: z.string().min(1).max(32),
    kind: sceneObjectKindSchema,
    color: hexColorSchema,
    position: vec3Schema,
    radius: z.number().min(0.1).max(5),
    intensity: z.number().min(0).max(5),
    tags: z.array(z.string().min(1).max(16)).max(8),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
});
/**
 * 创建入参：带 default 的字段在 input 侧是可选的，
 * 因此表单用 `CreateSceneObjectPayload`，服务端解析后用 `CreateSceneObjectCommand`。
 */
export const createSceneObjectInputSchema = z.object({
    name: z.string().trim().min(1, '名称不能为空').max(32, '名称最长 32 字符'),
    kind: sceneObjectKindSchema.default('core'),
    color: hexColorSchema.default('#67e8f9'),
    radius: z.number().min(0.2).max(2).default(0.7),
    intensity: z.number().min(0).max(4).default(1.8),
    tags: z.array(z.string().trim().min(1).max(16)).max(8).default([]),
});
export const updateSceneObjectInputSchema = z
    .object({
    color: hexColorSchema,
    intensity: z.number().min(0).max(4),
})
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
    message: '至少需要提供一个可更新字段',
});
/** 拾取后放大面板所需的运行时统计，由服务端记录，不在前端伪造。 */
export const sceneObjectInspectorSchema = z.object({
    objectId: objectIdSchema,
    visits: z.number().int().nonnegative(),
    lastVisitedAt: isoDateSchema.nullable(),
    neighbors: z.number().int().nonnegative(),
    distanceToOrigin: z.number().nonnegative(),
});
//# sourceMappingURL=scene-object.js.map