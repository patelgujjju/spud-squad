import { z } from 'zod';
import { BASIC_BUTTONS, pointKey } from './buttons.js';
import type { Point } from './buttons.js';

export const pointSchema = z.tuple([
  z.int().min(0).max(63),
  z.int().min(0).max(63),
]);
export const slicerSchema = z.strictObject({
  type: z.literal('slicer'),
  at: pointSchema,
  onMs: z.int().min(1).max(60_000),
  offMs: z.int().min(400).max(60_000),
  phaseMs: z.int().min(0).max(120_000),
});
const leverSchema = z.strictObject({
  type: z.literal('lever'),
  at: pointSchema,
  toggles: z.array(pointSchema).min(1).max(64),
});
export const levelSchema = z
  .strictObject({
    id: z.string().regex(/^[1-5]-[1-9][0-9]?$/),
    name: z.string().trim().min(1).max(80),
    world: z.int().min(1).max(5),
    buttons: z.array(z.enum(BASIC_BUTTONS)).min(1).max(5),
    map: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .regex(/^[.#ECkDL><^vSG]+$/),
      )
      .min(1)
      .max(64),
    start: pointSchema,
    objects: z
      .array(z.discriminatedUnion('type', [slicerSchema, leverSchema]))
      .max(256),
    goldenChip: pointSchema.optional(),
    parSeconds: z.number().positive().max(3600),
    darkness: z.literal(false),
  })
  .superRefine((level, context) => {
    const issue = (message: string): void => {
      context.addIssue({ code: 'custom', message });
    };
    const width = level.map[0]?.length ?? 0;
    const tile = ([x, y]: Point): string | undefined => level.map[y]?.[x];
    if (level.map.some((row) => row.length !== width))
      issue('Map rows must have equal widths');
    if (new Set(level.buttons).size !== level.buttons.length)
      issue('Buttons must be unique');
    if (Number(level.id.split('-')[0]) !== level.world)
      issue('ID must match world');
    if (!tile(level.start) || !'.C'.includes(tile(level.start) ?? ''))
      issue('Start must be floor or checkpoint');
    const symbols = level.map.join('');
    if ([...symbols].filter((symbol) => symbol === 'E').length !== 1)
      issue('Map needs exactly one exit');
    const chipTiles: Point[] = [];
    const objects = new Set<string>();
    for (const object of level.objects) {
      const key = pointKey(object.at);
      if (objects.has(key)) issue(`Duplicate object at ${key}`);
      objects.add(key);
      if (tile(object.at) !== (object.type === 'slicer' ? 'S' : 'L'))
        issue(`Object does not match tile at ${key}`);
      if (object.type === 'lever') {
        if (!level.buttons.includes('GRAB')) issue('Levers require GRAB');
        if (
          new Set(object.toggles.map(pointKey)).size !== object.toggles.length
        )
          issue('Lever targets must be unique');
        for (const target of object.toggles) {
          if (!'D><^vS'.includes(tile(target) ?? '?'))
            issue(`Invalid lever target ${pointKey(target)}`);
        }
      }
    }
    level.map.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        if ('SL'.includes(symbol) && !objects.has(pointKey([x, y])))
          issue(`Missing object at ${x},${y}`);
        if (symbol === 'G') chipTiles.push([x, y]);
      }),
    );
    if (chipTiles.length > 1) issue('At most one Golden Chip is allowed');
    if (level.goldenChip) {
      if (!'.CG'.includes(tile(level.goldenChip) ?? '?'))
        issue('Golden Chip must be on floor or checkpoint');
      if (chipTiles.some((at) => pointKey(at) !== pointKey(level.goldenChip!)))
        issue('Golden Chip coordinates disagree');
    }
  });

export type Level = z.infer<typeof levelSchema>;
export type Slicer = z.infer<typeof slicerSchema>;
