import { z } from 'zod';
/** 实体类型，决定渲染时的几何体与材质策略。 */
export declare const sceneObjectKindSchema: z.ZodEnum<["core", "satellite", "beacon"]>;
export type SceneObjectKind = z.infer<typeof sceneObjectKindSchema>;
export declare const sceneObjectSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["core", "satellite", "beacon"]>;
    color: z.ZodString;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    radius: z.ZodNumber;
    intensity: z.ZodNumber;
    tags: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    kind: "core" | "satellite" | "beacon";
    color: string;
    position: [number, number, number];
    radius: number;
    intensity: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    name: string;
    kind: "core" | "satellite" | "beacon";
    color: string;
    position: [number, number, number];
    radius: number;
    intensity: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}>;
export type SceneObject = z.infer<typeof sceneObjectSchema>;
/**
 * 创建入参：带 default 的字段在 input 侧是可选的，
 * 因此表单用 `CreateSceneObjectPayload`，服务端解析后用 `CreateSceneObjectCommand`。
 */
export declare const createSceneObjectInputSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodDefault<z.ZodEnum<["core", "satellite", "beacon"]>>;
    color: z.ZodDefault<z.ZodString>;
    radius: z.ZodDefault<z.ZodNumber>;
    intensity: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "core" | "satellite" | "beacon";
    color: string;
    radius: number;
    intensity: number;
    tags: string[];
}, {
    name: string;
    kind?: "core" | "satellite" | "beacon" | undefined;
    color?: string | undefined;
    radius?: number | undefined;
    intensity?: number | undefined;
    tags?: string[] | undefined;
}>;
export type CreateSceneObjectPayload = z.input<typeof createSceneObjectInputSchema>;
export type CreateSceneObjectCommand = z.output<typeof createSceneObjectInputSchema>;
export declare const updateSceneObjectInputSchema: z.ZodEffects<z.ZodObject<{
    color: z.ZodOptional<z.ZodString>;
    intensity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    color?: string | undefined;
    intensity?: number | undefined;
}, {
    color?: string | undefined;
    intensity?: number | undefined;
}>, {
    color?: string | undefined;
    intensity?: number | undefined;
}, {
    color?: string | undefined;
    intensity?: number | undefined;
}>;
export type UpdateSceneObjectPayload = z.input<typeof updateSceneObjectInputSchema>;
/** 拾取后放大面板所需的运行时统计，由服务端记录，不在前端伪造。 */
export declare const sceneObjectInspectorSchema: z.ZodObject<{
    objectId: z.ZodString;
    visits: z.ZodNumber;
    lastVisitedAt: z.ZodNullable<z.ZodString>;
    neighbors: z.ZodNumber;
    distanceToOrigin: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    objectId: string;
    visits: number;
    lastVisitedAt: string | null;
    neighbors: number;
    distanceToOrigin: number;
}, {
    objectId: string;
    visits: number;
    lastVisitedAt: string | null;
    neighbors: number;
    distanceToOrigin: number;
}>;
export type SceneObjectInspector = z.infer<typeof sceneObjectInspectorSchema>;
//# sourceMappingURL=scene-object.d.ts.map